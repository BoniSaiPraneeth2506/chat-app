// ── Android push notifications (FCM) via @capacitor/push-notifications ────────
//
// Client-side half of the push feature. Socket.IO stays the realtime path; FCM
// is the fallback that wakes the Android system notification drawer when the
// app isn't actively showing the message.
//
// Everything here is guarded to native Capacitor only — the same code runs in a
// desktop browser during development where there is no FCM, and must no-op
// there rather than throw.

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import axiosInstance from "./axios.js";

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
let tapHandler = null;

/**
 * Install the native FCM listeners once, on app boot.
 * `onTap(data)` is invoked on notification tap with the structured `data`
 * payload so the app can route to the exact conversation.
 */
export function initPushListeners(onTap) {
  tapHandler = onTap;
  if (!isNative() || listenersAdded) return;
  listenersAdded = true;

  PushNotifications.addListener("registration", (token) => {
    const value = typeof token === "string" ? token : token?.value;
    if (value) registerTokenWithBackend(value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] registration error:", err?.error || err);
  });

  // Foreground receipt. The native plugin shows the system notification for
  // FCM pushes automatically. The server already suppresses the push entirely
  // when any device is viewing that conversation, so nothing extra is needed
  // here — this handler exists mainly for observability.
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const data = notification?.data || {};
    if (data.silent === "true") return;
  });

  // Tap on a delivered notification → route to the conversation.
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action?.notification?.data || {};
    if (typeof tapHandler === "function") tapHandler(data);
  });
}

/**
 * Tell the push helpers which stores to read for "currently open conversation".
 * Call once from the app after the stores are imported.
 */
export function bindPushStores({ chatStore, groupStore }) {
  storeRefs.chat = chatStore;
  storeRefs.group = groupStore;
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
