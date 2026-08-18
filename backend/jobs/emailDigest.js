import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { sendEmail, isMailConfigured } from "../lib/mailer.js";
import { getAppUrl } from "../lib/appUrl.js";
import { weeklyDigestEmail, inactivityNudgeEmail } from "../lib/emailTemplates.js";

/**
 * Weekly digest and inactivity nudge.
 *
 * Restricted to an explicit allowlist. This sends real mail to real inboxes, and
 * a bug that fans out across every registered account cannot be taken back — so
 * the default is three named addresses rather than "everyone". DIGEST_RECIPIENTS
 * overrides it (comma-separated) without a code change.
 *
 * Timing is derived from stored timestamps rather than from when the process
 * happens to be running: the loop ticks hourly and asks who is *due*. A restart
 * therefore neither skips a send nor causes a duplicate, which a fixed weekly
 * timer would do both of.
 */

const DEFAULT_RECIPIENTS = [
  "koppisettyjyothika@gmail.com",
  "saipraneethboni0037@gmail.com",
  "bunnyking828@gmail.com",
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const DIGEST_EVERY = 7 * DAY;
// Long enough that someone who checks in daily is never nudged.
const INACTIVE_AFTER = 3 * DAY;
const NUDGE_EVERY = 3 * DAY;
const TICK = HOUR;

let tickInterval = null;

const recipients = () => {
  const configured = String(process.env.DIGEST_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_RECIPIENTS;
};

const ms = (date) => (date ? new Date(date).getTime() : 0);

/**
 * What is actually waiting for this user, read at send time.
 *
 * Unread is counted against the same lastReadAt map the sidebar badges use, so
 * the email and the app cannot disagree. Messages the user hid are excluded, as
 * are deleted ones — an email advertising a message that is no longer there is
 * worse than no email.
 */
const collectActivity = async (user) => {
  const readAt = (key) => {
    const map = user.lastReadAt;
    const value = map instanceof Map ? map.get(key) : map?.[key];
    return value ? new Date(value) : new Date(0);
  };

  const conversations = [];
  let unreadTotal = 0;

  // ── Direct messages ──────────────────────────────────────────────────────
  const senders = await Message.distinct("senderId", {
    receiverId: user._id,
    groupId: null,
    deletedFor: { $ne: user._id },
    isDeletedForEveryone: { $ne: true },
  });

  for (const senderId of senders.filter(Boolean)) {
    const since = readAt(senderId.toString());
    const count = await Message.countDocuments({
      senderId,
      receiverId: user._id,
      groupId: null,
      deletedFor: { $ne: user._id },
      isDeletedForEveryone: { $ne: true },
      createdAt: { $gt: since },
    });
    if (!count) continue;

    const [latest, sender] = await Promise.all([
      Message.findOne({ senderId, receiverId: user._id, groupId: null })
        .sort({ createdAt: -1 })
        .select("text voice image poll"),
      User.findById(senderId).select("fullName"),
    ]);

    unreadTotal += count;
    conversations.push({
      name: sender?.fullName || "Someone",
      isGroup: false,
      count,
      preview: previewOf(latest),
      at: ms(latest?.createdAt),
    });
  }

  // ── Groups, plus mentions ────────────────────────────────────────────────
  let mentions = 0;
  const groups = await Group.find({ "members.user": user._id }).select("name");

  for (const group of groups) {
    const since = readAt(group._id.toString());
    const base = {
      groupId: group._id,
      senderId: { $ne: user._id },
      deletedFor: { $ne: user._id },
      isDeletedForEveryone: { $ne: true },
      createdAt: { $gt: since },
    };

    const [count, mentioned] = await Promise.all([
      Message.countDocuments(base),
      Message.countDocuments({ ...base, mentions: user._id }),
    ]);
    mentions += mentioned;
    if (!count) continue;

    const latest = await Message.findOne({ groupId: group._id })
      .sort({ createdAt: -1 })
      .select("text voice image poll isAnonymous");

    unreadTotal += count;
    conversations.push({
      name: group.name,
      isGroup: true,
      count,
      preview: previewOf(latest),
      at: ms(latest?.createdAt),
    });
  }

  // ── Missed calls, from the call logs already written as messages ─────────
  const missedCalls = await Message.countDocuments({
    receiverId: user._id,
    isCallLog: true,
    callStatus: "missed",
    createdAt: { $gt: new Date(Date.now() - DIGEST_EVERY) },
  });

  conversations.sort((a, b) => b.count - a.count || b.at - a.at);

  return {
    unreadTotal,
    mentions,
    missedCalls,
    // Capped: an email listing thirty chats is a wall, not a summary.
    conversations: conversations.slice(0, 5),
  };
};

/** A short, safe description of a message for the email body. */
const previewOf = (message) => {
  if (!message) return "";
  if (message.isAnonymous) return "Anonymous question";
  if (message.poll) return `Poll: ${message.poll.question || ""}`.slice(0, 90);
  if (message.voice) return "Voice message";
  if (message.image) return "Photo";
  return String(message.text || "").replace(/\s+/g, " ").trim().slice(0, 90);
};

const daysSince = (date) => Math.max(0, Math.floor((Date.now() - ms(date)) / DAY));

/**
 * Decides what one user is due, if anything.
 *
 * A nudge is only sent when something is actually waiting: mailing someone to say
 * they have nothing to read is how an address stops trusting the sender. The
 * digest goes out either way, because a quiet week is still information.
 */
const planFor = (user, now) => {
  const digestDue = now - ms(user.lastDigestAt) >= DIGEST_EVERY;
  const inactive = now - ms(user.lastSeen) >= INACTIVE_AFTER;
  const nudgeDue = inactive && now - ms(user.lastNudgeAt) >= NUDGE_EVERY;

  if (digestDue) return "digest";
  if (nudgeDue) return "nudge";
  return null;
};

const sendFor = async (user, kind, appUrl) => {
  const activity = await collectActivity(user);

  if (kind === "nudge" && activity.unreadTotal === 0) {
    // Nothing to say. The timestamp still moves so this is not re-evaluated
    // every hour for the rest of the week.
    await User.updateOne({ _id: user._id }, { $set: { lastNudgeAt: new Date() } });
    return { skipped: "nothing waiting" };
  }

  const sinceDays = daysSince(user.lastSeen);
  const message =
    kind === "digest"
      ? weeklyDigestEmail({ name: user.fullName, appUrl, sinceDays, ...activity })
      : inactivityNudgeEmail({ name: user.fullName, appUrl, sinceDays, ...activity });

  const result = await sendEmail({ to: user.email, ...message });

  await User.updateOne(
    { _id: user._id },
    { $set: kind === "digest" ? { lastDigestAt: new Date() } : { lastNudgeAt: new Date() } }
  );

  return { sent: result.sent, via: result.via, subject: message.subject };
};

/**
 * One pass over the allowlist.
 *
 * Exported so it can be run from a script for a dry run or an immediate send,
 * rather than waiting on the interval.
 */
export const runEmailDigest = async ({ dryRun = false, force = null } = {}) => {
  const appUrl = getAppUrl();
  if (!appUrl) {
    console.warn("[digest] no public app URL (set PUBLIC_APP_URL or ALLOWED_ORIGIN) — skipping");
    return [];
  }
  if (!dryRun && !isMailConfigured()) {
    console.warn("[digest] no email provider configured — skipping");
    return [];
  }

  const list = recipients();
  const users = await User.find({ email: { $in: list } });
  const now = Date.now();
  const outcomes = [];

  for (const user of users) {
    const kind = force || planFor(user, now);
    if (!kind) {
      outcomes.push({ email: user.email, action: "not due" });
      continue;
    }

    try {
      if (dryRun) {
        const activity = await collectActivity(user);
        outcomes.push({
          email: user.email,
          action: `would send ${kind}`,
          unread: activity.unreadTotal,
          mentions: activity.mentions,
          missedCalls: activity.missedCalls,
          chats: activity.conversations.length,
          inactiveDays: daysSince(user.lastSeen),
        });
        continue;
      }

      const result = await sendFor(user, kind, appUrl);
      outcomes.push({ email: user.email, action: kind, ...result });
    } catch (err) {
      console.error(`[digest] ${user.email} failed:`, err?.message || err);
      outcomes.push({ email: user.email, action: kind, error: err?.message || String(err) });
    }
  }

  const missing = list.filter((e) => !users.some((u) => u.email.toLowerCase() === e));
  missing.forEach((e) => outcomes.push({ email: e, action: "no account" }));

  return outcomes;
};

export const startEmailDigest = () => {
  if (tickInterval) return;
  // Hourly, not weekly: the schedule lives in the stored timestamps, so a tick
  // that finds nothing due costs one indexed query and stops.
  tickInterval = setInterval(() => {
    runEmailDigest().catch((err) => console.error("[digest] tick failed:", err?.message || err));
  }, TICK);
  console.log("[digest] weekly digest and inactivity nudge scheduled");
};

export const stopEmailDigest = () => {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
};
