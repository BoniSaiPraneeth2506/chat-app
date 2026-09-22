import { useEffect, useMemo, useRef, useState } from "react";
import { translateText, languageName, AI_LANGUAGES } from "../lib/sarvamApi";
import { getConvAutoTranslate } from "../lib/translatePrefs";

// ── Auto-translate rows for incoming messages ──────────────────────────────
//
// Reads the per-chat auto-translate pref. When on, incoming non-English text
// is shown translated underneath, with a "Show original" collapse. Results are
// cached per message+language in memory so scrolling an old chat never re-runs
// the AI; the pref reads straight from localStorage on every render (it's a
// cheap synchronous read) so toggling in the header reflects here instantly.

const CACHE = new Map(); // `${msgId}->${lang}` -> { translated, source }
const IN_FLIGHT = new Map(); // `${msgId}->${lang}` -> Promise

/**
 * True when this message still needs a translation — guards against the AI
 * echoing back the same text (source === target) or a no-op response.
 */
async function cachedTranslate(text, lang, msgId) {
  const key = `${msgId}->${lang}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);
  const task = translateText(text, lang).then(
    (res) => {
      const value = { translated: res.translatedText, source: res.sourceLanguage };
      CACHE.set(key, value);
      return value;
    },
    (err) => {
      console.error("Auto-translate failed:", err);
      return null;
    }
  );
  IN_FLIGHT.set(key, task);
  try {
    return await task;
  } finally {
    IN_FLIGHT.delete(key);
  }
}

const looksTranslated = (t) => t.translated && t.translated.trim() && t.translated.trim() !== t.text.trim();

export default function AutoTranslateRow({ message, convId }) {
  const [translated, setTranslated] = useState(() => CACHE.get(`${message._id}->${getConvAutoTranslate(convId || "").lang}`) || null);
  const [collapsed, setCollapsed] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  // Re-reads the pref when the header toggles/changes language mid-chat.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = (e) => {
      if (!e?.detail?.convId || String(e.detail.convId) === String(convId)) {
        setTranslated(null);
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("chatty:auto-translate-changed", onChange);
    return () => window.removeEventListener("chatty:auto-translate-changed", onChange);
  }, [convId]);

  const pref = useMemo(() => getConvAutoTranslate(convId || ""), [convId, tick]);

  useEffect(() => {
    const lang = pref.lang;
    const run = async () => {
      const cached = CACHE.get(`${message._id}->${lang}`);
      if (cached) {
        setTranslated(cached);
        setFailed(false);
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      const res = await cachedTranslate(message.text, lang, message._id);
      busyRef.current = false;
      if (res) {
        setTranslated(res);
        setFailed(false);
      } else {
        setFailed(true);
      }
    };
    if (pref.on) run();
    else setTranslated(null);
    return () => {
      busyRef.current = false;
    };
  }, [pref.on, pref.lang, message._id, message.text]);

  useEffect(() => {
    if (translated && looksTranslated({ text: message.text, translated: translated.translated })) {
      setCollapsed(false);
    }
  }, [translated, message.text]);

  if (!pref.on || failed) {
    if (failed && pref.on) return null;
    return null;
  }
  if (!translated) {
    return (
      <div className="mt-1 flex items-center gap-1 text-[11px] t-dim">
        <span className="inline-block size-2.5 animate-spin rounded-full border border-t-transparent border-current" />
        Translating…
      </div>
    );
  }
  const showable = looksTranslated({ text: message.text, translated: translated.translated }) ? translated.translated : null;

  return (
    <div className="mt-1">
      {showable && (
        <div className="text-[13px] leading-5 t-dim">
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="underline underline-offset-2 opacity-70 hover:opacity-100">
              Show translation
            </button>
          ) : (
            <p className="whitespace-pre-wrap break-words">{showable}</p>
          )}
        </div>
      )}
      {!showable && <p className="text-[12px] italic t-dim opacity-70">No translation needed</p>}
    </div>
  );
}

export { languageName, AI_LANGUAGES };