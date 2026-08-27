package com.chatapp.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.ArrayList;
import java.util.List;

/**
 * Custom Firebase cloud-messaging service that renders WhatsApp-style GROUPED
 * notifications for a conversation.
 *
 * Android's native notification-group feature is what produces the behaviour the
 * user wants: one card per conversation with a stacked (overlapping) small icon
 * and a count badge, which expands into the individual unseen messages. The FCM
 * message API cannot produce this, so we build it here at the OS level.
 *
 * - Foreground (app open): delegate to Capacitor so its web pushNotificationReceived
 *   event drives the existing in-app/local-notification flow untouched.
 * - Background / killed: render Android group notifications from the backend's
 *   fully-aggregated message body — a child notification per message (the rows
 *   revealed when the group opens) plus a group summary (the collapsed card)
 *   carrying the stacked small icon, a setNumber count, and an InboxStyle list.
 *   Tapping the summary opens the conversation via a PendingIntent that keeps the
 *   FCM data (including google.message_id) so Capacitor's existing tap-navigation
 *   keeps working.
 */
public class ChattyMessagingService extends FirebaseMessagingService {

    // Set by MainActivity so the service knows whether the app is on screen.
    private static volatile boolean appForeground = false;

    public static void setAppForeground(boolean foreground) {
        appForeground = foreground;
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Foreground → let Capacitor's normal path fire pushNotificationReceived so
        // the existing web listener (which re-shows a tappable local notification)
        // keeps working exactly as before.
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
        String title = msg.getData().get("title");
        if (title == null || title.isEmpty()) title = fcmNotif.getTitle();
        String body = msg.getData().get("body");
        if (body == null || body.isEmpty()) body = fcmNotif.getBody();
        String channelId = msg.getData().get("channelId");
        if (channelId == null || channelId.isEmpty()) channelId = "messages";

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // The backend sends a fully-aggregated multi-line body per push: one line
        // per unseen message plus a trailing "N new messages" count. We render
        // that list as a single InboxStyle notification and REPLACE it on every
        // push (no accumulation), so the card always reflects the authoritative set
        // of unseen messages.
        ParsedBody parsed = parseBody(body);
        List<String> lines = parsed.lines;
        int count = parsed.count;
        String latest = lines.isEmpty() ? "New message" : lines.get(lines.size() - 1);

        // Content intent: opens the conversation and preserves Capacitor tap routing.
        PendingIntent contentIntent = buildContentIntent(msg);

        // One per-conversation card: collapsed shows the LATEST message + count
        // badge + down-arrow; expanding reveals the full unread list. Using a
        // single InboxStyle notification (not separate child notifications) keeps
        // the shade clean and the tap-focus reliable.
        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle();
        for (String line : lines) inbox.addLine(line);
        if (count > lines.size()) inbox.addLine(count + " new messages");
        inbox.setSummaryText(count + " new messages");

        int summaryId = stableId(conversationId);
        NotificationCompat.Builder summary = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(latest)
            .setNumber(count)
            .setStyle(inbox)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);
        nm.notify(summaryId, summary.build());
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
            boolean hasCountLine = m.find();
            if (hasCountLine) {
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
    private PendingIntent buildContentIntent(RemoteMessage msg) {
        Intent intent = getPackageManager()
            .getLaunchIntentForPackage(getPackageName())
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtras(msg.toIntent().getExtras());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 0, intent, flags);
    }

    /**
     * Clears the grouped notifications for one conversation (called when the app
     * opens that chat so the card disappears, like WhatsApp). Clears only this
     * conversation's group — other conversations' notifications are untouched.
     */
    public static void clearConversation(Context context, String conversationId) {
        if (conversationId == null || context == null) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(stableId(conversationId));
    }

    private static int stableId(String key) {
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
