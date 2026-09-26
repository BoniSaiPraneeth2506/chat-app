// Formatting shared by the status editors, the viewer and the cards.
//
// These live in one place because the countdown in an editor and the countdown
// on a status someone else is watching have to agree to the second — two copies
// of a duration formatter is how a status shows "3d 04:59:58" to its author and
// "3d 05:00:01" to everyone else.

/** "12s ago", "4m ago", "3h ago", "2d ago" — compact enough for a card. */
export const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/** A countdown as d/h/m/s, with the day part only when there is one. */
export const formatRemaining = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/**
 * The font stacks a text status may use.
 *
 * System stacks only, and the ids match what the text editor stores. The viewer
 * resolves an id to a stack rather than rendering a name a status supplies, so a
 * status can never point at a font on someone else's device.
 */
export const TEXT_FONT_STACKS = {
  classic: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
  rounded: "ui-rounded, 'Segoe UI', system-ui, sans-serif",
  condensed: "'Arial Narrow', 'Helvetica Neue', sans-serif",
};

export const fontStackOf = (id) => TEXT_FONT_STACKS[id] || TEXT_FONT_STACKS.classic;

/** How a text status lines its content up. Mirrors the editor's three choices. */
export const alignItemsOf = (position) =>
  position === "top" ? "flex-start" : position === "bottom" ? "flex-end" : "center";

export const textAlignOf = (align) =>
  align === "left" ? "left" : align === "right" ? "right" : "center";

/**
 * A maps link for a status location.
 *
 * Only ever built from coordinates the author explicitly chose. No geocoding, no
 * device position, and the coordinates are rounded to four decimals first —
 * about eleven metres, which is the difference between "the shop" and the exact
 * table they were sitting at.
 */
export const mapUrlOf = (location) => {
  if (!location || (location.lat === 0 && location.lng === 0)) return "";
  const lat = Number(location.lat.toFixed(4));
  const lng = Number(location.lng.toFixed(4));
  const label = location.name ? `&q=${encodeURIComponent(location.name)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${label}`;
};

export const clockOf = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Total votes in a poll, for the foot line under the options. */
export const pollTotal = (poll) =>
  (poll?.options || []).reduce((sum, option) => sum + (option.votes?.length || 0), 0);

/**
 * The type of a status, working even for documents written before `type` existed
 * as a field. Mirrors backend/lib/statusType.js, kept here because a status can
 * arrive without the field from the socket too, and the card and the body both
 * switch on type — a photo whose type read as `undefined` renders as a blank
 * frame with the name on it, which is how a loaded-but-empty status looks.
 */
export const resolveStatusType = (status) => {
  const declared = typeof status?.type === "string" ? status.type : "";
  if (declared) return declared;

  if (status?.poll?.options?.length) return "poll";
  if (status?.question) return "question";
  if (status?.countdown?.targetAt) return "countdown";
  if (status?.music?.key) return "music";
  if (status?.voice?.key) return "voice";
  if (status?.location) return "location";
  if (status?.link?.url) return "link";
  if (status?.text?.content) return "text";
  if (Array.isArray(status?.mediaItems) && status.mediaItems.length > 1) return "layout";
  if (status?.media?.type === "video") return "video";
  if (status?.media?.type === "image" || status?.media?.key) return "image";

  return "image";
};

/** Which option a given user picked, or -1. */
export const votedOptionOf = (poll, userId) => {
  if (!userId) return -1;
  const id = String(userId);
  return (poll?.options || []).findIndex((option) =>
    (option.votes || []).some((voter) => String(voter?._id || voter) === id)
  );
};
