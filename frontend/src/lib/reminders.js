// ── Message reminders (client-side) ──────────────────────────────────────────
// Schedules a @capacitor/local-notifications notification a chosen time from
// now. The id is derived from the message id + a nonce so reminding the same
// message twice never collides. Tapping routes through the same centralized
// nav used by chat notifications (extra.conversationId). On the web (no
// Capacitor) it degrades to a delayed toast.

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import toast from "react-hot-toast";

const isNative = () => Capacitor.isNativePlatform();

function digest(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483647;
  return h || 1;
}

const bodyOf = (m) => {
  const text = m?.text && String(m.text).trim();
  if (text) return text.length > 140 ? text.slice(0, 137) + "…" : text;
  if (m?.images?.length) return `${m.images.length} photo${m.images.length > 1 ? "s" : ""}`;
  if (m?.image) return "Photo";
  if (m?.video) return "Video";
  if (m?.attachments?.length) return "Attachment";
  if (m?.voiceNote) return "Voice note";
  if (m?.location) return "Location";
  if (m?.poll) return "Poll";
  return "Message reminder";
};

/** Schedule a reminder `afterMs` from now for the given message/conversation. */
export async function scheduleReminder({ conversationId, title = "Chatty reminder", message, afterMs }) {
  const fullBody = bodyOf(message);
  const label = afterMs >= 24 * 60 * 60 * 1000 ? "1 day" : "1 hour";

  if (!isNative()) {
    toast.success(`Reminder set (${label})`);
    setTimeout(() => {
      toast(`⏰ ${title}: ${fullBody}`, { duration: 10000 });
    }, afterMs);
    return;
  }

  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      toast.error("Notification permission required for reminders");
      return;
    }
    const id = digest(`rem-${message?._id || ""}-${Date.now()}`);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `Reminder · ${title}`,
          body: fullBody,
          schedule: { at: new Date(Date.now() + afterMs) },
          sound: "default",
          extra: { conversationId, reminder: "1" },
        },
      ],
    });
    toast.success(`Reminder set (${label})`);
  } catch (err) {
    console.error("[reminders] schedule error:", err.message);
    toast.error("Couldn't schedule reminder");
  }
}