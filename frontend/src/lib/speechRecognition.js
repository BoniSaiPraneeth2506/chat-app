// ── Native speech recognition (Capacitor -> Android SpeechRecognizer) ───────
//
// The Capacitor WebView has no `window.SpeechRecognition`, so dictation inside
// the APK cannot stream words the way it can in a browser. This wrapper talks
// to the local SpeechRecognitionPlugin (see MainActivity + SpeechRecognitionPlugin.java),
// which streams "partial" results while the user holds the mic and delivers a
// final "result" on release. Each event carries { text } (or { code, error })
// and the session is wrapped up by "end".
//
// On the web this registers a stub, so calls simply report "not available" and
// the composer falls back to the Web Speech API / MediaRecorder+Sarvam path.

import { registerPlugin } from "@capacitor/core";

const NativeSpeech = registerPlugin("SpeechRecognition", {
  web: () => ({
    isAvailable: async () => ({ available: false }),
    start: async () => ({}),
    stop: async () => ({}),
  }),
});

/**
 * True only inside the native APK where the plugin can be reached AND the
 * device actually has an on-device speech recognizer.
 */
export async function nativeSpeechAvailable() {
  try {
    if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform?.()) return false;
    const res = await NativeSpeech.isAvailable();
    return Boolean(res && res.available);
  } catch (err) {
    console.warn("[native speech] isAvailable failed", err);
    return false;
  }
}

/**
 * Start a streaming dictation session via Android's SpeechRecognizer.
 *
 * Returns a controller { stop, remove } once the recognizer is listening; every
 * event is dispatched through the provided callbacks (partial/result/error/end).
 * Rejects if the device cannot start listening, in which case the caller should
 * fall back to a web recognizer. `end` fires once, whether the session ended
 * with a transcript (release) or an error (denied mic, no speech, ...).
 */
export async function startNativeDictation({ language = "en-IN", onPartial, onResult, onError, onEnd }) {
  if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform?.()) {
    throw new Error("Not running in the native app");
  }

  const handles = await Promise.all([
    NativeSpeech.addListener("partial", (data) => onPartial?.(data?.text || "")),
    NativeSpeech.addListener("result", (data) => onResult?.(data?.text || "")),
    NativeSpeech.addListener("error", (data) => onError?.(data || {})),
    NativeSpeech.addListener("end", () => onEnd?.()),
  ]).catch((err) => {
    throw err;
  });

  try {
    await NativeSpeech.start({ language });
  } catch (err) {
    // Do not leak the listeners on a failed start.
    await Promise.all(handles.map((h) => (h && h.remove ? h.remove() : Promise.resolve())));
    throw err;
  }

  return {
    stop: () => NativeSpeech.stop().catch(() => {}),
    remove: () => Promise.all(handles.map((h) => (h && h.remove ? h.remove() : Promise.resolve()))).then(() => {}),
  };
}