import { Capacitor } from "@capacitor/core";

let KeyboardPlugin = null;
let keyboardPluginPromise = null;

// @capacitor/keyboard is a native plugin, so it only resolves inside the app
// (not in a browser). Load it lazily so the web build doesn't try to fetch a
// native module.
async function loadKeyboard() {
  if (keyboardPluginPromise) return keyboardPluginPromise;
  if (!Capacitor.isNativePlatform()) {
    keyboardPluginPromise = Promise.resolve(null);
    return keyboardPluginPromise;
  }
  keyboardPluginPromise = import("@capacitor/keyboard").then(
    (m) => m.Keyboard ?? null,
    () => null
  );
  return keyboardPluginPromise;
}

// Focus an element and, on a native app, explicitly summon the software
// keyboard. Native `el.focus()` alone is unreliable for raising the keyboard on
// Android WebViews when the focus call isn't tied to the gesture window, so the
// plugin's show() is the reliable path there.
//
// Android keeps a per-input focus+keyboard state, so re-focusing an already
// focused field after the keyboard was dismissed (e.g. replying a second time
// in the same chat) does nothing. Blurring then focusing resets that state and
// forces the keyboard back up every time.
export async function focusWithKeyboard(el) {
  if (!el) return;
  el.blur();
  el.focus();
  try {
    const end = el.value?.length ?? 0;
    el.setSelectionRange(end, end);
  } catch {
    // Not every input type supports a selection range.
  }
  const Keyboard = await loadKeyboard();
  if (Keyboard) {
    try {
      await Keyboard.show();
    } catch {
      // Keyboard plugin not available or blocked.
    }
  }
}

// Explicitly hide the software keyboard on a native app (used when the user
// taps the chat backdrop to dismiss an active reply + keyboard).
export async function hideKeyboard() {
  const Keyboard = await loadKeyboard();
  if (Keyboard) {
    try {
      await Keyboard.hide();
    } catch {
      // Keyboard plugin not available or blocked.
    }
  }
}
