import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("chat-theme") || "dark",
  wallpaper: localStorage.getItem("chat-wallpaper") || "default",
  soundEnabled: localStorage.getItem("sound-enabled") !== "false",
  privacyReadReceipts: localStorage.getItem("privacy-read-receipts") !== "false",
  
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
}));