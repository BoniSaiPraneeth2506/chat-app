// ── Android push notifications (FCM) via @capacitor/push-notifications ────────
//
// Client-side half of the push feature. Socket.IO stays the realtime path; FCM
// is the fallback that wakes the Android system notification drawer when the
// app isn't actively showing the message.
//
// Everything here is guarded to native Capacitor only — the same code runs in a
// desktop browser during development where there is no FCM, and must no-op
// there rather than throw.
//
// TAP ROUTING
// ───────────
// Notification taps are routed through the centralized navigation module
// (lib/notificationNavigation.js), which waits for auth + router readiness and
// navigates exactly once.
//   - Background / killed: the OS shows the FCM notification; a tap arrives via
//     `pushNotificationActionPerformed`.
//   - Foreground: the Capacitor push plugin does not reliably surface a tap from
//     its own foreground notification (known limitation), so we re-display the
//     incoming message as a tappable local notification whose tap fires
//     `localNotificationActionPerformed`. The server suppresses the push when the
//     device is already viewing that conversation, so the foreground card is not
//     redundant there.

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import axiosInstance from "./axios.js";
import { handleNotificationTap } from "./notificationNavigation.js";

// The server references these channel ids in every payload (CHANNEL_BY_TYPE),
// and the system routes the delivered notification through the channel — so
// the user's per-channel sound/importance/lights settings apply.
const CHANNELS = [
  { id: "messages", name: "Messages", description: "Direct message notifications", importance: 5, vibration: true, lights: true },
  { id: "groups", name: "Groups", description: "Group message notifications", importance: 5, vibration: true, lights: true },
  { id: "mentions", name: "Mentions", description: "Mentions in groups", importance: 5, vibration: true, lights: true },
  { id: "calls", name: "Calls", description: "Missed call notifications", importance: 5, vibration: true, lights: true },
  { id: "requests", name: "Requests", description: "Message request notifications", importance: 4, vibration: true, lights: false },
  { id: "status", name: "Status", description: "Status update notifications", importance: 4, vibration: true, lights: false },
];

const isNative = () => Capacitor.isNativePlatform();

// Stable per-install id so a re-login registers a new token but the server can
// tell it belongs to the same physical install and replace the old entry
// instead of piling up duplicates.
let _deviceId = null;
function ensureDeviceId() {
  if (_deviceId) return _deviceId;
  try {
    _deviceId = localStorage.getItem("fcm_device_id");
    if (!_deviceId) {
      _deviceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "dev-" + Date.now() + "-" + Math.floor(Math.random() * 1e9);
      localStorage.setItem("fcm_device_id", _deviceId);
    }
  } catch {
    _deviceId = "dev-" + Date.now();
  }
  return _deviceId;
}

let listenersAdded = false;

/**
 * Install the native FCM + local-notification listeners once, on app boot.
 * Every tap funnels to handleNotificationTap() in the centralized nav module.
 */
export function initPushListeners() {
  if (!isNative() || listenersAdded) return;
  listenersAdded = true;

  PushNotifications.addListener("registration", (token) => {
    const value = typeof token === "string" ? token : token?.value;
    if (value) registerTokenWithBackend(value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] registration error:", err?.error || err);
  });

  // Foreground receipt. Re-display the incoming message as a tappable local
  // notification so a tap reliably routes (the plugin's own foreground card
  // doesn't reliably deliver pushNotificationActionPerformed).
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const data = notification?.data || {};
    console.log("[Push] received (foreground):", JSON.stringify(data));
    if (data.silent === "true") return;
    showForegroundNotification(notification);
  });

  // Tap on a delivered notification while the app was in the background/killed
  // state (the OS-created one) → route to the conversation.
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action?.notification?.data || {};
    console.log("[Notification] tapped (background/killed)");
    console.log("[Capacitor notification action received]:", JSON.stringify(data));
    console.log("[Android Intent] conversationId:", data?.conversationId);
    handleNotificationTap(data);
  });

  // Tap on the foreground local notification we created → route to the
  // conversation.
  LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    const extra = action?.notification?.extra || {};
    console.log("[Notification] tapped (foreground)");
    console.log("[Local notification action received]:", JSON.stringify(extra));
    handleNotificationTap(extra);
  });

  // Cold-start launch intent. When Chatty is force-killed and launched by
  // tapping a notification, the Capacitor push plugin only surfaces the tap if
  // the launch intent happens to carry `google.message_id` — which some OEMs
  // (vivo) drop. As a reliable fallback MainActivity exposes the captured
  // `data` extras through a native JavascriptInterface; we pull them at
  // boot (with retries for bridge initialization) and route through the same
  // centralized path. Dedup in notificationNavigation absorbs any overlap.
  pullLaunchTap();

  // A background tap resumes the already-running app. MainActivity re-captures
  // the tap in onNewIntent, but the plugin event may again be silently dropped
  // (missing google.message_id), so pull the native bridge again on resume.
  App.addListener("resume", () => {
    setTimeout(() => pullLaunchTap(), 400);
  });
}

// Read a notification tap that launched the app from a cold start via the
// native launch-intent bridge (see MainActivity.AndroidBridge). Retries up to
// 4 times to accommodate WebView JavascriptInterface injection timing.
function pullLaunchTap(attemptsLeft = 4) {
  try {
    const bridge = window.AndroidBridge;
    if (!bridge || typeof bridge.getLaunchTap !== "function") {
      if (attemptsLeft > 0) {
        setTimeout(() => pullLaunchTap(attemptsLeft - 1), 200);
      }
      return;
    }
    const json = bridge.getLaunchTap();
    if (!json) return;
    const data = JSON.parse(json);
    console.log("[Notification] tapped (cold start bridge)");
    console.log("[Push] cold-start launch tap from native bridge:", JSON.stringify(data));
    console.log("[Android Intent] conversationId:", data?.conversationId);
    handleNotificationTap(data);
  } catch (err) {
    console.error("[push] error reading cold-start launch tap:", err.message);
  }
}

// Re-create the incoming FCM message as a local notification so that tapping it
// in the foreground actually fires a tap event (see initPushListeners).
async function showForegroundNotification(notification) {
  try {
    const data = notification?.data || {};
    const title = notification?.title || data?.title || "ChatApp";
    const body = notification?.body || data?.body || "New message";
    const channelId = data?.channelId || "messages";

    // Derive a stable numeric id from the CONVERSATION (not the message) so
    // successive foreground messages from the same conversation replace the
    // previous local card instead of stacking one per message — the equivalent
    // of the tag grouping used on the OS/background path.
    let id = 0;
    const raw = String(data?.conversationId || data?.senderId || "");
    for (let i = 0; i < raw.length; i++) id = (id + raw.charCodeAt(i)) % 2147483647;
    if (!id) id = Date.now() % 2147483647;

    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          channelId,
          sound: "default",
          extra: data,
        },
      ],
    });
  } catch (err) {
    console.error("[push] foreground local notification error:", err.message);
  }
}

/** Register (or re-register) this install's FCM token with the backend. */
export async function registerTokenWithBackend(token) {
  if (!isNative() || !token) return;
  try {
    await axiosInstance.post("/notifications/device-token", {
      token,
      deviceId: ensureDeviceId(),
    });
    localStorage.setItem("fcm_token", token);
  } catch (err) {
    console.error("[push] failed to register token:", err.response?.data?.message || err.message);
  }
}

/** Remove this install's token on logout so it stops receiving pushes. */
export async function removeDeviceToken() {
  if (!isNative()) return;
  try {
    await PushNotifications.unregister();
  } catch {
    // best-effort
  }
  try {
    const token = localStorage.getItem("fcm_token");
    if (token) {
      await axiosInstance.delete(`/notifications/device-token/${encodeURIComponent(token)}`);
    }
  } catch {
    // ignore
  }
  localStorage.removeItem("fcm_token");
}

/**
 * Set up push on this device: create channels, request permission
 * (Android 13+ runtime), then register for an FCM token. Idempotent.
 */
export async function initPushRegistration() {
  if (!isNative()) return;
  try {
    for (const ch of CHANNELS) {
      try {
        await PushNotifications.createChannel(ch);
      } catch (e) {
        console.warn("[push] createChannel", ch.id, e?.message);
      }
    }
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[push] notification permission denied:", perm.receive);
      return;
    }
    await PushNotifications.register();
  } catch (err) {
    console.error("[push] initPushRegistration error:", err.message);
  }
}

/** Emit the currently-open conversation so the server can skip redundant pushes. */
export function reportActiveConversation(conversationId, socket) {
  if (!socket || !socket.connected) return;
  socket.emit("activeConversation", {
    conversationId: conversationId ? String(conversationId) : null,
  });
}

export default {
  initPushListeners,
  initPushRegistration,
  registerTokenWithBackend,
  removeDeviceToken,
  reportActiveConversation,
};
