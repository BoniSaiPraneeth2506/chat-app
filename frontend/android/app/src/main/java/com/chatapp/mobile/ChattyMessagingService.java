package com.chatapp.mobile;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.ArrayList;
import java.util.List;

/**
 * Custom FirebaseMessagingService that renders WhatsApp-STYLE GROUPED
 * notifications for a conversation.
 *
 * Native Android notification groups are what produce the behaviour requested:
 * one card per conversation whose COLLAPSED preview shows only the LATEST
 * message, a count badge (setNumber) and a stacked "more" down-arrow; the card
 * EXPANDS (tap down-arrow) to reveal every unseen message as its own row. The
 * FCM display-message API cannot express this, so we build the group at the OS
 * level here.
 *
 * Group shape:
 *   - CHILDREN: one low-priority notification per unseen message line, all
 *     tagged with the conversation's group key and GROUP_ALERT_SUMMARY (so none
 *     of them alert individually). These are the rows shown when expanded.
 *   - SUMMARY: the collapsed card. Carries the stacked small icon, a setNumber
 *     count, the latest message as the preview, and GROUP_ALERT_SUMMARY so it
 *     (alone) is what surfaces in the shade.
 *
 * Navigation: the content intent (on every card and row) opens MainActivity with
 * all original FCM extras including google.message_id, so Capacitor's existing
 * pushNotificationActionPerformed → web tapHandler navigation keeps working. The
 * PendingIntent request code is derived from the conversation id so each
 * conversation has a DISTINCT pending intent (a shared request code of 0 was
 * overwriting every notification to point at the last one).
 */
public class ChattyMessagingService extends FirebaseMessagingService {

    // Set by MainActivity so the service knows whether the app is on screen.
    private static volatile boolean appForeground = false;

    // Upper bound on child rows we are willing to post per conversation. The
    // backend only aggregates a handful of lines, but keep a sane ceiling.
    private static final int MAX_CHILDREN = 50;

    public static void setAppForeground(boolean foreground) {
        appForeground = foreground;
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Foreground → let Capacitor's normal path fire pushNotificationReceived so
        // the existing web listener (which re-shows a tappable local notification)
        // keeps working exactly as before. No native group is rendered on screen.
        if (appForeground) {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
            return;
        }

        // Background / killed → build the native grouped notification.
        try {
            showGroupedNotification(remoteMessage);
        } catch (Exception e) {
            // Fall back to Capacitor's handling rather than silently dropping.
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    // ── Grouped notification rendering ────────────────────────────────────────

    private void showGroupedNotification(RemoteMessage msg) {
        RemoteMessage.Notification fcmNotif = msg.getNotification();
        if (fcmNotif == null) return;

        String type = msg.getData().get("type");
        // Non-conversation pushes (calls, requests, status) have no grouping;
        // hand those to the stock handler so they keep their simple single card.
        boolean conversation = "chat_message".equals(type)
            || "reply".equals(type)
            || "reaction".equals(type)
            || "group_message".equals(type)
            || "mention".equals(type);
        if (!conversation) {
            PushNotificationsPlugin.sendRemoteMessage(msg);
            return;
        }

        String conversationId = msg.getData().get("conversationId");
        if (conversationId == null || conversationId.isEmpty()) {
            // No stable key to group by — keep the stock single card.
            PushNotificationsPlugin.sendRemoteMessage(msg);
            return;
        }

        String title = msg.getData().get("title");
        if (title == null || title.isEmpty()) title = fcmNotif.getTitle();
        String body = msg.getData().get("body");
        if (body == null || body.isEmpty()) body = fcmNotif.getBody();
        String channelId = msg.getData().get("channelId");
        if (channelId == null || channelId.isEmpty()) channelId = "messages";

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // The backend sends a fully-aggregated multi-line body per push: one line
        // per unseen message (oldest → newest) plus a trailing "N new messages"
        // count. We render that authoritative list as a group and REPLACE it on
        // every push (no accumulation), so the card always reflects the set the
        // backend computed.
        ParsedBody parsed = parseBody(body);
        List<String> lines = parsed.lines;
        int count = parsed.count;

        // Latest message = the last line (backend sorts ascending by createdAt).
        String latest = lines.isEmpty() ? fcmNotif.getBody() : lines.get(lines.size() - 1);
        if (latest == null || latest.isEmpty()) latest = "New message";

        String groupKey = groupKey(conversationId);
        int summaryId = summaryId(conversationId);
        PendingIntent contentIntent = buildContentIntent(msg, conversationId);

        // Single message → a plain single card (no group), exactly like WhatsApp.
        if (lines.size() <= 1) {
            NotificationCompat.Builder b = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(latest)
                .setNumber(count)
                .setAutoCancel(true)
                .setContentIntent(contentIntent);
            nm.notify(summaryId, b.build());
            return;
        }

        // Multiple unseen messages → children (rows) + summary (collapsed card).
        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle();
        inbox.addLine(latest);
        inbox.setSummaryText(count + " new messages");

        // Rows revealed when the group expands. Order preserved via setSortKey.
        for (int i = 0; i < lines.size(); i++) {
            int childId = childId(summaryId, i);
            Notification child = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(lines.get(i))
                .setGroup(groupKey)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_SUMMARY)
                .setSortKey(String.format("%06d", i))
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
                .build();
            nm.notify(childId, child);
        }

        // The collapsed card: latest preview + count badge + stacked down-arrow.
        NotificationCompat.Builder summary = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(latest)
            .setNumber(count)
            .setStyle(inbox)
            .setGroup(groupKey)
            .setGroupSummary(true)
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_SUMMARY)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);
        nm.notify(summaryId, summary.build());

        // Trim any stale children left over from an earlier (longer) group so
        // the group always reflects the current count.
        for (int i = lines.size(); i < MAX_CHILDREN; i++) {
            nm.cancel(childId(summaryId, i));
        }
    }

    // Splits a backend body into message lines and a count. The count comes from
    // the trailing "N new messages" line (authoritative unread total); otherwise
    // it falls back to the number of lines.
    private static ParsedBody parseBody(String body) {
        List<String> lines = new ArrayList<>();
        int count = 0;
        if (body != null) {
            String[] parts = body.split("\\n");
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+) new message[s]?").matcher(body);
            if (m.find()) {
                count = Integer.parseInt(m.group(1));
            }
            for (String part : parts) {
                String t = part.trim();
                if (t.isEmpty()) continue;
                if (t.matches("\\d+ new message[s]?")) continue;
                lines.add(t);
            }
        }
        if (count <= 0) count = lines.size();
        ParsedBody out = new ParsedBody();
        out.lines = lines;
        out.count = count;
        return out;
    }

    // Builds a PendingIntent that launches MainActivity with all the FCM extras
    // (including google.message_id) so Capacitor's pushNotificationActionPerformed
    // still fires on tap → the app navigates to the conversation as before.
    // The request code is derived from the conversation id so DIFFERENT
    // conversations get DIFFERENT PendingIntents (using a constant request code
    // with FLAG_UPDATE_CURRENT made every notification resolve to the last one).
    private PendingIntent buildContentIntent(RemoteMessage msg, String conversationId) {
        Intent intent = getPackageManager()
            .getLaunchIntentForPackage(getPackageName())
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Bundle extras = msg.toIntent().getExtras();
        if (extras != null) {
            intent.putExtras(extras);
        }
        // Belt-and-braces: always carry the conversation id on the intent.
        if (!intent.hasExtra("conversationId") && conversationId != null) {
            intent.putExtra("conversationId", conversationId);
        }
        int requestCode = summaryId(conversationId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, requestCode, intent, flags);
    }

    /**
     * Clears the grouped notifications for one conversation (called when the app
     * opens that chat so the card disappears, like WhatsApp). Clears only this
     * conversation's group — other conversations' notifications are untouched.
     */
    public static void clearConversation(Context context, String conversationId) {
        if (conversationId == null || context == null) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        int id = summaryId(conversationId);
        nm.cancel(id);
        for (int i = 0; i < MAX_CHILDREN; i++) {
            nm.cancel(childId(id, i));
        }
    }

    // ── Id helpers ────────────────────────────────────────────────────────────

    // The notification id for the summary (collapsed card) of a conversation.
    private static int summaryId(String conversationId) {
        return stableHash(groupKey(conversationId));
    }

    // The notification id for the i-th child row of a conversation's group.
    private static int childId(int summaryId, int i) {
        return summaryId + 2 + i;
    }

    // Group key shared by a conversation's summary + children. Namespaced so it
    // never collides with other apps' group tags for the same device.
    private static String groupKey(String conversationId) {
        return "chatty_conv_" + conversationId;
    }

    private static int stableHash(String key) {
        int h = 0;
        for (int i = 0; i < key.length(); i++) {
            h = (31 * h + key.charAt(i)) & 0x7fffffff;
        }
        return h == 0 ? 1 : h;
    }

    private static class ParsedBody {
        List<String> lines;
        int count;
    }
}
