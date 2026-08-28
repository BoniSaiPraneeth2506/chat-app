// Haptic feedback, shared across components.
//
// Extracted from ChatContainer, which held the only `buzz()` and used it for
// long-press alone. Everything here is a no-op unless the device is actually
// touch-first: `navigator.vibrate` exists on some laptops but firing it there
// is not wanted, so the coarse-pointer check keeps this to phones — matching
// how the rest of the mobile-only work in this app is scoped.
//
// Patterns are named by intent rather than duration so call sites read clearly
// and the feel can be retuned in one place. A single number is one buzz in ms;
// an array alternates vibrate/pause.

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const PATTERNS = {
  /** Lightest tick: toggling a selection, tapping an emoji. */
  tap: 10,
  /** Something entered a mode — long-press opening the selection toolbar. */
  longPress: 15,
  /** A gesture crossed its threshold, e.g. swipe-to-reply committing. */
  impact: 25,
  /** A double-tap reaction landed. */
  double: [15, 40, 15],
  /** An action completed: copied, pinned, sent, deleted. */
  success: [10, 30, 20],
  /** An action was refused, e.g. the pin limit. */
  reject: [30, 40, 30],
};

// Android's WebView doesn't expose navigator.vibrate, so on the native app we
// drive haptics through the Capacitor plugin instead and keep navigator.vibrate
// as the desktop/web fallback.
const isNative = () =>
  Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios";

/**
 * Native haptic route: maps each named pattern to a platform-level resonance
 * (selection tick, impact, or notification success/confirmation) so it feels
 * intentional rather than a generic buzz.
 */
async function nativeHaptic(name) {
  switch (name) {
    case "impact":
      return Haptics.impact({ style: ImpactStyle.Medium });
    case "longPress":
      return Haptics.impact({ style: ImpactStyle.Light });
    case "double":
      return Haptics.impact({ style: ImpactStyle.Light });
    case "success":
      return Haptics.notification({ type: NotificationType.Success });
    case "reject":
      return Haptics.notification({ type: NotificationType.Error });
    case "tap":
    default:
      return Haptics.selectionStart();
  }
}

/**
 * Touch-first devices only. `(hover: none)` is true on phones and false on a
 * mouse-driven desktop, which is a better signal here than screen width —
 * a narrow desktop window is still a desktop.
 */
const canVibrate = () => {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  } catch {
    // No matchMedia: assume not a touch device rather than buzzing a desktop.
    return false;
  }
};

export const haptic = (name = "tap") => {
  try {
    if (isNative()) {
      nativeHaptic(name).catch(() => {});
      return;
    }
  } catch {
    // fall through to navigator.vibrate below
  }
  if (canVibrate()) {
    try {
      navigator.vibrate(PATTERNS[name] ?? PATTERNS.tap);
    } catch {
      // Haptics are best effort — never let them break an interaction.
    }
  }
};
