import { registerPlugin, Capacitor } from "@capacitor/core";

// Screenshot blocking for view-once media.
//
// Nothing in the WebView can stop a system screen capture, so this has to go
// through a native window flag (FLAG_SECURE). See
// android/app/src/main/java/com/chatapp/mobile/SecureScreenPlugin.java.
//
// Android only. iOS has no equivalent flag, and on the web the whole idea is
// unenforceable — callers get a silent no-op rather than a rejected promise, so
// the UI never has to branch on platform.

const SecureScreen = registerPlugin("SecureScreen");

export const setScreenSecure = async (secure) => {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    if (secure) await SecureScreen.enable();
    else await SecureScreen.disable();
    return true;
  } catch (err) {
    // An older build without the plugin registered must not break viewing.
    console.warn("SecureScreen unavailable:", err?.message || err);
    return false;
  }
};
