// Client-side mirror of backend/lib/groupPermissions.js.
//
// The server is the authority — it re-checks every action. This exists so the
// UI can show the right state and hide controls a member can't use, rather
// than letting them try and collect a 403.
export const GROUP_PERMISSIONS = [
  {
    key: "sendMessages",
    label: "Send messages",
    hint: "Who can post in this group",
  },
  {
    key: "addMembers",
    label: "Add members",
    hint: "Who can bring new people in",
  },
  {
    key: "editInfo",
    label: "Edit group info",
    hint: "Who can change the name, photo and description",
  },
  {
    key: "startCalls",
    label: "Start calls",
    hint: "Who can start a group voice or video call",
  },
];

/**
 * Effective level for an action. Mirrors the server's fallbacks exactly:
 * `sendMessages` follows the legacy `isReadOnly` flag when unset, so groups
 * created before permissions existed read correctly here too.
 */
export const levelFor = (group, action) => {
  const explicit = group?.permissions?.[action];
  if (explicit === "everyone" || explicit === "admins") return explicit;
  if (action === "sendMessages") return group?.isReadOnly ? "admins" : "everyone";
  if (action === "addMembers" || action === "editInfo") return "admins";
  return "everyone";
};

/** True when a member holding `role` may perform `action`. */
export const canDo = (group, role, action) => {
  if (!role) return false;
  return levelFor(group, action) === "everyone" || role === "admin" || role === "moderator";
};
