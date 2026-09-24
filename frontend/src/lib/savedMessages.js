// Saved Messages — a personal, per-conversation collection stored on the
// device (same pattern as bubble overrides / mute / auto-translate prefs).
// Shape: { [conversationKey]: [{ messageId, text, image, voice, senderId,
// senderName, createdAt, savedAt }] }

const STORAGE_KEY = "chatty-saved-messages";

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeAll = (all) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore quota / private-mode failures; the feature simply won't persist.
  }
};

export const getSavedMessages = (convKey) => {
  if (!convKey) return [];
  return readAll()[convKey] || [];
};

export const isSavedMessage = (convKey, messageId) =>
  getSavedMessages(convKey).some((m) => m.messageId === messageId);

const toSavedEntry = (message, authUserId) => {
  const sender = message.senderId;
  return {
    messageId: message._id,
    text: message.text || "",
    image: message.image || message.images?.[0] || null,
    voice: message.voice || null,
    senderId: typeof sender === "object" && sender ? sender._id : sender || authUserId,
    senderName: typeof sender === "object" && sender?.fullName ? sender.fullName : "",
    createdAt: message.createdAt || new Date().toISOString(),
    savedAt: Date.now(),
  };
};

// Returns the resulting list for the conversation. Pass a message to save;
// pass (convKey, messageId) to remove.
export const toggleSaveMessage = (convKey, message, authUserId) => {
  if (!convKey || !message?._id) return getSavedMessages(convKey);
  const all = readAll();
  const list = all[convKey] || [];
  const existing = list.find((m) => m.messageId === message._id);
  const next = existing
    ? list.filter((m) => m.messageId !== message._id)
    : [...list, toSavedEntry(message, authUserId)].sort(
        (a, b) => new Date(a.savedAt) - new Date(b.savedAt)
      );
  all[convKey] = next;
  writeAll(all);
  return next;
};

export const removeSavedMessage = (convKey, messageId) => {
  if (!convKey) return [];
  const all = readAll();
  const next = (all[convKey] || []).filter((m) => m.messageId !== messageId);
  all[convKey] = next;
  writeAll(all);
  return next;
};