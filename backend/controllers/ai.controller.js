// ── Sarvam AI endpoints: translate / transliterate / text-to-speech ─────────
//
// All three routes require a signed-in user (protectRoute) — otherwise anyone
// could burn the account's free-tier Sarvam quota. Validation + limits mirror
// the official Sarvam caps; errors are returned as readable sentences and
// never leak the API key or raw upstream internals.

import {
  isSarvamConfigured,
  sarvamTranslate,
  sarvamIdentifyLanguage,
  sarvamTransliterate,
  sarvamTextToSpeech,
} from "../lib/sarvam.js";

// ── Supported languages ──────────────────────────────────────────────────────
// The user-facing pickers start with these; the codes are official Sarvam
// BCP-47 identifiers. More can be added here and they light up automatically.
export const AI_LANGUAGES = [
  { code: "en-IN", name: "English", script: "Latin" },
  { code: "hi-IN", name: "Hindi", script: "Devanagari" },
  { code: "te-IN", name: "Telugu", script: "Telugu" },
  { code: "ta-IN", name: "Tamil", script: "Tamil" },
  { code: "kn-IN", name: "Kannada", script: "Kannada" },
  { code: "ml-IN", name: "Malayalam", script: "Malayalam" },
];

const ALLOWED_CODES = new Set(AI_LANGUAGES.map((l) => l.code));

// Character caps from the official Sarvam docs.
const TRANSLATE_MAX = 1000; // mayura:v1
const TRANSLITERATE_MAX = 1000; // LID / transliterate practical cap
const TTS_MAX = 2500; // bulbul:v3 REST

// ── Per-user AI rate limiting (in-memory) ──────────────────────────────────
// The built-in rate-limit middleware is a no-op in this app, so AI gets its
// own simple limiter to protect the free-tier quota.
const LIMIT = 8; // requests per user per window
const WINDOW_MS = 60 * 1000;
const hits = new Map(); // userId -> { count, resetAt }

function rateLimited(userId) {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now > entry.resetAt) {
    hits.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

// ── Shared validation helper ────────────────────────────────────────────────
function validateText(text, max, label) {
  if (typeof text !== "string" || !text.trim()) {
    return { message: `${label} is missing or empty` };
  }
  const trimmed = text.trim();
  if (trimmed.length > max) {
    return { message: `${label} is too long (max ${max} characters)` };
  }
  return { value: trimmed };
}

function validCode(code) {
  return typeof code === "string" && ALLOWED_CODES.has(code);
}

export const getAiLanguages = (_req, res) => {
  res.status(200).json({ languages: AI_LANGUAGES });
};

/** POST /api/ai/translate — body { text, targetLanguage } */
export const translate = async (req, res) => {
  try {
    if (!isSarvamConfigured()) {
      return res.status(503).json({ message: "AI is not set up on this server yet" });
    }
    if (rateLimited(req.user._id.toString())) {
      return res.status(429).json({ message: "Too many AI requests — try again in a moment" });
    }

    const textVal = validateText(req.body?.text, TRANSLATE_MAX, "Text");
    if (textVal.message) return res.status(400).json({ message: textVal.message });
    if (!validCode(req.body?.targetLanguage)) {
      return res.status(400).json({ message: "Pick a valid target language" });
    }

    const result = await sarvamTranslate(textVal.value, req.body.targetLanguage);
    res.status(200).json({
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage || "",
      targetLanguage: req.body.targetLanguage,
    });
  } catch (err) {
    console.error("Error in ai/translate:", err.code || "", err.message);
    return res.status(err.status || 502).json({ message: err.message });
  }
};

/**
 * POST /api/ai/transliterate — body { text, targetLanguage }
 * Determines the source language via LID when needed, then transliterates.
 */
export const transliterate = async (req, res) => {
  try {
    if (!isSarvamConfigured()) {
      return res.status(503).json({ message: "AI is not set up on this server yet" });
    }
    if (rateLimited(req.user._id.toString())) {
      return res.status(429).json({ message: "Too many AI requests — try again in a moment" });
    }

    const textVal = validateText(req.body?.text, TRANSLITERATE_MAX, "Text");
    if (textVal.message) return res.status(400).json({ message: textVal.message });
    if (!validCode(req.body?.targetLanguage)) {
      return res.status(400).json({ message: "Pick a valid target script" });
    }

    // The transliterate API needs an explicit source (no "auto"), so detect it
    // first using the official language-identification endpoint.
    const lid = await sarvamIdentifyLanguage(textVal.value);
    let source = lid.languageCode;
    if (!source || !ALLOWED_CODES.has(source)) {
      // Fall back to English when detection is inconclusive; the API refuses
      // anything outside its supported set.
      source = "en-IN";
    }
    const sourceScript = lid.scriptCode || "";

    const result = await sarvamTransliterate(textVal.value, source, req.body.targetLanguage);
    res.status(200).json({
      transliteratedText: result.transliteratedText,
      sourceLanguage: source,
      sourceScript,
      targetLanguage: req.body.targetLanguage,
    });
  } catch (err) {
    console.error("Error in ai/transliterate:", err.code || "", err.message);
    return res.status(err.status || 502).json({ message: err.message });
  }
};

/**
 * POST /api/ai/text-to-speech — body { text, languageCode? }
 * Returns raw MP3 audio bytes the client can play back / cache as a blob.
 * When languageCode is omitted the source language is auto-detected first so
 * the client's "Listen" action needs no picker.
 */
export const textToSpeech = async (req, res) => {
  try {
    if (!isSarvamConfigured()) {
      return res.status(503).json({ message: "AI is not set up on this server yet" });
    }
    if (rateLimited(req.user._id.toString())) {
      return res.status(429).json({ message: "Too many AI requests — try again in a moment" });
    }

    const textVal = validateText(req.body?.text, TTS_MAX, "Text");
    if (textVal.message) return res.status(400).json({ message: textVal.message });

    let languageCode = req.body?.languageCode;
    if (!languageCode) {
      // No language supplied: detect it so "Listen" works in one tap.
      const lid = await sarvamIdentifyLanguage(textVal.value);
      languageCode = lid.languageCode;
      if (!validCode(languageCode)) languageCode = "en-IN";
    } else if (!validCode(languageCode)) {
      return res.status(400).json({ message: "Pick a valid language" });
    }

    const audio = await sarvamTextToSpeech(textVal.value, languageCode);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (err) {
    console.error("Error in ai/text-to-speech:", err.code || "", err.message);
    if (res.headersSent) return res.end();
    return res.status(err.status || 502).json({ message: err.message });
  }
};
