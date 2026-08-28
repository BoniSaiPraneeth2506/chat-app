// ── Shared speech-audio controller ──────────────────────────────────────────
//
// One global <audio> element is reused so only a single message can be spoken
// at a time (matching WhatsApp's Listen behaviour). A module-level object URL
// is created from the MP3 blob and swapped when another message starts playing.
//
// The caller (useAiStore) owns the object URL lifecycle for persistence; this
// module derails the <audio> element, which uses whatever URL is handed to it.

let el = null;
let currentSource = null; // { msgId, url }

function element() {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
  }
  return el;
}

export function isPlaying(msgId) {
  return Boolean(currentSource && currentSource.msgId === msgId && !element().paused);
}

/**
 * Play `url` for `msgId`. Stops whatever was playing before. Resolves when
 * playback actually starts; rejects on error. Calls onEnd (if provided) when
 * the clip finishes naturally.
 */
export function playAudio(msgId, url, onEnd, onError) {
  const audio = element();
  audio.pause();
  audio.src = "";
  audio.load();

  audio.onended = () => {
    if (currentSource?.msgId === msgId) currentSource = null;
    if (onEnd) onEnd();
  };
  audio.onerror = () => {
    if (onError) onError();
  };

  currentSource = { msgId, url };
  audio.src = url;

  return audio.play().catch((err) => {
    if (onError) onError(err);
  });
}

export function stopAudio(msgId) {
  if (currentSource && currentSource.msgId === msgId) {
    element().pause();
    element().src = "";
    currentSource = null;
  }
}

export function stopAllAudio() {
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
  currentSource = null;
}
