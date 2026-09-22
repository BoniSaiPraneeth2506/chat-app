// ── Per-chat auto-translate preferences ────────────────────────────────────
//
// Auto-translate is a chat-level switch (DM or group) with a target language.
// Both live in localStorage keyed by conversation id so they survive restarts.
// The backend is untouched — translation still flows through the same
// /api/ai/translate endpoint the manual "Translate" button uses.

const GLOBAL_LANG_KEY = "chatty:autoTranslateLang";
const PREF_KEY = "chatty:autoTranslatePrefs";

const DEFAULTS = { on: false, lang: getGlobalLang() };

function readAll() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function getGlobalLang() {
  try {
    return localStorage.getItem(GLOBAL_LANG_KEY) || "en-IN";
  } catch {
    return "en-IN";
  }
}

export function setGlobalLang(code) {
  try {
    localStorage.setItem(GLOBAL_LANG_KEY, code);
  } catch {
    /* ignore */
  }
}

/** Returns { on, lang } for a conversation id, merged with defaults. */
export function getConvAutoTranslate(convId) {
  const all = readAll();
  const entry = all[convId];
  return {
    on: Boolean(entry?.on),
    lang: entry?.lang || getGlobalLang(),
  };
}

export function setConvAutoTranslate(convId, { on, lang }) {
  const all = readAll();
  all[convId] = { on: Boolean(on), lang: lang || getGlobalLang() };
  setGlobalLang(lang || getGlobalLang());
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  notifyConvPrefChanged(convId);
}

/**
 * Broadcasts that a conversation's auto-translate pref changed. The translated
 * rows subscribe so they re-read the pref without the header needing to
 * re-render the whole message list.
 */
export function notifyConvPrefChanged(convId) {
  try {
    window.dispatchEvent(new CustomEvent("chatty:auto-translate-changed", { detail: { convId } }));
  } catch {
    /* events unsupported (very old webviews) — ignore */
  }
}

export { DEFAULTS };