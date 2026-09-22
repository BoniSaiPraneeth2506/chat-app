// ── Server-side Sarvam AI client ─────────────────────────────────────────────
//
// The only module that talks to Sarvam's APIs. The API key is read from the
// server environment (SARVAM_API_KEY, loaded by dotenv in index.js) and is
// NEVER exposed to the React/Capacitor client — the frontend only ever calls
// our own /api/ai/* endpoints.
//
// Every network call is guarded so a missing key or upstream error surfaces as
// a typed error the controller can turn into a friendly message.
//
// Official endpoints (see https://docs.sarvam.ai):
//   POST /translate        -> { translated_text, source_language_code }
//   POST /transliterate    -> { transliterated_text, source_language_code }
//   POST /text-lid         -> { language_code, script_code }
//   POST /text-to-speech   -> { audios: [ base64 ] }
//   POST /v1/audio/speech-to-text -> { text } (multipart; model saaras:v3)
// Auth header for all: `api-subscription-key: <key>`.

const SARVAM_BASE = "https://api.sarvam.ai";

// Translate supports automatic source detection via "auto" on mayura:v1.
const TRANSLATION_MODEL = "mayura:v1";

// TTS model + speaker. bulbul:v3, default voice "shubh".
const TTS_MODEL = "bulbul:v3";
const TTS_SPEAKER = "shubh";

// Speech-to-text model.
const STT_MODEL = "saaras:v3";
const STT_MODE = "transcribe";

// How long we wait on Sarvam before giving up (ms). TTS can take a moment.
const TIMEOUT_MS = 60000;

class SarvamError extends Error {
  constructor(message, code = "upstream_error", status = 502) {
    super(message);
    this.name = "SarvamError";
    this.code = code;
    this.status = status;
  }
}

let cachedKey = null;
function apiKey() {
  // Cache only the *presence*, never log the value.
  if (cachedKey === null) cachedKey = process.env.SARVAM_API_KEY || "";
  return cachedKey;
}

export function isSarvamConfigured() {
  return Boolean(apiKey());
}

/** Shared POST helper: builds request, sends, normalizes errors. */
async function sarvamPost(path, body, { raw = false, timeout = TIMEOUT_MS } = {}) {
  if (!apiKey()) {
    throw new SarvamError("AI is not configured on this server yet", "not_configured", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(`${SARVAM_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new SarvamError("AI is taking too long — try again in a moment", "timeout", 504);
    }
    throw new SarvamError("Could not reach the AI service", "network", 502);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();

  if (!res.ok) {
    // Surface a readable reason without leaking the key or raw internals.
    let detail = "";
    try {
      const parsed = JSON.parse(text);
      detail = typeof parsed?.message === "string" ? parsed.message : "";
      if (!detail && typeof parsed?.error_message === "string") detail = parsed.error_message;
    } catch { /* non-JSON body */ }

    if (res.status === 429) {
      throw new SarvamError("Too many AI requests — try again in a moment", "rate_limited", 429);
    }
    if (res.status === 401 || res.status === 403) {
      throw new SarvamError("AI service rejected the request — check server config", "auth", 502);
    }
    throw new SarvamError(
      detail || "AI service returned an error — try again in a moment",
      "upstream_error",
      res.status >= 500 ? 502 : 422
    );
  }

  if (raw) return { status: res.status, text };
  try {
    return JSON.parse(text);
  } catch {
    throw new SarvamError("AI service returned an unexpected response", "upstream_error", 502);
  }
}

/**
 * Translate `input` to `targetLanguageCode`, letting Sarvam auto-detect the
 * source language. Returns { translatedText, sourceLanguage }.
 */
export async function sarvamTranslate(input, targetLanguageCode) {
  const data = await sarvamPost("/translate", {
    input,
    source_language_code: "auto",
    target_language_code: targetLanguageCode,
    model: TRANSLATION_MODEL,
    numerals_format: "international",
    mode: "formal",
  });
  return {
    translatedText: data?.translated_text || "",
    sourceLanguage: data?.source_language_code || "",
  };
}

/**
 * Identify the language (and optionally script) of `input`.
 * Returns { languageCode, scriptCode }.
 */
export async function sarvamIdentifyLanguage(input) {
  const data = await sarvamPost("/text-lid", { input });
  return {
    languageCode: data?.language_code || "",
    scriptCode: data?.script_code || "",
  };
}

/**
 * Transliterate `input` from `sourceLanguageCode` to `targetLanguageCode`.
 * Returns { transliteratedText, sourceLanguage }.
 */
export async function sarvamTransliterate(input, sourceLanguageCode, targetLanguageCode) {
  const data = await sarvamPost("/transliterate", {
    input,
    source_language_code: sourceLanguageCode,
    target_language_code: targetLanguageCode,
    numerals_format: "international",
  });
  return {
    transliteratedText: data?.transliterated_text || "",
    sourceLanguage: data?.source_language_code || "",
  };
}

/**
 * Synthesize speech for `input` in `languageCode`.
 * Returns decoded MP3 bytes (Buffer) by asking Sarvam for MP3 and decoding the
 * base64 `audios[]` from its REST endpoint.
 */
export async function sarvamTextToSpeech(input, languageCode) {
  const data = await sarvamPost("/text-to-speech", {
    text: input,
    language_code: languageCode,
    model: TTS_MODEL,
    speaker: TTS_SPEAKER,
    output_audio_codec: "mp3",
    speech_sample_rate: 24000,
  });
  const joined = Array.isArray(data?.audios) ? data.audios.join("") : "";
  if (!joined) {
    throw new SarvamError("AI returned no audio", "upstream_error", 502);
  }
  return Buffer.from(joined, "base64");
}

/**
 * Transcribe spoken `audio` (raw bytes) to text using the saaras:v3 model.
 *
 * Sarvam's REST endpoint takes a multipart file upload, so the shared JSON
 * helper can't serve it. The error handling mirrors sarvamPost so a missing
 * key, an abort, or an upstream failure all surface identically to callers.
 */
export async function sarvamSpeechToText(audioBuffer, mime = "audio/webm") {
  if (!apiKey()) {
    throw new SarvamError("AI is not configured on this server yet", "not_configured", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const form = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mime });
  const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : mime.includes("mp3") ? "mp3" : "wav";
  form.append("file", blob, `audio.${ext}`);
  form.append("model", STT_MODEL);
  form.append("mode", STT_MODE);

  let res;
  try {
    res = await fetch(`${SARVAM_BASE}/v1/audio/speech-to-text`, {
      method: "POST",
      headers: { "api-subscription-key": apiKey() },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new SarvamError("Speech recognition took too long — try again", "timeout", 504);
    }
    throw new SarvamError("Could not reach the AI service", "network", 502);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      const parsed = JSON.parse(text);
      detail = typeof parsed?.message === "string" ? parsed.message : "";
      if (!detail && typeof parsed?.error_message === "string") detail = parsed.error_message;
    } catch { /* non-JSON body */ }
    throw new SarvamError(
      detail || "Speech recognition failed — try again in a moment",
      "upstream_error",
      res.status >= 500 ? 502 : 422
    );
  }

  let data = {};
  try {
    data = JSON.parse(text);
  } catch { /* non-JSON body */ }

  const transcript =
    (typeof data?.text === "string" && data.text) ||
    (Array.isArray(data?.transcripts) && typeof data.transcripts[0]?.text === "string"
      ? data.transcripts[0].text
      : "");

  if (!transcript) {
    throw new SarvamError("Nothing was heard — try speaking a little closer", "upstream_error", 422);
  }
  return { text: transcript, languageCode: data?.language_code || "" };
}
