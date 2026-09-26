import { create } from "zustand";

// App lock - a launch gate in front of the whole app.
//
// When turned on (Settings > App lock) every fresh start sits behind a lock
// screen: fingerprint/face when the phone offers it, otherwise a 4+ digit PIN
// you chose. Store layout mirrors the per-chat lock (useChatLockStore) so the
// two feel like one feature:
//
//  * persisted fields - on/pinHash/hint/bioStored - live in localStorage so a
//    reload remembers the setting
//  * the session "unlocked" flag is NOT persisted, so every launch starts
//    locked; that is the entire point of an app lock
//
// The PIN is stored only as a hash (never clear text). Biometry unlocks the
// same way the chat lock does: the PIN secret is stored for the phone's
// scanner to release, keyed by the current user id, and hashing it is the only
// check that matters.

const LS_KEY = "chatty:appLock";

const hashPin = (pin) => {
  let h = 5381;
  const s = String(pin || "");
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return "h" + h.toString(36);
};

const readRaw = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return {
      on: Boolean(obj?.on),
      pinHash: String(obj?.pinHash || ""),
      hint: String(obj?.hint || ""),
      bioStored: Boolean(obj?.bioStored),
      question: String(obj?.question || ""),
      answerHash: String(obj?.answerHash || ""),
    };
  } catch {
    return { on: false, pinHash: "", hint: "", bioStored: false, question: "", answerHash: "" };
  }
};

const DEFAULTS = {
  on: false,
  pinHash: "",
  hint: "",
  bioStored: false,
  question: "",
  answerHash: "",
  // session only
  isUnlocked: false,
  isBusy: false,
  error: "",
  pinAttempts: 0,
};

const persist = (patch) => {
  const next = { ...readRaw(), ...patch };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
};

export const useAppLockStore = create((set, get) => ({
  ...DEFAULTS,
  ...readRaw(),

  enable: ({ pin, hint, question, answer }) => {
    if (!pin || pin.length < 4) {
      set({ error: "PIN must be at least 4 digits" });
      return false;
    }
    if (!String(question || "").trim() || !String(answer || "").trim()) {
      set({ error: "Security question and answer are required" });
      return false;
    }
    const normalized = String(answer).trim().toLowerCase();
    const next = persist({
      on: true,
      pinHash: hashPin(pin),
      hint: String(hint || ""),
      question: String(question).trim(),
      answerHash: hashPin(normalized),
    });
    set({ ...next, isUnlocked: true, error: "", pinAttempts: 0 });
    return true;
  },

  disable: () => {
    const next = persist({ on: false, pinHash: "", hint: "", bioStored: false, question: "", answerHash: "" });
    set({ ...next, isUnlocked: false, error: "", pinAttempts: 0 });
    return true;
  },

  // Relock on demand (e.g. a "Lock now" button, or after a timed session).
  relock: () => set({ isUnlocked: false, error: "", pinAttempts: 0, isBusy: false }),

  setBioStored: (v) => {
    const next = persist({ bioStored: Boolean(v) });
    set({ ...next });
  },

  verify: (pin) => {
    const state = get();
    if (hashPin(pin) === state.pinHash) {
      set({ isUnlocked: true, error: "", isBusy: false, pinAttempts: 0 });
      return true;
    }
    set({ isBusy: false, error: "Wrong PIN", pinAttempts: state.pinAttempts + 1 });
    return false;
  },

  // Called after a successful biometry scan releases the stored PIN secret.
  unlockWithSecret: (secret) => {
    const state = get();
    if (hashPin(secret) === state.pinHash) {
      set({ isUnlocked: true, error: "", isBusy: false, pinAttempts: 0 });
      return true;
    }
    set({ isBusy: false, error: "Stored fingerprint no longer matches" });
    return false;
  },

  // PIN unlock used by the launch gate.
  unlock: (pin) => {
    const state = get();
    if (hashPin(pin) === state.pinHash) {
      set({ isUnlocked: true, error: "", isBusy: false, pinAttempts: 0 });
      return true;
    }
    set({ isBusy: false, error: "Wrong PIN", pinAttempts: state.pinAttempts + 1 });
    return false;
  },

  // Recovery: the security answer releases the lock, so a forgotten PIN cannot
  // lock the app forever.
  recoverWithAnswer: async (answer) => {
    const state = get();
    const normalized = String(answer || "").trim().toLowerCase();
    if (state.answerHash && hashPin(normalized) === state.answerHash) {
      set({ isUnlocked: true, error: "", isBusy: false, pinAttempts: 0 });
      return true;
    }
    set({ isBusy: false, error: "Wrong answer", pinAttempts: state.pinAttempts + 1 });
    return false;
  },

  setBusy: (v) => set({ isBusy: Boolean(v) }),
  setError: (msg) => set({ error: String(msg || "") }),
  clearError: () => set({ error: "" }),
}));

export const appLockEnabled = () =>
  Boolean(readRaw().on);
export const appLockPinHash = () => readRaw().pinHash;

export default useAppLockStore;
