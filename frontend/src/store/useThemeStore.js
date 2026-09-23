import { create } from "zustand";

export const TEXT_SIZES = [
  { id: "small", label: "Small", scale: 0.86 },
  { id: "medium", label: "Medium", scale: 1 },
  { id: "large", label: "Large", scale: 1.14 },
  { id: "extra-large", label: "Extra Large", scale: 1.28 },
];

// Named bubble palettes. "auto" keeps the default per-app scheme tinted by each
// preset's primary colour so a preset can be swapped without a full re-theme.
export const BUBBLE_STYLES = [
  { id: "auto", label: "Default", primary: "#1b3a6b", accent: "#0f2440" },
  { id: "ocean", label: "Ocean Blue", primary: "#06365c", accent: "#0b223d" },
  { id: "mint", label: "Mint Green", primary: "#085f4a", accent: "#0a3b30" },
  { id: "royal", label: "Royal Purple", primary: "#4c2b7a", accent: "#2c1747" },
  { id: "sunset", label: "Sunset Orange", primary: "#b2452a", accent: "#6b261a" },
  { id: "pink", label: "Bubblegum", primary: "#a94b6e", accent: "#632b41" },
  { id: "slate", label: "Graphite", primary: "#2e3a4a", accent: "#1b2430" },
  { id: "gold", label: "Gold", primary: "#8a6a1c", accent: "#554211" },
];

const safeJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const useThemeStore = create((set, get) => ({
  theme: localStorage.getItem("chat-theme") || "dark",
  wallpaper: localStorage.getItem("chat-wallpaper") || "default",
  soundEnabled: localStorage.getItem("sound-enabled") !== "false",
  privacyReadReceipts: localStorage.getItem("privacy-read-receipts") !== "false",
  textSize: localStorage.getItem("chat-text-size") || "medium",
  // Bubble palette preset for the whole app, and per-chat overrides read from
  // localStorage as { chatId: presetId }.
  bubbleStyle: (() => {
    const id = localStorage.getItem("chat-bubble-style") || "auto";
    return BUBBLE_STYLES.find((s) => s.id === id) || BUBBLE_STYLES[0];
  })(),
  bubbleOverrides: safeJson("chat-bubble-overrides", {}),

  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme);
    set({ theme });
  },
  setWallpaper: (wallpaper) => {
    localStorage.setItem("chat-wallpaper", wallpaper);
    set({ wallpaper });
  },
  setSoundEnabled: (enabled) => {
    localStorage.setItem("sound-enabled", String(enabled));
    set({ soundEnabled: enabled });
  },
  setPrivacyReadReceipts: (enabled) => {
    localStorage.setItem("privacy-read-receipts", String(enabled));
    set({ privacyReadReceipts: enabled });
  },
  setTextSize: (textSize) => {
    localStorage.setItem("chat-text-size", String(textSize));
    set({ textSize });
  },
  setBubbleStyle: (styleId) => {
    localStorage.setItem("chat-bubble-style", String(styleId));
    const bubbleStyle = BUBBLE_STYLES.find((s) => s.id === styleId) || BUBBLE_STYLES[0];
    set({ bubbleStyle });
  },
  setBubbleOverride: (chatId, styleId) => {
    const bubbleOverrides = { ...get().bubbleOverrides };
    if (!styleId || styleId === "auto") delete bubbleOverrides[chatId];
    else bubbleOverrides[chatId] = styleId;
    localStorage.setItem("chat-bubble-overrides", JSON.stringify(bubbleOverrides));
    set({ bubbleOverrides });
  },

  // Resolve the active bubble palette for a chat (per-chat override wins).
  bubbleStyleFor: (chatId, groupId) => {
    const key = String(groupId || chatId || "");
    const id = get().bubbleOverrides[key];
    if (id) return BUBBLE_STYLES.find((s) => s.id === id) || BUBBLE_STYLES[0];
    return get().bubbleStyle;
  },
}));