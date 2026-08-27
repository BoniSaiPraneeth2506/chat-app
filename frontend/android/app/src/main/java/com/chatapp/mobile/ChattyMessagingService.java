package com.chatapp.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Custom Firebase cloud-messaging service that renders WhatsApp-style GROUPED
 * notifications for a conversation.
 *
 * Android's native notification-group feature is what produces the behaviour the
 * user wants: one card per conversation with a stacked (overlapping) small icon
 * and a count badge, which expands on tap into the individual unseen messages.
 * The FCM message API cannot produce this, so we build it here at the OS level.
 *
 * - Foreground (app open): delegate to Capacitor so its web pushNotificationReceived
 *   event drives the existing in-app/local-notification flow untouched.
 * - Background / killed: accumulate the conversation's unseen messages in
 *   SharedPreferences and post Android group notifications:
 *     • a child notification per message (the rows revealed when the group opens)
 *     • a group summary (the collapsed card) carrying the small icon, a setNumber
 *       count, and an InboxStyle list of the messages.
 *   Tapping the summary opens the conversation via a PendingIntent that keeps the
 *   FCM data (including google.message_id) so Capacitor's existing tap-navigation
 *   keeps working.
 */
public class ChattyMessagingService extends FirebaseMessagingService {

    private static final String PREFS = "chatty_notification_stack";
    private static final String KEY_STACK = "stack"; // JSON: { conversationId: {title, lines:[..]} }

    // How many per-message child rows to keep/render; older ones are dropped so
    // the group never grows unbounded.
    private static final int MAX_CHILDREN = 5;

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

        // Maintain a per-conversation stack of message lines so repeated pushes
        // accumulate into one expandable group.
        Entry entry = pushLine(this, conversationId, title, body);
        List<String> lines = entry.lines;
        int count = lines.size();

        // Group key shared by summary + children (this is what makes them collapse).
        String group = "conv_" + conversationId;
        // Content intent: opens the conversation and preserves Capacitor tap routing.
        PendingIntent contentIntent = buildContentIntent(msg);

        // One child per message row, revealed when the group card is expanded.
        // Children share the group key but are not summaries, so tapping a row
        // auto-cancels just that row.
        for (int i = 0; i < lines.size(); i++) {
            int childId = stableId(conversationId + ":" + i);
            NotificationCompat.Builder child = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(entry.title)
                .setContentText(lines.get(i))
                .setGroup(group)
                .setAutoCancel(true)
                .setContentIntent(contentIntent);
            nm.notify(group, childId, child.build());
        }

        // The collapsed card: stacked small icon + count + InboxStyle list.
        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle();
        for (String line : lines) {
            inbox.addLine(line);
        }
        inbox.setSummaryText(count + " new messages");

        int summaryId = stableId(conversationId);
        NotificationCompat.Builder summary = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(entry.title)
            .setContentText(count + " new messages")
            .setGroup(group)
            .setGroupSummary(true)
            .setNumber(count)
            .setStyle(inbox)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);
        nm.notify(group, summaryId, summary.build());
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

    // ── Per-conversation stack in SharedPreferences ──────────────────────────

    private static synchronized Entry pushLine(Context context, String conversationId, String title, String body) {
        // Merge the incoming body (may itself be multi-line from the grouped
        // backend body) into individual message lines.
        String[] incoming = (body == null ? "" : body).split("\\n");
        List<String> newLines = new ArrayList<>();
        for (String s : incoming) {
            if (s != null && !s.trim().isEmpty()) {
                String t = s.trim();
                // Skip a trailing "N new messages" summary line already shown by
                // the card itself so it doesn't appear duplicated as a row.
                if (t.matches("\\d+ new message[s]?")) continue;
                newLines.add(t);
            }
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            String raw = prefs.getString(KEY_STACK, "{}");
            JSONObject stack = new JSONObject(raw);
            JSONObject entry = stack.optJSONObject(conversationId);
            String loadedTitle = title;
            List<String> lines = new ArrayList<>();
            if (entry != null) {
                loadedTitle = entry.optString("title", title);
                JSONArray arr = entry.optJSONArray("lines");
                if (arr != null) {
                    for (int i = 0; i < arr.length(); i++) lines.add(arr.getString(i));
                }
            }
            lines.addAll(newLines);
            int start = Math.max(0, lines.size() - MAX_CHILDREN);
            List<String> trimmed = new ArrayList<>(lines.subList(start, lines.size()));

            entry = new JSONObject();
            entry.put("title", loadedTitle);
            entry.put("lines", new JSONArray(trimmed));
            stack.put(conversationId, entry);
            prefs.edit().putString(KEY_STACK, stack.toString()).apply();

            Entry out = new Entry();
            out.title = loadedTitle;
            out.lines = trimmed;
            return out;
        } catch (Exception e) {
            Entry out = new Entry();
            out.title = title;
            out.lines = newLines;
            return out;
        }
    }

    /**
     * Clears the stacked notifications for one conversation (called when the app
     * opens that chat so the group disappears, like WhatsApp).
     */
    public static void clearConversation(Context context, String conversationId) {
        if (conversationId == null || context == null) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String group = "conv_" + conversationId;
        nm.cancelAll();
        // Drop the persisted stack for this conversation.
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_STACK, "{}");
            JSONObject stack = new JSONObject(raw);
            stack.remove(conversationId);
            prefs.edit().putString(KEY_STACK, stack.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static int stableId(String key) {
        int h = 0;
        for (int i = 0; i < key.length(); i++) {
            h = (31 * h + key.charAt(i)) & 0x7fffffff;
        }
        return h == 0 ? 1 : h;
    }

    private static class Entry {
        String title;
        List<String> lines;
    }
}
