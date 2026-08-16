export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The origin a shared link should point at.
 *
 * `window.location.origin` is wrong on Android: the Capacitor WebView serves
 * the bundle from `https://localhost`, so a QR/chat link built from it is a
 * dead address for whoever receives it. Prefer an explicitly configured
 * public URL, then fall back to the API host (the backend also serves the
 * SPA), and only use the current origin when it's a real remote one.
 */
export function getPublicAppUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  if (configured) return String(configured).replace(/\/+$/, "");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocalWebView = /^https?:\/\/localhost(:\d+)?$/i.test(origin);

  if (origin && !isLocalWebView) return origin;

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      // Malformed env value — fall through to the origin below.
    }
  }
  return origin;
}

/** The deep link that opens a direct chat with `userId` (see /chat-with/:userId). */
export function buildChatLink(userId) {
  return `${getPublicAppUrl()}/chat-with/${userId}`;
}

/** The shareable link that lets someone join a group (see /join/:code). */
export function buildInviteLink(code) {
  return `${getPublicAppUrl()}/join/${code}`;
}

/**
 * Pulls a user id out of a scanned QR payload. Accepts a full chat link, a
 * bare `/chat-with/<id>` path, or the raw id itself, so a code produced by
 * any build of the app still scans correctly.
 */
export function parseChatLink(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  const match = value.match(/chat-with\/([a-f\d]{24})/i);
  if (match) return match[1];
  if (/^[a-f\d]{24}$/i.test(value)) return value;
  return null;
}