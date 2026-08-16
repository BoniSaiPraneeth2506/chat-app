// Private per-contact renames.
//
// A nickname is only ever visible to the person who set it — it lives on their
// own user document, the contact's real `fullName` is never modified, and the
// contact is never told. Resolution goes through here so every screen agrees
// on which name to show.
import useAuthStore from "../store/useAuthStore";

/**
 * Subscribe to the signed-in user's nickname map.
 *
 * A hook rather than a `getState()` read so components actually re-render when
 * a nickname changes — several of them subscribe only to the chat store and
 * would otherwise keep showing the old name until some unrelated update.
 */
export const useNicknames = () =>
  useAuthStore((state) => state.authUser?.contactNicknames) || {};

/** The name to display for a user, preferring the viewer's private alias. */
export const displayNameOf = (user, nicknames) => {
  if (!user) return "";
  return nicknames?.[user._id] || user.fullName || "";
};

/** True when this contact has been renamed — used to offer "real name" context. */
export const hasNickname = (user, nicknames) =>
  Boolean(user && nicknames?.[user._id]);
