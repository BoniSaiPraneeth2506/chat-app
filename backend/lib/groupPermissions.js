// Who is allowed to do what inside a group.
//
// Kept in its own module because the rules are needed from two very different
// places: the REST controllers and the Socket.IO call handlers. Putting them
// here stops the two drifting apart.

/** The actions a group can restrict. */
export const GROUP_ACTIONS = ["sendMessages", "addMembers", "editInfo", "startCalls"];

/**
 * Two levels only. "admins" includes moderators, matching how `isReadOnly`
 * already behaved ("only admin & moderator can send messages") — introducing a
 * moderator-excluding level would silently change existing groups.
 */
export const PERMISSION_LEVELS = ["everyone", "admins"];

export const getUserRole = (group, userId) => {
  const member = group.members.find((m) => {
    const id = m.user?._id ? m.user._id : m.user;
    return id.toString() === userId.toString();
  });
  return member ? member.role : null;
};

export const isMember = (group, userId) => Boolean(getUserRole(group, userId));

const isElevated = (role) => role === "admin" || role === "moderator";

/**
 * Effective level for one action.
 *
 * `sendMessages` falls back to the legacy `isReadOnly` flag so groups created
 * before permissions existed keep behaving exactly as they did. Everything
 * else defaults to "everyone", which is also the old hardcoded behaviour for
 * calls, and a deliberate loosening for addMembers/editInfo is opt-in only.
 */
export const levelFor = (group, action) => {
  const explicit = group.permissions?.[action];
  if (PERMISSION_LEVELS.includes(explicit)) return explicit;
  if (action === "sendMessages") return group.isReadOnly ? "admins" : "everyone";
  if (action === "addMembers" || action === "editInfo") return "admins";
  return "everyone";
};

/** True when `userId` may perform `action` in `group`. */
export const canDo = (group, userId, action) => {
  const role = getUserRole(group, userId);
  if (!role) return false; // non-members can never act
  return levelFor(group, action) === "everyone" ? true : isElevated(role);
};

/** Only full admins may change the rules themselves. */
export const canManagePermissions = (group, userId) => getUserRole(group, userId) === "admin";

/** Validates and normalizes a permissions patch from a client. */
export const sanitizePermissions = (input, current = {}) => {
  const source = input && typeof input === "object" ? input : {};
  return GROUP_ACTIONS.reduce((acc, action) => {
    const value = source[action];
    acc[action] = PERMISSION_LEVELS.includes(value)
      ? value
      : PERMISSION_LEVELS.includes(current[action])
        ? current[action]
        : undefined;
    return acc;
  }, {});
};

export const humanLabel = {
  sendMessages: "Send messages",
  addMembers: "Add members",
  editInfo: "Edit group info",
  startCalls: "Start calls",
};
