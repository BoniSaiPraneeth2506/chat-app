import { create } from "zustand";

// Controls the full-screen interactive map modal. Both LocationContent bubbles
// and the composer's live-share flow open it through openLocationModal().
const useLocationModalStore = create((set) => ({
  open: false,
  message: null, // the location message being viewed
  isLive: false,
  // For the composer's "live share" (no message yet): the starting coords.
  drafting: null, // { lat, lng, isLive, duration } -> sends a new message
  senderName: "",
  onClose: null,

  openModal: (message, isLive, opts = {}) =>
    set({
      open: true,
      message,
      isLive,
      drafting: opts.drafting || null,
      senderName: opts.senderName || "",
      onClose: opts.onClose || null,
    }),

  closeModal: () => {
    const cb = useLocationModalStore.getState().onClose;
    set({ open: false, message: null, isLive: false, drafting: null, onClose: null });
    if (typeof cb === "function") try { cb(); } catch {}
  },
}));

export default useLocationModalStore;
