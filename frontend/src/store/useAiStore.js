// ── Per-message Sarvam AI state ─────────────────────────────────────────────
//
// Kept outside the chat store so message data stays untouched. Each entry is
// keyed by message id and holds whatever the user asked for (a translation,
// a script change, and/or a synthesized-audio blob url). Object URLs are
// revoked when cleared so we don't leak memory on long chats.

import { create } from "zustand";

const emptyEntry = () => ({
  translatedText: null,
  translatedSource: null,
  translatedTarget: null,
  transliteratedText: null,
  transliteratedSource: null,
  transliteratedScript: null,
  transliteratedTarget: null,
  audioUrl: null,
  audioLanguage: null,
  audioLoading: false,
  audioPlaying: false,
});

function revoke(entry) {
  if (entry?.audioUrl) {
    try {
      URL.revokeObjectURL(entry.audioUrl);
    } catch {
      /* best effort */
    }
  }
}

export const useAiStore = create((set, get) => ({
  byMessage: {},

  entry: (id) => get().byMessage[id] || emptyEntry(),

  setTranslation: (id, { translatedText, sourceLanguage, targetLanguage }) =>
    set((state) => {
      const entry = { ...(state.byMessage[id] || emptyEntry()) };
      return {
        byMessage: {
          ...state.byMessage,
          [id]: {
            ...entry,
            translatedText,
            translatedSource: sourceLanguage || null,
            translatedTarget: targetLanguage || null,
          },
        },
      };
    }),

  clearTranslation: (id) =>
    set((state) => {
      const entry = state.byMessage[id];
      if (!entry) return {};
      return {
        byMessage: {
          ...state.byMessage,
          [id]: {
            ...entry,
            translatedText: null,
            translatedSource: null,
            translatedTarget: null,
          },
        },
      };
    }),

  setTransliteration: (id, { text, sourceLanguage, sourceScript, targetLanguage }) =>
    set((state) => {
      const entry = { ...(state.byMessage[id] || emptyEntry()) };
      return {
        byMessage: {
          ...state.byMessage,
          [id]: {
            ...entry,
            transliteratedText: text,
            transliteratedSource: sourceLanguage || null,
            transliteratedScript: sourceScript || null,
            transliteratedTarget: targetLanguage || null,
          },
        },
      };
    }),

  clearTransliteration: (id) =>
    set((state) => {
      const entry = state.byMessage[id];
      if (!entry) return {};
      return {
        byMessage: {
          ...state.byMessage,
          [id]: {
            ...entry,
            transliteratedText: null,
            transliteratedSource: null,
            transliteratedScript: null,
            transliteratedTarget: null,
          },
        },
      };
    }),

  setAudio: (id, patch) =>
    set((state) => {
      const entry = { ...(state.byMessage[id] || emptyEntry()) };
      if (patch.audioUrl && entry.audioUrl !== patch.audioUrl) revoke(entry);
      const next = { ...entry, ...patch };
      if (!next.audioUrl) next.audioLoading = false;
      return {
        byMessage: { ...state.byMessage, [id]: next },
      };
    }),

  clearAudio: (id) =>
    set((state) => {
      const entry = state.byMessage[id];
      if (!entry) return state;
      revoke(entry);
      return {
        byMessage: {
          ...state.byMessage,
          [id]: { ...entry, audioUrl: null, audioLanguage: null, audioLoading: false, audioPlaying: false },
        },
      };
    }),

  clearMessage: (id) =>
    set((state) => {
      const entry = state.byMessage[id];
      if (entry) revoke(entry);
      // eslint-disable-next-line no-unused-vars
      const { [id]: _removed, ...rest } = state.byMessage;
      return { byMessage: rest };
    }),
}));
