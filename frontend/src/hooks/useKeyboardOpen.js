import { useEffect, useState } from "react";
import { Keyboard } from "@capacitor/keyboard";

/**
 * Tracks whether the on-screen keyboard is up, and how tall it is.
 *
 * In the APK the Capacitor Keyboard plugin is authoritative (exact heights,
 * works regardless of window resize behavior). In a plain browser the layout
 * viewport never shrinks with the keyboard, so a visualViewport shrink is the
 * reliable open signal.
 *
 * The chat composer already rides above the keyboard via --app-vh; this hook
 * exists so chrome that should NOT float (the home screen's bottom tab bar)
 * can slide away while typing, the way real chat apps behave.
 */
export function useKeyboardOpen() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const isNative =
      typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();

    if (isNative) {
      let mounted = true;
      const handles = [];
      const onShow = (info) => {
        if (!mounted) return;
        setIsKeyboardOpen(true);
        setKeyboardHeight(info?.keyboardHeight || 0);
      };
      const onHide = () => {
        if (!mounted) return;
        setIsKeyboardOpen(false);
        setKeyboardHeight(0);
      };
      Promise.all([
        Keyboard.addListener("keyboardWillShow", onShow),
        Keyboard.addListener("keyboardWillHide", onHide),
      ])
        .then((hs) => {
          if (!mounted) return;
          hs.forEach((h) => handles.push(h));
        })
        .catch((err) => console.warn("[keyboard] native listeners failed", err));

      return () => {
        mounted = false;
        handles.forEach((h) => h.remove?.());
      };
    }

    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const h = Math.max(0, Math.round(window.innerHeight - vv.height));
      setIsKeyboardOpen(vv.height < window.innerHeight - 48);
      setKeyboardHeight(h);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const onBlur = () => setIsKeyboardOpen(false);
    window.addEventListener("blur", onBlur);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}