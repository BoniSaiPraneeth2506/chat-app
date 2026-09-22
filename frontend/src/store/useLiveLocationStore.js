import { create } from "zustand";
import useAuthStore from "./useAuthStore";

// Holds the *live* coordinate state for location-sharing messages.
//
// Sender side: a `liveUpdates` entry per messageId is written by the sender's
// own heartbeat interval; the socket also relays the sharer's point back to
// their other devices. Recipient side: `liveUpdates` is fed purely by the
// `liveLocation:update` socket frames.
//
// `activeShares` tracks what the map modal should render (any share that is
// live and unexpired for the currently open chat).
const useLiveLocationStore = create((set, get) => ({
  // messageId -> { lat, lng, updatedAt, sharerId, recipientId }
  liveUpdates: {},

  // The currently open live shares relevant to the open chat. Populated by the
  // map modal; used by bubbles to know whether to show a "live" pulse.
  openShares: {},

  // ids of shares the sharer stopped (or that expired while online), so
  // bubbles can drop the LIVE badge and stop rendering moving avatars.
  stoppedShareIds: {},

  markStopped: (messageId) =>
    set((state) => ({
      stoppedShareIds: { ...state.stoppedShareIds, [String(messageId)]: true },
    })),

  clearStopped: (messageId) =>
    set((state) => {
      const next = { ...state.stoppedShareIds };
      delete next[String(messageId)];
      return { stoppedShareIds: next };
    }),

  setLiveUpdate: (messageId, payload) =>
    set((state) => ({
      liveUpdates: {
        ...state.liveUpdates,
        [String(messageId)]: {
          ...state.liveUpdates[String(messageId)],
          lat: payload.lat,
          lng: payload.lng,
          updatedAt: Date.now(),
          sharerId: payload.sharerId,
          recipientId: payload.recipientId,
        },
      },
    })),

  setOpenShare: (messageId, share) =>
    set((state) => ({
      openShares: { ...state.openShares, [String(messageId)]: share },
    })),

  clearOpenShare: (messageId) =>
    set((state) => {
      const next = { ...state.openShares };
      delete next[String(messageId)];
      return { openShares: next };
    }),

  subscribeToLiveLocation: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("liveLocation:update");
    socket.off("liveLocation:stopped");

    socket.on("liveLocation:update", (payload) => {
      if (!payload?.messageId) return;
      get().setLiveUpdate(payload.messageId, payload);
    });

    socket.on("liveLocation:stopped", ({ messageId }) => {
      if (!messageId) return;
      get().markStopped(messageId);
      set((state) => {
        const next = { ...state.liveUpdates };
        delete next[String(messageId)];
        const open = { ...state.openShares };
        delete open[String(messageId)];
        return { liveUpdates: next, openShares: open };
      });
    });
  },

  resetLiveLocation: () =>
    set({ liveUpdates: {}, openShares: {}, stoppedShareIds: {} }),
}));

export default useLiveLocationStore;