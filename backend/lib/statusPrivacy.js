// Who is allowed to see a status.
//
// This is deliberately one module. Privacy that is enforced in a controller is
// privacy that the next endpoint forgets: the list route filters, the
// single-status route checks, the media route signs. Three places to keep in
// step is three chances to leak someone's photo to a person they excluded.
//
// So every read path — list, single, view, media URL, reaction, replies —
// answers through `canViewerSeeStatus` / `canViewStatusGroup` here, and the
// signed URL is only ever produced after the same check the row itself passed.
import User from "../models/user.model.js";
import Message from "../models/message.model.js";

const asIdSet = (ids) =>
  new Set((ids || []).map((id) => (id?._id || id).toString()).filter(Boolean));

const DEFAULT_MODE = "contacts";

const modeOf = (status) => status?.privacy?.mode || DEFAULT_MODE;

/**
 * People the viewer has actually exchanged a direct message with.
 *
 * The existing visibility rule for a status is the same one used for the list:
 * two people "have a contact" when at least one direct, non-group message exists
 * between them in either direction. Reusing it here is what makes
 * "My contacts" mean what it says instead of meaning "everyone on the server".
 */
const chattedWith = async (a, b) =>
  Message.exists({
    groupId: null,
    $or: [
      { senderId: a, receiverId: b },
      { senderId: b, receiverId: a },
    ],
  }).then(Boolean);

export const isBlockedBetween = async (a, b) => {
  if (!a || !b) return false;
  const [aDoc, bDoc] = await Promise.all([
    User.findById(a).select("blockedUsers").lean(),
    User.findById(b).select("blockedUsers").lean(),
  ]);
  const aBlocks = asIdSet(aDoc?.blockedUsers);
  const bBlocks = asIdSet(bDoc?.blockedUsers);
  return aBlocks.has(b.toString()) || bBlocks.has(a.toString());
};

/**
 * Close friends of `ownerId`, as a Set of id strings.
 *
 * Kept on the user document and never sent to the client as part of a profile:
 * the list is the owner's own audience definition, and a viewer who could read
 * it would learn who is on it.
 */
export const closeFriendsOf = async (ownerId) => {
  const owner = await User.findById(ownerId).select("closeFriends").lean();
  return asIdSet(owner?.closeFriends);
};

/**
 * Whether `viewerId` may see `status`.
 *
 * Assumes blocking and the contact rule have already been handled by the caller
 * when it needs both; it checks the status's own privacy, plus the owner's
 * privacy for a viewer who is not the owner.
 */
export const statusPrivacyAllows = async (status, viewerId, { closeFriends } = {}) => {
  if (!status || !viewerId) return false;

  const ownerId = status.user?._id || status.user;
  if (!ownerId) return false;
  if (ownerId.toString() === viewerId.toString()) return true;

  const viewer = viewerId.toString();
  const mode = modeOf(status);

  if (mode === "everyone") return true;

  if (mode === "except") {
    // Everyone except the named people. Contacts still have to be contacts.
    if (asIdSet(status.privacy?.exclude).has(viewer)) return false;
    return chattedWith(ownerId, viewerId);
  }

  if (mode === "only") {
    // An explicit allow-list. No contact relationship is assumed, but the owner
    // must have actually named this person.
    return asIdSet(status.privacy?.include).has(viewer);
  }

  // contacts, closeFriends and except-without-a-list all begin here: the viewer
  // has to be a real contact.
  if (!(await chattedWith(ownerId, viewerId))) return false;

  if (mode === "closeFriends") {
    const friends = closeFriends || (await closeFriendsOf(ownerId));
    return friends.has(viewer);
  }

  return true;
};

/**
 * Convenience for endpoints that have not already loaded the close-friends set.
 * Costs one extra query only for statuses that actually use the mode.
 */
export const canViewerSeeStatus = async (status, viewerId) => {
  if (!status || !viewerId) return false;

  const ownerId = status.user?._id || status.user;
  if (ownerId && ownerId.toString() === viewerId.toString()) return true;

  if (modeOf(status) === "closeFriends") {
    const friends = await closeFriendsOf(ownerId);
    return statusPrivacyAllows(status, viewerId, { closeFriends: friends });
  }

  return statusPrivacyAllows(status, viewerId);
};

/**
 * Drops the statuses a viewer must not see from an already-fetched batch, and
 * returns the per-status close-friends lookups the caller should reuse so a
 * group of twenty statuses costs one query rather than twenty.
 *
 * `ownerCloseFriends` maps ownerId -> Set, and the caller passes it back in.
 */
export const filterStatusesForViewer = async (statuses, viewerId, ownerCloseFriends = new Map()) => {
  const list = (statuses || []).filter(Boolean);

  const needsFriends = list.some(
    (s) => modeOf(s) === "closeFriends" && (s.user?._id || s.user)?.toString() !== viewerId.toString()
  );

  if (needsFriends) {
    const ownerIds = [
      ...new Set(
        list
          .filter((s) => modeOf(s) === "closeFriends")
          .map((s) => (s.user?._id || s.user).toString())
      ),
    ];
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select("closeFriends")
      .lean();
    for (const owner of owners) {
      ownerCloseFriends.set(owner._id.toString(), asIdSet(owner.closeFriends));
    }
  }

  const allowed = [];
  for (const status of list) {
    const ownerId = (status.user?._id || status.user)?.toString();
    const ok = await statusPrivacyAllows(status, viewerId, {
      closeFriends: ownerId ? ownerCloseFriends.get(ownerId) : undefined,
    });
    if (ok) allowed.push(status);
  }

  return allowed;
};

/**
 * Close friends to a given status, for the list of ids that will be sent to
 * each viewer on creation. The audience decides who is told, not the creator.
 */
export const resolveAuthorizedViewerIds = async (status) => {
  const ownerId = (status.user?._id || status.user)?.toString();
  if (!ownerId) return [];

  const mode = modeOf(status);
  const owner = await User.findById(ownerId).select("closeFriends").lean();
  const closeFriends = asIdSet(owner?.closeFriends);
  const include = asIdSet(status.privacy?.include);
  const exclude = asIdSet(status.privacy?.exclude);

  // Everyone is a candidate; each mode then narrows it. One query, then rules in
  // memory — the alternative is a query per mode against the whole user table.
  const users = await User.find({ _id: { $ne: ownerId } }).select("_id").lean();
  const all = users.map((u) => u._id.toString());

  if (mode === "only") {
    return all.filter((id) => include.has(id) && !exclude.has(id));
  }

  const candidateIds = all.filter((id) => !exclude.has(id));

  if (mode === "everyone") {
    return candidateIds;
  }

  // contacts / closeFriends / except all need the contact relationship.
  const rows = await Message.find({
    groupId: null,
    $or: [{ senderId: ownerId }, { receiverId: ownerId }],
  })
    .select("senderId receiverId")
    .lean();

  const contacts = new Set(
    rows
      .flatMap((m) => [m.senderId, m.receiverId])
      .map((id) => id?.toString())
      .filter((id) => id && id !== ownerId)
  );

  if (mode === "closeFriends") {
    return candidateIds.filter((id) => contacts.has(id) && closeFriends.has(id));
  }

  return candidateIds.filter((id) => contacts.has(id));
};

export const PRIVACY_MODES = ["everyone", "contacts", "closeFriends", "only", "except"];

/**
 * Every id the user has blocked, plus everyone who has blocked them.
 *
 * Shared rather than duplicated: a block that one read path knows about and
 * another does not is a status that stays visible after someone asked it not to.
 */
export const getBlockedIds = async (userId) => {
  try {
    const user = await User.findById(userId).select("blockedUsers").lean();
    const mine = asIdSet(user?.blockedUsers);
    const blockers = await User.find({ blockedUsers: userId }).select("_id").lean();
    return [...new Set([...mine, ...blockers.map((u) => u._id.toString())])];
  } catch {
    return [];
  }
};
