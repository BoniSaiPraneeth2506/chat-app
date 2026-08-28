// ── Sarvam AI client (frontend) ─────────────────────────────────────────────
//
// The frontend never sees the Sarvam API key — these all call our own
// /api/ai/* endpoints (Bearer auth handled by axiosInstance). The backend
// proxies to Sarvam and keeps the key server-side.

import axiosInstance from "./axios";

/** Official codes the UI offers. Kept in sync with backend/controllers/ai.controller.js. */
export const AI_LANGUAGES = [
  { code: "en-IN", name: "English", script: "Latin" },
  { code: "hi-IN", name: "Hindi", script: "Devanagari" },
  { code: "te-IN", name: "Telugu", script: "Telugu" },
  { code: "ta-IN", name: "Tamil", script: "Tamil" },
  { code: "kn-IN", name: "Kannada", script: "Kannada" },
  { code: "ml-IN", name: "Malayalam", script: "Malayalam" },
];

const languageName = (code) =>
  AI_LANGUAGES.find((l) => l.code === code)?.name || code;

async function aiError(err) {
  const msg = err?.response?.data?.message;
  if (typeof msg === "string" && msg) return msg;
  return err?.message || "Something went wrong";
}

export async function translateText(text, targetLanguage) {
  const { data } = await axiosInstance.post("/ai/translate", {
    text,
    targetLanguage,
  });
  return data; // { translatedText, sourceLanguage, targetLanguage }
}

export async function transliterateText(text, targetLanguage) {
  const { data } = await axiosInstance.post("/ai/transliterate", {
    text,
    targetLanguage,
  });
  return data; // { transliteratedText, sourceLanguage, sourceScript, targetLanguage }
}

/**
 * Fetch a message's speech as an MP3 Blob. Returns { blob, language, url }.
 * The caller is responsible for revoking the object URL when done.
 */
export async function textToSpeech(text, languageCode) {
  const res = await axiosInstance.post(
    "/ai/text-to-speech",
    { text, languageCode },
    { responseType: "blob" }
  );
  const blob = new Blob([res.data], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  return { blob, url, language: languageCode, languageName: languageName(languageCode) };
}

export { aiError, languageName };
