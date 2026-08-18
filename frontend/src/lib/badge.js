import { Capacitor } from "@capacitor/core";
import { Badge } from "@capawesome/capacitor-badge";

// Unread count on the launcher icon.
//
// Android has no official badge API. The plugin uses ShortcutBadger, which talks
// to vendor-specific mechanisms (Samsung, Xiaomi, vivo, Sony and others), so
// whether a badge appears depends on the launcher rather than on the app. That is
// why every call is guarded by isSupported() and why failure is silent: on a
// launcher without support there is nothing to fall back to, and a toast about it
// would be noise the user cannot act on.
//
// Deliberately no notifications involved. A notification-channel badge is the
// other way to do this and would show a count on any Android 8+ launcher, but it
// means posting a notification — which is out of scope for now.

let supported = null; // null = not yet asked
let lastCount = -1;

const isAndroid = () => Capacitor.getPlatform() === "android";

const checkSupport = async () => {
  if (supported !== null) return supported;
  try {
    const result = await Badge.isSupported();
    supported = Boolean(result?.isSupported);
    if (!supported) {
      console.info("[badge] this launcher does not support icon badges");
    }
  } catch {
    supported = false;
  }
  return supported;
};

/**
 * Sets the launcher badge, or clears it at zero.
 *
 * Repeated calls with the same number are dropped. The count is recomputed on
 * every store change, so without this the plugin would be invoked on each
 * keystroke-driven re-render for no reason.
 */
export const setBadgeCount = async (count) => {
  if (!isAndroid()) return;

  const next = Math.max(0, Math.floor(Number(count) || 0));
  if (next === lastCount) return;

  if (!(await checkSupport())) return;

  try {
    if (next > 0) await Badge.set({ count: next });
    else await Badge.clear();
    lastCount = next;
  } catch (err) {
    console.warn("[badge] could not update:", err?.message || err);
  }
};

/** Clears the badge and forgets the cached value, e.g. on sign-out. */
export const clearBadge = async () => {
  lastCount = -1;
  if (!isAndroid()) return;
  if (!(await checkSupport())) return;
  try {
    await Badge.clear();
  } catch {
    // Nothing useful to do — the badge is cosmetic.
  }
};
