// Local offline cache, backed by IndexedDB via Dexie.
//
// Goal: the app should feel like WhatsApp — chats and messages paint
// instantly from what's already on the device, while the network call to
// confirm/refresh runs in the background. This module is the only place
// that talks to IndexedDB; the stores never touch Dexie directly.
//
// Every exported function is intentionally non-throwing: IndexedDB can be
// unavailable (Safari private browsing), full (quota exceeded), or just not
// present in some embedded WebViews. None of that should ever break the app
// — callers can call these fire-and-forget and simply get "no cache" back.
import Dexie from "dexie";

// One database per signed-in user, so a shared device/browser never mixes
// one account's cached messages into another's.
const dbInstances = new Map();

const getUserDb = (userId) => {
  if (!userId) return null;
  if (dbInstances.has(userId)) return dbInstances.get(userId);

  const db = new Dexie(`chatty_cache_${userId}`);
  db.version(1).stores({
    // conversationKey: "dm:<userId>" or "group:<groupId>"
    messages: "_id, conversationKey, createdAt",
    // Small arbitrary JSON blobs keyed by name — sidebar lists, etc.
    conversationsMeta: "key",
    // Messages composed while offline, waiting to be sent once reconnected.
    outbox: "tempId, conversationKey, createdAt",
  });
  dbInstances.set(userId, db);
  return db;
};

export const cacheMessages = async (userId, conversationKey, messages) => {
  const db = getUserDb(userId);
  if (!db || !Array.isArray(messages) || messages.length === 0) return;
  try {
    // Never cache an unconfirmed optimistic message (tempId === _id) — only
    // server-confirmed messages have a stable id worth persisting.
    const rows = messages
      .filter((m) => m && m._id && m._id !== m.tempId)
      .map((m) => ({ ...m, conversationKey }));
    if (rows.length) await db.messages.bulkPut(rows);
  } catch (e) {
    console.warn("cacheMessages failed (non-fatal):", e);
  }
};

export const getCachedMessages = async (userId, conversationKey, limit = 50) => {
  const db = getUserDb(userId);
  if (!db) return [];
  try {
    const rows = await db.messages.where("conversationKey").equals(conversationKey).sortBy("createdAt");
    return limit ? rows.slice(-limit) : rows;
  } catch (e) {
    console.warn("getCachedMessages failed (non-fatal):", e);
    return [];
  }
};

// Read-modify-write a single cached message (edits, reactions, deletions,
// pins, poll votes...) without clobbering fields not present in the patch.
export const updateCachedMessage = async (userId, messageId, patch) => {
  const db = getUserDb(userId);
  if (!db) return;
  try {
    const existing = await db.messages.get(messageId);
    if (existing) await db.messages.put({ ...existing, ...patch });
  } catch (e) {
    console.warn("updateCachedMessage failed (non-fatal):", e);
  }
};

export const deleteCachedMessage = async (userId, messageId) => {
  const db = getUserDb(userId);
  if (!db) return;
  try {
    await db.messages.delete(messageId);
  } catch (e) {
    console.warn("deleteCachedMessage failed (non-fatal):", e);
  }
};

export const clearCachedConversation = async (userId, conversationKey) => {
  const db = getUserDb(userId);
  if (!db) return;
  try {
    await db.messages.where("conversationKey").equals(conversationKey).delete();
  } catch (e) {
    console.warn("clearCachedConversation failed (non-fatal):", e);
  }
};

export const cacheConversationsMeta = async (userId, key, data) => {
  const db = getUserDb(userId);
  if (!db) return;
  try {
    await db.conversationsMeta.put({ key, data, updatedAt: Date.now() });
  } catch (e) {
    console.warn("cacheConversationsMeta failed (non-fatal):", e);
  }
};

export const getCachedConversationsMeta = async (userId, key) => {
  const db = getUserDb(userId);
  if (!db) return null;
  try {
    const row = await db.conversationsMeta.get(key);
    return row ? row.data : null;
  } catch (e) {
    console.warn("getCachedConversationsMeta failed (non-fatal):", e);
    return null;
  }
};

export const addToOutbox = async (userId, entry) => {
  const db = getUserDb(userId);
  if (!db) return;
  try {
    await db.outbox.put(entry);
  } catch (e) {
    console.warn("addToOutbox failed (non-fatal):", e);
  }
};

export const getOutbox = async (userId) => {
  const db = getUserDb(userId);
  if (!db) return [];
  try {
    return await db.outbox.orderBy("createdAt").toArray();
  } catch (e) {
    console.warn("getOutbox failed (non-fatal):", e);
    return [];
  }
};

export const removeFromOutbox = async (userId, tempId) => {
  const db = getUserDb(userId);
  if (!db) return;
  try {
    await db.outbox.delete(tempId);
  } catch (e) {
    console.warn("removeFromOutbox failed (non-fatal):", e);
  }
};

// Wipes this user's entire local cache — called on logout / session revoke
// so a shared device never leaks one account's messages to the next login.
export const deleteUserDb = async (userId) => {
  if (!userId) return;
  try {
    const db = dbInstances.get(userId) || new Dexie(`chatty_cache_${userId}`);
    dbInstances.delete(userId);
    await db.delete();
  } catch (e) {
    console.warn("deleteUserDb failed (non-fatal):", e);
  }
};
