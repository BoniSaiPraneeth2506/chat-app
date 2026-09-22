// ── Per-conversation notification mute (client-side) ─────────────────────────
// Stored in localStorage as { "<conversationId>": <expiresAt> } where
//   -1  → muted forever
//   n   → muted until that epoch ms
// An absent entry means not muted. The value is the conversation key used by
// the backend for notifications: the other user's id for 1:1 chats and the
// group id for groups.

const KEY = "chatty:mutedChats";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — mute won't persist
  }
}

/** True while the conversation is muted (never expires counts as muted). */
export function isChatMuted(conversationId) {
  if (!conversationId) return false;
  const until = read()[String(conversationId)];
  if (until === undefined || until === null) return false;
  if (until === -1) return true;
  return until > Date.now();
}

/** Expiry timestamp (-1 = forever, null = not muted) for UI display. */
export function muteStateOf(conversationId) {
  if (!conversationId) return null;
  const until = read()[String(conversationId)];
  return until === undefined || until === null ? null : until;
}

/** Mute for `ms` ms; pass null to mute until you unmute. */
export function muteConversation(conversationId, ms = null) {
  if (!conversationId) return;
  const map = read();
  map[String(conversationId)] = ms === null ? -1 : Date.now() + ms;
  write(map);
}

export function unmuteConversation(conversationId) {
  if (!conversationId) return;
  const map = read();
  delete map[String(conversationId)];
  write(map);
}