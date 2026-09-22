import useAuthStore from "../store/useAuthStore";
import { getCurrentPosition } from "./location";

// ── Live location share heartbeat engine ────────────────────────────────────
//
// While the current user has an ACTIVE live share (their `location.isLive`
// message that hasn't expired/stopped), this broadcasts their position to the
// server via `liveLocation:update` frames about every 4s. The server relays
// each frame to both parties so the other person's map marker actually moves.
//
// Shares are tracked per (messageId) and auto-stopped when their expiresAt
// passes while the app is alive.

const activeTickers = new Map(); // messageId -> { timer, expiresAt, stop }

function emitUpdate(messageId, recipientId, duration) {
  const socket = useAuthStore.getState().socket;
  if (!socket?.connected) return;
  getCurrentPosition()
    .then(({ lat, lng }) => {
      socket.emit("liveLocation:update", { messageId, lat, lng, recipientId, duration });
    })
    .catch(() => {
      // Keep the share alive but skip this frame — transient GPS failures
      // shouldn't kill an ongoing live share.
    });
}

/**
 * Start (or refresh) the heartbeat for a live share the current user sent.
 * Call with the confirmed live location message.
 */
export function startLiveShareTicker(message, recipientId) {
  const loc = message?.location;
  if (!loc?.isLive || loc.stop) return;
  const id = String(message._id || message.tempId);
  const expiresAt = loc.expiresAt ? new Date(loc.expiresAt).getTime() : Date.now() + loc.duration * 60 * 1000;

  const existing = activeTickers.get(id);
  if (existing) {
    existing.expiresAt = expiresAt;
    existing.recipientId = recipientId;
    return;
  }

  // Fire one immediately, then every 4s.
  emitUpdate(id, recipientId, loc.duration);
  const timer = setInterval(() => {
    if (Date.now() >= expiresAt) {
      stopLiveShareTicker(id);
      return;
    }
    emitUpdate(id, recipientId, loc.duration);
  }, 4000);

  activeTickers.set(id, { timer, expiresAt, recipientId });
}

/** Stop the heartbeat for a live share (message id). */
export function stopLiveShareTicker(messageId) {
  const id = String(messageId);
  const ticker = activeTickers.get(id);
  if (ticker) {
    clearInterval(ticker.timer);
    activeTickers.delete(id);
  }
}

/** Stop every live share the current user has active (logout / chat switch). */
export function stopAllLiveShareTickers() {
  for (const [, ticker] of activeTickers) clearInterval(ticker.timer);
  activeTickers.clear();
}
