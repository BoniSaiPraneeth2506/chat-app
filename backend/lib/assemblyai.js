import { AssemblyAI } from "assemblyai";

/**
 * AssemblyAI speech-to-text for voice notes.
 *
 * The key is read from the environment here and nowhere else. It must never
 * reach a client, so no route echoes it and no response includes it.
 *
 * The client is built on first use rather than at import time, and that is not
 * incidental: ESM hoists every import, so `dotenv.config()` in index.js runs
 * *after* the modules it imports have already initialised. Reading
 * process.env at module scope would therefore see undefined. The other libs here
 * work around it by each calling dotenv themselves; deferring the read removes
 * the ordering question entirely, since by the time a request arrives the
 * environment is certainly loaded.
 *
 * Voice notes are already on Cloudinary as public secure_urls, so transcription
 * runs straight from that URL — re-uploading the audio would cost bandwidth and
 * a second copy for no gain.
 */

let client = null;
let warned = false;

const getClient = () => {
  if (client) return client;

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    if (!warned) {
      console.warn("[assemblyai] ASSEMBLYAI_API_KEY is not set — transcription is disabled");
      warned = true;
    }
    return null;
  }

  client = new AssemblyAI({ apiKey });
  return client;
};

/** Whether the server can transcribe at all; a deployment without the key simply cannot. */
export const isTranscriptionConfigured = () => Boolean(process.env.ASSEMBLYAI_API_KEY);

/**
 * Transcribes a publicly reachable audio URL.
 *
 * `transcripts.transcribe` submits and then polls until the job reaches a
 * terminal state, so there is no polling loop here. It is called from a
 * background task rather than inside a request: a voice note can take tens of
 * seconds and no HTTP client should be held open that long.
 *
 * No extra analysis is enabled — no speaker labels, no summarisation, no
 * redaction, no language detection. Each is billed on top of the base
 * transcription and none is needed to show text under a voice note.
 *
 * Returns a normalised result, so callers never handle AssemblyAI's vocabulary
 * directly (its terminal states are "completed" and "error").
 */
export const transcribeAudioUrl = async (audioUrl) => {
  const ai = getClient();
  if (!ai) return { ok: false, error: "Transcription is not configured on the server" };

  try {
    const result = await ai.transcripts.transcribe({ audio: audioUrl });

    if (result.status === "error") {
      // This message describes the audio rather than our infrastructure, so it
      // is safe to surface — capped so a long upstream string cannot become an
      // unbounded document field.
      return {
        ok: false,
        id: result.id || "",
        error: (result.error || "Transcription failed").slice(0, 300),
      };
    }

    return {
      ok: true,
      id: result.id || "",
      text: (result.text || "").trim(),
      language: result.language_code || "",
    };
  } catch (err) {
    // Network failure, invalid key, exhausted quota. The detail is logged for us
    // and a generic message goes back, so nothing about the account or the
    // request reaches a client.
    console.error("[assemblyai] transcription request failed:", err?.message || err);
    return { ok: false, error: "Could not reach the transcription service" };
  }
};
