// Group member presentation helpers.
//
// Kept out of the components because the member row, the member sheet and the
// filter chips all need to agree on what "recently joined" and "active" mean.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Joined Aug 12, 2026" — falls back to nothing rather than an Invalid Date. */
export const formatJoinDate = (joinedAt) => {
  if (!joinedAt) return "";
  const d = new Date(joinedAt);
  if (Number.isNaN(d.getTime())) return "";
  return `Joined ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
};

/** Members who joined within the last week, for the "Recently joined" filter. */
export const isRecentlyJoined = (joinedAt, withinDays = 7) => {
  if (!joinedAt) return false;
  const t = new Date(joinedAt).getTime();
  return !Number.isNaN(t) && Date.now() - t <= withinDays * DAY;
};

/**
 * A short activity line for a member.
 *
 * Returns null when the member has hidden their presence, so callers render
 * nothing at all rather than a placeholder that hints at the setting. That check
 * comes first deliberately: a "last seen 3 days ago" line would defeat the point
 * of the toggle just as much as a green dot would.
 */
export const activityLabel = (user, onlineUsers = []) => {
  if (!user) return null;
  if (user.onlinePrivacy === false) return null;
  if (Array.isArray(onlineUsers) && onlineUsers.includes(user._id)) return "Active now";
  if (!user.lastSeen) return null;

  const seen = new Date(user.lastSeen).getTime();
  if (Number.isNaN(seen)) return null;
  const ago = Date.now() - seen;

  if (ago < 5 * MINUTE) return "Active just now";
  if (ago < HOUR) return `Active ${Math.max(1, Math.round(ago / MINUTE))}m ago`;
  if (ago < DAY) return `Active ${Math.round(ago / HOUR)}h ago`;
  if (ago < 7 * DAY) return `Active ${Math.round(ago / DAY)}d ago`;
  return `Active on ${new Date(seen).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
};

/** True while the member counts as online for a presence dot. */
export const isOnlineNow = (user, onlineUsers = []) =>
  Boolean(user) && user.onlinePrivacy !== false && onlineUsers.includes(user._id);

export const MEMBER_FILTERS = [
  { id: "all", label: "All" },
  { id: "admins", label: "Admins" },
  { id: "moderators", label: "Moderators" },
  { id: "recent", label: "Recently joined" },
];

/** Applies the search box and the active filter chip to a members array. */
export const filterMembers = (members, { query = "", filter = "all" } = {}) => {
  const q = query.trim().toLowerCase();
  return (members || []).filter((m) => {
    const u = m?.user;
    if (!u) return false;

    if (q) {
      const haystack = `${u.fullName || ""} ${u.email || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filter === "admins") return m.role === "admin";
    if (filter === "moderators") return m.role === "moderator";
    if (filter === "recent") return isRecentlyJoined(m.joinedAt);
    return true;
  });
};
