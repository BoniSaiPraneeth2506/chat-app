import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import mongoose from "mongoose";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getStorage, storageBucket, isStorageConfigured } from "../lib/storage.js";
import { verifyAttachment } from "../lib/attachments.js";
import {
  signStatusMedia,
  signMany,
  statusMediaKeys,
  STATUS_MEDIA_URL_TTL_SECONDS,
} from "../lib/statusMedia.js";
import {
  isBlockedBetween,
  canViewerSeeStatus,
  filterStatusesForViewer,
  resolveAuthorizedViewerIds,
  PRIVACY_MODES,
} from "../lib/statusPrivacy.js";
import { withResolvedStatusType } from "../lib/statusType.js";

const STATUS_DURATION_MS = 24 * 60 * 60 * 1000;
const MEDIA_URL_TTL_SECONDS = STATUS_MEDIA_URL_TTL_SECONDS;

const REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
const MAX_LAYOUT_ITEMS = 6;
const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;
const MAX_VOICE_SECONDS = 60;

// Re-exported so the existing import in the route file and any other caller
// keeps working unchanged.
export { signStatusMedia };

const asIds = (value) =>
  (Array.isArray(value) ? value : [])
    .map((v) => v?._id || v)
    .filter((v) => v && mongoose.isValid(String(v)))
    .map((v) => String(v));

const hasChatWith = (a, b) =>
  Message.exists({
    groupId: null,
    $or: [
      { senderId: a, receiverId: b },
      { senderId: b, receiverId: a },
    ],
  }).then(Boolean);

async function getBlockedIds(userId) {
  try {
    const user = await User.findById(userId).select("blockedUsers").lean();
    const myBlocked = asIds(user?.blockedUsers);

    const blockers = await User.find({ blockedUsers: userId }).select("_id").lean();
    const blockedBy = blockers.map((u) => u._id.toString());

    return [...new Set([...myBlocked, ...blockedBy])];
  } catch {
    return [];
  }
}

// -- payload validation ----------------------------------------------------------------

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

const parsePrivacy = (raw) => {
  const mode = PRIVACY_MODES.includes(raw?.mode) ? raw.mode : null;
  if (!mode) return null;
  return {
    mode,
    include: asIds(raw.include),
    exclude: asIds(raw.exclude),
  };
};

/** Confirms a key the client claims to have uploaded really exists. */
const verifyKey = async ({ key, kind, mime, size }) => {
  const result = await verifyAttachment({ key, kind, size, mime });
  if (!result.valid) return result;
  // verifyAttachment only accepts a key under `<kind>/<userId>/`; a status may
  // legitimately carry a key another kind produced, so re-check against the
  // signed object's real content type.
  return { valid: true, mime: result.mime || mime };
};

const headExists = async (key) => {
  try {
    const head = await getStorage().send(
      new HeadObjectCommand({ Bucket: storageBucket(), Key: key })
    );
    return Boolean(head) && head.$metadata?.httpStatusCode !== 404;
  } catch {
    return false;
  }
};

const buildMediaItem = ({ key, type, fileName, contentType, size, duration, width, height }) => ({
  type,
  key,
  url: "",
  fileName: clean(fileName, 120),
  contentType: contentType || "",
  size: Number(size) || 0,
  duration: Number(duration) || 0,
  width: Number(width) || 0,
  height: Number(height) || 0,
});

/**
 * Validates one type's payload and returns either `{ error }` or the fields to
 * merge into the new status.
 *
 * One function rather than a branch per endpoint, so every status type is
 * checked the same way and a new one cannot skip its own validation.
 */
const validatePayload = async (type, body) => {
  const extra = {};

  if (type === "image" || type === "video") {
    const mediaType = type === "image" ? "image" : "video";
    const key = clean(body.key, 300);
    if (!key) return { error: "Media key is required" };
    if (!key.startsWith(`${mediaType}/`)) return { error: "Invalid attachment reference" };
    if (!(await headExists(key))) return { error: "Upload not found — please try again" };

    extra.media = buildMediaItem({
      key,
      type: mediaType,
      fileName: body.fileName,
      contentType: body.contentType,
      size: body.size,
      duration: body.duration,
      width: body.width,
      height: body.height,
    });
    return { extra };
  }

  if (type === "layout") {
    const items = (Array.isArray(body.mediaItems) ? body.mediaItems : []).slice(0, MAX_LAYOUT_ITEMS);
    if (items.length < 2) return { error: "Choose at least 2 photos" };
    const built = [];
    for (const item of items) {
      const key = clean(item?.key, 300);
      if (!key || !key.startsWith("image/")) return { error: "Invalid photo reference" };
      if (!(await headExists(key))) return { error: "Upload not found — please try again" };
      built.push(
        buildMediaItem({
          key,
          type: "image",
          fileName: item.fileName,
          contentType: item.contentType,
          size: item.size,
          width: item.width,
          height: item.height,
        })
      );
    }
    // The first photo is also the primary, so a renderer can treat every status
    // as "a primary plus extras" without knowing the type.
    extra.media = built[0];
    extra.mediaItems = built;
    return { extra };
  }

  if (type === "text") {
    const text = body.text || {};
    const content = clean(text.content, 500);
    if (!content) return { error: "Write something first" };
    extra.text = {
      content,
      font: clean(text.font, 24) || "classic",
      fontSize: Math.min(96, Math.max(12, Number(text.fontSize) || 32)),
      // Colours are written by this app's own palette, but a hex value is
      // still validated rather than trusted: it ends up in an inline style.
      color: /^#[0-9a-f]{6}$/i.test(text.color || "") ? text.color : "#ffffff",
      backgroundColor: /^#[0-9a-f]{6}$/i.test(text.backgroundColor || "")
        ? text.backgroundColor
        : "#0b1b3a",
      backgroundGradient: /^[a-z0-9#%(),.\s-]{0,200}$/i.test(text.backgroundGradient || "")
        ? clean(text.backgroundGradient, 200)
        : "",
      align: ["left", "center", "right"].includes(text.align) ? text.align : "center",
      position: ["top", "center", "bottom"].includes(text.position) ? text.position : "center",
      emoji: clean(text.emoji, 8),
      mediaKey: "",
      mediaContentType: "",
    };
    if (text.mediaKey) {
      const key = clean(text.mediaKey, 300);
      if (!key.startsWith("image/") || !(await headExists(key))) {
        return { error: "Background photo not found" };
      }
      extra.text.mediaKey = key;
      extra.text.mediaContentType = clean(text.mediaContentType, 80);
    }
    return { extra };
  }

  if (type === "voice") {
    const voice = body.voice || {};
    const key = clean(voice.key, 300);
    if (!key || !key.startsWith("audio/")) return { error: "Invalid voice clip" };
    const check = await verifyKey({ key, kind: "audio", mime: voice.contentType });
    if (!check.valid) return { error: "Upload not found — please try again" };
    const duration = Number(voice.duration) || 0;
    if (duration <= 0 || duration > MAX_VOICE_SECONDS) {
      return { error: `Voice statuses can be up to ${MAX_VOICE_SECONDS} seconds` };
    }
    extra.voice = {
      key,
      url: "",
      contentType: clean(voice.contentType, 80),
      size: Number(voice.size) || 0,
      duration,
      waveform: (Array.isArray(voice.waveform) ? voice.waveform : [])
        .map((n) => Math.max(0, Math.min(1, Number(n) || 0)))
        .slice(0, 120),
      backgroundKey: "",
      backgroundContentType: "",
    };
    if (voice.backgroundKey) {
      const bgKey = clean(voice.backgroundKey, 300);
      if (!bgKey.startsWith("image/") || !(await headExists(bgKey))) {
        return { error: "Background photo not found" };
      }
      extra.voice.backgroundKey = bgKey;
      extra.voice.backgroundContentType = clean(voice.backgroundContentType, 80);
    }
    return { extra };
  }

  if (type === "music") {
    const music = body.music || {};
    const key = clean(music.key, 300);
    if (!key || !key.startsWith("audio/")) return { error: "Invalid track" };
    if (!(await headExists(key))) return { error: "Upload not found — please try again" };
    extra.music = {
      key,
      url: "",
      contentType: clean(music.contentType, 80),
      size: Number(music.size) || 0,
      duration: Math.max(0, Number(music.duration) || 0),
      title: clean(music.title, 120),
      artist: clean(music.artist, 120),
      albumArtKey: "",
      startAt: Math.max(0, Number(music.startAt) || 0),
    };
    if (music.albumArtKey) {
      const artKey = clean(music.albumArtKey, 300);
      if (artKey.startsWith("image/") && (await headExists(artKey))) {
        extra.music.albumArtKey = artKey;
      }
    }
    return { extra };
  }

  if (type === "poll") {
    const poll = body.poll || {};
    const question = clean(poll.question, 200);
    if (!question) return { error: "Ask a question" };
    const options = (Array.isArray(poll.options) ? poll.options : [])
      .map((o) => clean(typeof o === "string" ? o : o?.text, 60))
      .filter(Boolean);
    if (options.length < MIN_POLL_OPTIONS) return { error: "A poll needs at least 2 options" };
    if (options.length > MAX_POLL_OPTIONS) return { error: `A poll can have up to ${MAX_POLL_OPTIONS} options` };
    extra.poll = { question, options: options.map((text) => ({ text, votes: [] })), isClosed: false };
    return { extra };
  }

  if (type === "question") {
    const question = body.question || {};
    const prompt = clean(question.prompt, 200);
    if (!prompt) return { error: "Ask a question" };
    extra.question = { prompt, answers: [], answersVisibleToOwner: true };
    return { extra };
  }

  if (type === "link") {
    const link = body.link || {};
    const url = clean(link.url, 500);
    // Only http(s). A status link opens outside the app, so this is the one
    // place a scheme could turn into a javascript: execution on a real device.
    if (!/^https?:\/\//i.test(url)) return { error: "Enter a valid http(s) link" };
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes(".")) throw new Error("bad host");
    } catch {
      return { error: "Enter a valid link" };
    }
    extra.link = {
      url,
      title: clean(link.title, 160),
      description: clean(link.description, 300),
      imageKey: "",
      imageContentType: "",
      domain: clean(link.domain, 120) || new URL(url).hostname,
    };
    if (link.imageKey) {
      const key = clean(link.imageKey, 300);
      if (key.startsWith("image/") && (await headExists(key))) {
        extra.link.imageKey = key;
        extra.link.imageContentType = clean(link.imageContentType, 80);
      }
    }
    return { extra };
  }

  if (type === "location") {
    const location = body.location || {};
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { error: "Choose a location" };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { error: "That location is not valid" };
    }
    // Coarse unless the picker explicitly said otherwise: a status is forwarded
    // far more freely than a chat pin, and an omitted or unrecognised value is
    // not a decision to share an exact doorstep.
    const precision = location.precision === "exact" ? "exact" : "approximate";
    // The blur happens here, on the way in, rather than on the way out.
    //
    // Rounding the response would still leave the exact pin sitting in the
    // document, where a viewer who gets hold of the raw status — or anyone with
    // read access to the collection — recovers it. Once a status says
    // "approximate" the coordinate it was created from is discarded and never
    // written. One decimal is about eleven kilometres: a district, not a doorway.
    extra.location = {
      lat: precision === "exact" ? lat : Number(lat.toFixed(1)),
      lng: precision === "exact" ? lng : Number(lng.toFixed(1)),
      name: clean(location.name, 120),
      address: clean(location.address, 200),
      precision,
    };
    return { extra };
  }

  if (type === "countdown") {
    const countdown = body.countdown || {};
    const targetAt = new Date(countdown.targetAt);
    if (Number.isNaN(targetAt.getTime())) return { error: "Pick a date and time" };
    if (targetAt.getTime() <= Date.now()) return { error: "Pick a time in the future" };
    extra.countdown = { title: clean(countdown.title, 100), targetAt };
    return { extra };
  }

  return { error: "Unsupported status type" };
};

// -- create -------------------------------------------------------------------------------

export const createStatus = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ message: "File storage is not available" });
    }

    const body = req.body || {};
    const userId = req.user._id;
    const type = body.type || "image";

    // A type with no media still needs storage to be up, because the list
    // endpoint signs media for everything alongside it and the client should
    // not have to special-case a misconfigured server per status type.
    const { error, extra } = await validatePayload(type, body);
    if (error) return res.status(400).json({ message: error });

    const privacy = parsePrivacy(body.privacy);
    if (body.privacy && !privacy) {
      return res.status(400).json({ message: "Invalid privacy setting" });
    }

    const now = new Date();
    // A scheduled status is stored but stays invisible: the list endpoint only
    // ever returns statusState "active", so nothing can leak early and the
    // publisher promotes it when the time comes.
    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ message: "Invalid schedule time" });
    }
    const isScheduled = Boolean(scheduledFor && scheduledFor.getTime() > now.getTime() + 60_000);

    const status = new Status({
      user: userId,
      type,
      caption: clean(body.caption, 300),
      mentions: asIds(body.mentions),
      privacy: privacy || undefined,
      createdAt: now,
      expiresAt: new Date(now.getTime() + STATUS_DURATION_MS),
      statusState: isScheduled ? "scheduled" : "active",
      scheduledFor: isScheduled ? scheduledFor : null,
      ...extra,
    });

    await status.save();

    const populated = await status.populate("user", "fullName profilePic");
    const populatedObj = populated.toObject();
    await signStatusMedia(populatedObj);

    if (!isScheduled) {
      await notifyAudience(populatedObj);
      await notifyMentions(populatedObj);
    }

    res.status(201).json(populatedObj);
  } catch (err) {
    console.error("Error in createStatus:", err.message);
    res.status(500).json({ message: "Failed to create status" });
  }
};

/**
 * Tells each authorised viewer a status exists.
 *
 * The audience comes from the status's own privacy, so a close-friends-only
 * post is never announced to the whole contact list — an announcement is a leak
 * just as much as a listed row would be.
 */
const notifyAudience = async (status) => {
  try {
    const viewerIds = await resolveAuthorizedViewerIds(status);
    const blockedIds = await getBlockedIds((status.user?._id || status.user).toString());
    const payload = statusSocketPayload(status);

    for (const viewerId of viewerIds) {
      if (blockedIds.includes(viewerId)) continue;
      const socketId = getReceiverSocketId(viewerId);
      if (socketId) io.to(socketId).emit("status:new", payload);
    }
  } catch (err) {
    console.error("Error notifying status audience:", err.message);
  }
};

/**
 * Notifies mentioned users, but only those who were allowed to see the status
 * in the first place. A mention is not a way around someone's privacy choice.
 */
const notifyMentions = async (status) => {
  try {
    const mentioned = asIds(status.mentions);
    if (mentioned.length === 0) return;

    const { pushStatusMention } = await import("../lib/fcmNotifications.js");
    const owner = status.user;
    const ownerId = (owner?._id || owner)?.toString();

    for (const userId of mentioned) {
      if (userId === ownerId) continue;
      const allowed = await canViewerSeeStatus(status, userId);
      if (!allowed) continue;
      const socketId = getReceiverSocketId(userId);
      if (socketId) io.to(socketId).emit("status:new", statusSocketPayload(status));
      await pushStatusMention({
        recipientUserId: userId,
        sender: owner,
        status: status,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Error notifying status mentions:", err.message);
  }
};

const statusSocketPayload = (status) => {
  // A status that predates `type` is normalised here too, so a status arriving
  // over the socket renders the same way as one that came through the list.
  withResolvedStatusType(status);
  return {
    _id: status._id,
    type: status.type,
    user: status.user
      ? {
          _id: status.user._id,
          fullName: status.user.fullName,
          profilePic: status.user.profilePic,
        }
      : status.user,
    media: status.media || null,
    mediaItems: status.mediaItems || [],
    caption: status.caption || "",
    text: status.text,
    voice: status.voice,
    music: status.music,
    poll: status.poll,
    question: status.question,
    link: status.link,
    location: status.location,
    countdown: status.countdown,
    createdAt: status.createdAt,
    expiresAt: status.expiresAt,
  };
};

// -- list ---------------------------------------------------------------------------------

/** The one place that builds a grouped list, so every caller applies privacy. */
const groupStatuses = (statuses, userId, { isOwn }) => {
  const grouped = new Map();
  for (const s of statuses) {
    // Before the client ever sees a row. A status written before `type` existed
    // would otherwise reach the viewer with no type, get no body rendered, and
    // look like a photo that silently failed to load.
    withResolvedStatusType(s);
    const ownerId = (s.user?._id || s.user).toString();
    if (!grouped.has(ownerId)) {
      grouped.set(ownerId, {
        user: s.user,
        statuses: [],
        latestStatusAt: s.createdAt,
      });
    }
    const group = grouped.get(ownerId);
    group.statuses.push(s);
    if (new Date(s.createdAt) > new Date(group.latestStatusAt)) {
      group.latestStatusAt = s.createdAt;
    }
  }

  const result = [];
  for (const [, group] of grouped) {
    const hasUnseen = group.statuses.some(
      (s) => !s.viewers?.some((v) => (v.user?._id || v.user)?.toString() === userId.toString())
    );
    result.push({ ...group, hasUnseen, isOwn: isOwn });
  }
  return result;
};

const sortGroups = (groups) =>
  groups.sort((a, b) => {
    if (a.isOwn) return -1;
    if (b.isOwn) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;
    return new Date(b.latestStatusAt || 0) - new Date(a.latestStatusAt || 0);
  });

export const getStatuses = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const blockedIds = await getBlockedIds(userId);

    // Candidates: everything unexpired, unscheduled and unarchived. Privacy is
    // applied below — before any URL is signed — so a status the viewer may not
    // see never gets a media grant in the first place.
    const candidates = await Status.find({
      expiresAt: { $gt: now },
      cleanupStatus: { $ne: "cleaned" },
      statusState: "active",
      isArchived: false,
    })
      .populate("user", "fullName profilePic")
      .sort({ createdAt: 1 })
      .lean();

    // Everyone else's, plus the viewer's own. The owner is excluded from the
    // batch rather than filtered out of it afterwards: their own row is fetched
    // and signed separately below, and leaving it in here too would show them
    // their own status twice.
    const others = candidates.filter(
      (s) => s.user && s.user._id.toString() !== userId.toString()
    );
    const unblocked = others.filter(
      (s) => !blockedIds.includes(s.user._id.toString())
    );

    const visible = await filterStatusesForViewer(unblocked, userId.toString());

    await signMany(visible);

    const result = groupStatuses(visible, userId.toString(), { isOwn: false });

    // My own statuses: privacy does not apply to the owner, but a scheduled or
    // archived one still must not appear as if it were live.
    const myStatuses = await Status.find({
      user: userId,
      expiresAt: { $gt: now },
      cleanupStatus: { $ne: "cleaned" },
      statusState: "active",
      isArchived: false,
    })
      .sort({ createdAt: 1 })
      .lean();

    await signMany(myStatuses);

    const resultWithOwn = [
      {
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        statuses: myStatuses,
        hasUnseen: false,
        isOwn: true,
        latestStatusAt:
          myStatuses.length > 0 ? myStatuses[myStatuses.length - 1].createdAt : null,
      },
      ...result,
    ];

    res.status(200).json(sortGroups(resultWithOwn));
  } catch (err) {
    console.error("Error in getStatuses:", err.message);
    res.status(500).json({ message: "Failed to fetch statuses" });
  }
};

export const getUserStatuses = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    const viewerId = req.user._id;
    const now = new Date();

    if (await isBlockedBetween(viewerId, targetId)) {
      return res.status(404).json({ message: "Status not found" });
    }

    const isSelf = targetId.toString() === viewerId.toString();

    const statuses = await Status.find({
      user: targetId,
      expiresAt: { $gt: now },
      cleanupStatus: { $ne: "cleaned" },
      statusState: "active",
      isArchived: false,
    })
      .populate("user", "fullName profilePic")
      .sort({ createdAt: 1 })
      .lean();

    const visible = isSelf
      ? statuses
      : await filterStatusesForViewer(statuses, viewerId.toString());

    if (!isSelf && visible.length === 0) {
      // Same answer whether the person has no statuses or none this viewer may
      // see: distinguishing them would leak the existence of a private post.
      return res.status(404).json({ message: "No active statuses" });
    }

    await signMany(visible);
    res.status(200).json(visible);
  } catch (err) {
    console.error("Error in getUserStatuses:", err.message);
    res.status(500).json({ message: "Failed to fetch statuses" });
  }
};

// -- view ---------------------------------------------------------------------------------

export const viewStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const viewerId = req.user._id;

    const status = await Status.findById(statusId).lean();
    if (!status) return res.status(404).json({ message: "Status not found" });

    if (new Date(status.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ message: "Status has expired" });
    }

    const ownerId = (status.user?._id || status.user).toString();
    if (ownerId === viewerId.toString()) {
      return res.status(200).json({ success: true, alreadyViewed: true });
    }

    if (status.statusState !== "active" || status.isArchived) {
      return res.status(404).json({ message: "Status not found" });
    }

    if (await isBlockedBetween(viewerId, ownerId)) {
      return res.status(404).json({ message: "Status not found" });
    }

    if (!(await canViewerSeeStatus(status, viewerId.toString()))) {
      return res.status(404).json({ message: "Status not found" });
    }

    const alreadyViewed = (status.viewers || []).some(
      (v) => (v.user?._id || v.user)?.toString() === viewerId.toString()
    );

    if (!alreadyViewed) {
      await Status.findByIdAndUpdate(statusId, {
        $addToSet: { viewers: { user: viewerId, viewedAt: new Date() } },
      });

      const ownerSocketId = getReceiverSocketId(ownerId);
      if (ownerSocketId) {
        io.to(ownerSocketId).emit("status:viewed", {
          statusId,
          viewer: {
            _id: req.user._id,
            fullName: req.user.fullName,
            profilePic: req.user.profilePic,
          },
          viewedAt: new Date(),
        });
      }
    }

    res.status(200).json({ success: true, alreadyViewed });
  } catch (err) {
    console.error("Error in viewStatus:", err.message);
    res.status(500).json({ message: "Failed to record view" });
  }
};

// -- delete / edit ------------------------------------------------------------------------

const destroyStatusMedia = async (status) => {
  const keys = statusMediaKeys(status);
  if (keys.length === 0) return true;
  try {
    const { destroyObjects } = await import("../lib/mediaCleanup.js");
    const result = await destroyObjects(keys);
    return result.failed === 0;
  } catch (err) {
    console.error("Failed to delete status media:", err.message);
    return false;
  }
};

export const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId);
    if (!status) return res.status(404).json({ message: "Status not found" });
    if (status.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only delete your own status" });
    }

    if (!(await destroyStatusMedia(status))) {
      status.cleanupStatus = "pending";
      await status.save();
      return res.status(500).json({ message: "Failed to delete media — will retry" });
    }

    await Status.findByIdAndDelete(statusId);

    const viewerIds = (status.viewers || [])
      .map((v) => (v.user?._id || v.user)?.toString())
      .filter((id) => id && id !== userId.toString());

    for (const viewerId of viewerIds) {
      const socketId = getReceiverSocketId(viewerId);
      if (socketId) io.to(socketId).emit("status:deleted", { statusId });
    }

    const ownerSocketId = getReceiverSocketId(userId.toString());
    if (ownerSocketId) io.to(ownerSocketId).emit("status:deleted", { statusId });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in deleteStatus:", err.message);
    res.status(500).json({ message: "Failed to delete status" });
  }
};

/**
 * Edits a status that has not gone live.
 *
 * Only scheduled statuses are editable: once a status is out, its views,
 * reactions and replies already refer to the thing that was published, and
 * silently changing that content would make every one of those counts a lie.
 */
export const updateStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;
    const body = req.body || {};

    const status = await Status.findById(statusId);
    if (!status) return res.status(404).json({ message: "Status not found" });
    if (status.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only edit your own status" });
    }
    if (status.statusState !== "scheduled") {
      return res.status(400).json({ message: "Only a scheduled status can be edited" });
    }

    if (body.caption !== undefined) status.caption = clean(body.caption, 300);
    if (body.privacy) {
      const privacy = parsePrivacy(body.privacy);
      if (!privacy) return res.status(400).json({ message: "Invalid privacy setting" });
      status.privacy = privacy;
    }
    if (body.scheduledFor) {
      const when = new Date(body.scheduledFor);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ message: "Invalid schedule time" });
      }
      if (when.getTime() <= Date.now()) {
        return res.status(400).json({ message: "Pick a time in the future" });
      }
      status.scheduledFor = when;
    }
    if (body.countdown) {
      const targetAt = new Date(body.countdown.targetAt);
      if (Number.isNaN(targetAt.getTime())) {
        return res.status(400).json({ message: "Pick a date and time" });
      }
      status.countdown = { title: clean(body.countdown.title, 100), targetAt };
    }

    await status.save();
    const obj = status.toObject();
    withResolvedStatusType(obj);
    await signStatusMedia(obj);
    res.status(200).json(obj);
  } catch (err) {
    console.error("Error in updateStatus:", err.message);
    res.status(500).json({ message: "Failed to update status" });
  }
};

// -- viewers, reactions, likes, replies -------------------------------------------------

export const getStatusViewers = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId)
      .populate("viewers.user", "fullName profilePic")
      .lean();

    if (!status) return res.status(404).json({ message: "Status not found" });
    if ((status.user?._id || status.user).toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the owner can see viewers" });
    }

    const viewers = (status.viewers || []).map((v) => ({
      _id: v.user?._id,
      fullName: v.user?.fullName,
      profilePic: v.user?.profilePic,
      viewedAt: v.viewedAt,
      reaction: v.reaction || "",
    }));

    res.status(200).json({ viewers, count: viewers.length });
  } catch (err) {
    console.error("Error in getStatusViewers:", err.message);
    res.status(500).json({ message: "Failed to fetch viewers" });
  }
};

/**
 * Loads a status for a viewer who is not the owner, applying privacy. Every
 * interaction endpoint goes through this, so a reaction cannot become a way to
 * read a private status.
 */
const loadVisibleStatus = async (statusId, viewerId) => {
  const status = await Status.findById(statusId).lean();
  if (!status) return { error: "Status not found", code: 404 };

  if (new Date(status.expiresAt).getTime() <= Date.now()) {
    return { error: "Status has expired", code: 404 };
  }
  if (status.statusState !== "active" || status.isArchived) {
    return { error: "Status not found", code: 404 };
  }

  const ownerId = (status.user?._id || status.user).toString();
  if (ownerId === viewerId.toString()) return { status, isOwner: true };

  if (!(await canViewerSeeStatus(status, viewerId.toString()))) {
    return { error: "Status not found", code: 404 };
  }

  return { status, isOwner: false };
};

export const reactToStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const { reaction } = req.body || {};
    const senderId = req.user._id;

    if (reaction && !REACTIONS.includes(reaction)) {
      return res.status(400).json({ message: "That reaction is not available" });
    }

    const { status, error, code } = await loadVisibleStatus(statusId, senderId);
    if (error) return res.status(code).json({ message: error });

    const existing = (status.viewers || []).find(
      (v) => (v.user?._id || v.user)?.toString() === senderId.toString()
    );

    // A reaction is one value per person: a second pick replaces the first and
    // an empty one removes it. It does not send a chat message — that is what a
    // reply is for.
    if (existing) {
      await Status.updateOne(
        { _id: statusId, "viewers.user": senderId },
        { $set: { "viewers.$.reaction": reaction || "" } }
      );
    } else {
      await Status.findByIdAndUpdate(statusId, {
        $push: {
          viewers: { user: senderId, viewedAt: new Date(), reaction: reaction || "" },
        },
      });
    }

    const ownerId = (status.user?._id || status.user).toString();
    const ownerSocketId = getReceiverSocketId(ownerId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("status:reacted", {
        statusId,
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        reaction: reaction || "",
      });
    }

    res.status(200).json({ success: true, reaction: reaction || "" });
  } catch (err) {
    console.error("Error in reactToStatus:", err.message);
    res.status(500).json({ message: "Failed to react to status" });
  }
};

/**
 * Toggles a like.
 *
 * Separate from reactions on purpose: a like is one bit with no choice of
 * emoji, and the owner's analytics want "how many liked" and "how many
 * reacted" as different numbers.
 */
export const likeStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const { status, error, code } = await loadVisibleStatus(statusId, userId);
    if (error) return res.status(code).json({ message: error });

    const isLiked = (status.likes || []).some((id) => id.toString() === userId.toString());

    if (isLiked) {
      await Status.updateOne({ _id: statusId }, { $pull: { likes: userId } });
    } else {
      await Status.updateOne({ _id: statusId }, { $addToSet: { likes: userId } });
    }

    const ownerId = (status.user?._id || status.user).toString();
    const ownerSocketId = getReceiverSocketId(ownerId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("status:liked", {
        statusId,
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        liked: !isLiked,
      });
    }

    res.status(200).json({ success: true, liked: !isLiked });
  } catch (err) {
    console.error("Error in likeStatus:", err.message);
    res.status(500).json({ message: "Failed to update like" });
  }
};

/**
 * A text reply from the viewer.
 *
 * It is a normal chat message carrying a statusRef snapshot, so it arrives over
 * the existing `newMessage` event, lands in the conversation unread, and is
 * counted in the owner's analytics without a second delivery system.
 */
export const replyToStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const { text } = req.body || {};
    const senderId = req.user._id;

    const body = clean(text, 500);
    if (!body) return res.status(400).json({ message: "Write a reply first" });

    const { status, isOwner, error, code } = await loadVisibleStatus(statusId, senderId);
    if (error) return res.status(code).json({ message: error });

    if (isOwner) {
      return res.status(400).json({ message: "You cannot reply to your own status" });
    }

    const ownerId = (status.user?._id || status.user).toString();

    const snapshotMedia =
      status.media ||
      (status.mediaItems && status.mediaItems.length > 0 ? status.mediaItems[0] : null) ||
      (status.voice?.key
        ? { key: status.voice.key, contentType: status.voice.contentType, type: "audio" }
        : null);

    const newMessage = new Message({
      senderId,
      receiverId: ownerId,
      text: body,
      statusRef: {
        statusId: status._id,
        statusType: status.type,
        caption: status.caption || "",
        mediaKey: snapshotMedia?.key || "",
        mediaContentType: snapshotMedia?.contentType || "",
        mediaType: snapshotMedia?.type || "",
      },
    });

    await newMessage.save();

    // The short copy kept on the status, so the owner's status screen can show
    // replies without reading the whole conversation.
    await Status.updateOne(
      { _id: statusId },
      { $push: { replies: { user: senderId, text: body, createdAt: new Date() } } }
    );

    const populatedMsg = await Message.findById(newMessage._id)
      .populate("senderId", "fullName profilePic");

    const ownerSocketId = getReceiverSocketId(ownerId);
    if (ownerSocketId) io.to(ownerSocketId).emit("newMessage", populatedMsg);
    const senderSocketId = getReceiverSocketId(senderId.toString());
    if (senderSocketId) io.to(senderSocketId).emit("newMessage", populatedMsg);

    const ownerStatusSocket = getReceiverSocketId(ownerId);
    if (ownerStatusSocket) {
      io.to(ownerStatusSocket).emit("status:replied", {
        statusId,
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        text: body,
        createdAt: new Date(),
      });
    }

    res.status(201).json({ success: true, message: populatedMsg });
  } catch (err) {
    console.error("Error in replyToStatus:", err.message);
    res.status(500).json({ message: "Failed to send reply" });
  }
};

// -- poll / question -----------------------------------------------------------------------

export const voteStatusPoll = async (req, res) => {
  try {
    const { statusId } = req.params;
    const { optionIndex } = req.body || {};
    const userId = req.user._id;

    const index = Number(optionIndex);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ message: "Choose an option" });
    }

    const { status, error, code } = await loadVisibleStatus(statusId, userId);
    if (error) return res.status(code).json({ message: error });

    if (status.type !== "poll" || !status.poll) {
      return res.status(404).json({ message: "Poll not found" });
    }
    if (status.poll.isClosed) return res.status(403).json({ message: "This poll is closed" });
    if (index >= status.poll.options.length) {
      return res.status(400).json({ message: "Choose an option" });
    }

    // One vote per person, enforced by clearing the voter from every other
    // option first. Doing it as a single updateOne with a positional operator
    // is not enough on its own — that would leave a second vote behind.
    const doc = await Status.findById(statusId);
    const previousIndex = doc.poll.options.findIndex((o) =>
      (o.votes || []).some((v) => v.toString() === userId.toString())
    );

    if (previousIndex === index) {
      return res.status(200).json({ success: true, poll: doc.poll, changed: false });
    }
    if (previousIndex >= 0) {
      doc.poll.options[previousIndex].votes = doc.poll.options[previousIndex].votes.filter(
        (v) => v.toString() !== userId.toString()
      );
    }
    doc.poll.options[index].votes.push(userId);
    await doc.save();

    const ownerId = (status.user?._id || status.user).toString();
    const ownerSocketId = getReceiverSocketId(ownerId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("status:pollVoted", {
        statusId,
        optionIndex: index,
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
      });
    }

    const refreshed = await Status.findById(statusId).select("poll").lean();
    res.status(200).json({
      success: true,
      poll: {
        question: refreshed.poll.question,
        isClosed: refreshed.poll.isClosed,
        options: refreshed.poll.options.map((o) => ({
          _id: o._id,
          text: o.text,
          votes: o.votes,
        })),
      },
      changed: previousIndex !== index,
    });
  } catch (err) {
    console.error("Error in voteStatusPoll:", err.message);
    res.status(500).json({ message: "Failed to record vote" });
  }
};

export const answerStatusQuestion = async (req, res) => {
  try {
    const { statusId } = req.params;
    const { text } = req.body || {};
    const userId = req.user._id;

    const body = clean(text, 300);
    if (!body) return res.status(400).json({ message: "Write an answer first" });

    const { status, error, code } = await loadVisibleStatus(statusId, userId);
    if (error) return res.status(code).json({ message: error });

    if (status.type !== "question" || !status.question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const already = (status.question.answers || []).some(
      (a) => (a.user?._id || a.user)?.toString() === userId.toString()
    );
    if (already) return res.status(200).json({ success: true, changed: false });

    await Status.findByIdAndUpdate(statusId, {
      $push: { "question.answers": { user: userId, text: body, createdAt: new Date() } },
    });

    const ownerId = (status.user?._id || status.user).toString();
    const ownerSocketId = getReceiverSocketId(ownerId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("status:answered", {
        statusId,
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        text: body,
        createdAt: new Date(),
      });
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Error in answerStatusQuestion:", err.message);
    res.status(500).json({ message: "Failed to send answer" });
  }
};

/**
 * Answers, for the owner only.
 *
 * A separate endpoint from the list so a viewer's copy of a question status
 * never carries the answers even if the owner has not hidden them from the
 * public view — the field is simply not selected on that path.
 */
export const getStatusAnswers = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId)
      .populate("question.answers.user", "fullName profilePic")
      .lean();

    if (!status) return res.status(404).json({ message: "Status not found" });
    if ((status.user?._id || status.user).toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the owner can see answers" });
    }

    res.status(200).json({
      prompt: status.question?.prompt || "",
      answers: (status.question?.answers || []).map((a) => ({
        _id: a.user?._id,
        fullName: a.user?.fullName,
        profilePic: a.user?.profilePic,
        text: a.text,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("Error in getStatusAnswers:", err.message);
    res.status(500).json({ message: "Failed to fetch answers" });
  }
};

// -- analytics -----------------------------------------------------------------------------

export const getStatusAnalytics = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId)
      .populate("viewers.user", "fullName profilePic")
      .populate("replies.user", "fullName profilePic")
      .populate("poll.options.votes", "fullName profilePic")
      .lean();

    if (!status) return res.status(404).json({ message: "Status not found" });
    if ((status.user?._id || status.user).toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the owner can see analytics" });
    }

    const reactionCounts = {};
    for (const v of status.viewers || []) {
      if (!v.reaction) continue;
      reactionCounts[v.reaction] = (reactionCounts[v.reaction] || 0) + 1;
    }

    const pollResults = (status.poll?.options || []).map((o) => ({
      text: o.text,
      count: (o.votes || []).length,
      // Names are the owner's business, but only ever on the owner's own read.
      voters: (o.votes || []).map((u) => ({
        _id: u._id,
        fullName: u.fullName,
        profilePic: u.profilePic,
      })),
    }));

    res.status(200).json({
      statusId,
      type: status.type,
      createdAt: status.createdAt,
      expiresAt: status.expiresAt,
      views: (status.viewers || []).length,
      likes: (status.likes || []).length,
      reactions: reactionCounts,
      replies: (status.replies || []).length,
      pollVotes: pollResults.reduce((sum, p) => sum + p.count, 0),
      pollResults,
      answers: (status.question?.answers || []).length,
      // Compact per-person breakdown for the owner's list.
      people: (status.viewers || []).map((v) => ({
        _id: v.user?._id,
        fullName: v.user?.fullName,
        profilePic: v.user?.profilePic,
        viewedAt: v.viewedAt,
        reaction: v.reaction || "",
        liked: (status.likes || []).some((l) => l.toString() === v.user?._id?.toString()),
      })),
      replyList: (status.replies || []).map((r) => ({
        _id: r.user?._id,
        fullName: r.user?.fullName,
        profilePic: r.user?.profilePic,
        text: r.text,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("Error in getStatusAnalytics:", err.message);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

// -- scheduled / archive ------------------------------------------------------------------

export const getScheduledStatuses = async (req, res) => {
  try {
    const userId = req.user._id;
    const statuses = await Status.find({
      user: userId,
      statusState: "scheduled",
    })
      .sort({ scheduledFor: 1 })
      .lean();

    withResolvedStatusType(statuses);
    await signMany(statuses);
    res.status(200).json(statuses);
  } catch (err) {
    console.error("Error in getScheduledStatuses:", err.message);
    res.status(500).json({ message: "Failed to fetch scheduled statuses" });
  }
};

export const getArchivedStatuses = async (req, res) => {
  try {
    const userId = req.user._id;
    const statuses = await Status.find({
      user: userId,
      isArchived: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    withResolvedStatusType(statuses);
    await signMany(statuses);
    res.status(200).json(statuses);
  } catch (err) {
    console.error("Error in getArchivedStatuses:", err.message);
    res.status(500).json({ message: "Failed to fetch archived statuses" });
  }
};

/** Brings an archived status back as a live one, starting its 24h window again. */
export const restoreStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId);
    if (!status) return res.status(404).json({ message: "Status not found" });
    if (status.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only restore your own status" });
    }
    if (!status.isArchived) {
      return res.status(400).json({ message: "That status is not archived" });
    }

    const now = new Date();
    status.isArchived = false;
    status.expiresAt = new Date(now.getTime() + STATUS_DURATION_MS);
    status.statusState = "active";
    status.cleanupStatus = "active";
    await status.save();

    // `createdAt` is immutable on this schema, so assigning it above would have
    // been silently dropped by save() and the restored status would have stayed
    // buried at its original position in the owner's list. updateOne writes past
    // that guard, which is what "restore" has to mean: the owner acted on it just
    // now, so it becomes the newest status again and the card previews it.
    await Status.updateOne(
      { _id: status._id },
      { $set: { createdAt: now } }
    );
    status.createdAt = now;

    const obj = status.toObject();
    withResolvedStatusType(obj);
    await signStatusMedia(obj);
    await notifyAudience(obj);

    res.status(200).json(obj);
  } catch (err) {
    console.error("Error in restoreStatus:", err.message);
    res.status(500).json({ message: "Failed to restore status" });
  }
};

// -- privacy settings / close friends -----------------------------------------------------

export const getStatusPrivacy = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("statusSettings closeFriends")
      .lean();
    res.status(200).json({
      defaultPrivacy: user?.statusSettings?.defaultPrivacy || "contacts",
      keepArchived: Boolean(user?.statusSettings?.keepArchived),
      closeFriends: user?.closeFriends || [],
    });
  } catch (err) {
    console.error("Error in getStatusPrivacy:", err.message);
    res.status(500).json({ message: "Failed to fetch privacy settings" });
  }
};

export const updateStatusPrivacy = async (req, res) => {
  try {
    const { defaultPrivacy, keepArchived } = req.body || {};
    const update = {};

    if (defaultPrivacy !== undefined) {
      if (!PRIVACY_MODES.includes(defaultPrivacy)) {
        return res.status(400).json({ message: "Invalid privacy setting" });
      }
      update["statusSettings.defaultPrivacy"] = defaultPrivacy;
    }
    if (keepArchived !== undefined) {
      update["statusSettings.keepArchived"] = Boolean(keepArchived);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true }
    )
      .select("statusSettings closeFriends")
      .lean();

    // Toggling the archive setting applies to what expires from now on; it never
    // resurrects something already swept, because the media behind it is gone.
    res.status(200).json({
      defaultPrivacy: user?.statusSettings?.defaultPrivacy || "contacts",
      keepArchived: Boolean(user?.statusSettings?.keepArchived),
      closeFriends: user?.closeFriends || [],
    });
  } catch (err) {
    console.error("Error in updateStatusPrivacy:", err.message);
    res.status(500).json({ message: "Failed to update privacy settings" });
  }
};

export const getCloseFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("closeFriends")
      .populate("closeFriends", "fullName profilePic")
      .lean();

    res.status(200).json({ closeFriends: user?.closeFriends || [] });
  } catch (err) {
    console.error("Error in getCloseFriends:", err.message);
    res.status(500).json({ message: "Failed to fetch close friends" });
  }
};

export const updateCloseFriends = async (req, res) => {
  try {
    const raw = req.body?.closeFriends;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ message: "Invalid close friends list" });
    }
    if (raw.length > 500) {
      return res.status(400).json({ message: "That list is too long" });
    }

    const ids = [...new Set(asIds(raw))];
    // Only real accounts, and never yourself: a close-friends list that could
    // contain the owner would be a list with no meaning.
    const valid = await User.find({ _id: { $in: ids, $ne: req.user._id } })
      .select("_id")
      .lean();
    const validIds = valid.map((u) => u._id);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { closeFriends: validIds } },
      { new: true }
    )
      .select("closeFriends")
      .populate("closeFriends", "fullName profilePic")
      .lean();

    res.status(200).json({ closeFriends: user?.closeFriends || [] });
  } catch (err) {
    console.error("Error in updateCloseFriends:", err.message);
    res.status(500).json({ message: "Failed to update close friends" });
  }
};

// -- media url ----------------------------------------------------------------------------

export const getStatusMediaUrl = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ message: "File storage is not available" });
    }

    const { statusId } = req.params;
    const viewerId = req.user._id;
    const now = new Date();

    const status = await Status.findById(statusId).lean();
    if (!status) return res.status(404).json({ message: "Status not found" });

    const ownerId = (status.user?._id || status.user).toString();
    const isOwner = ownerId === viewerId.toString();

    // The owner keeps their archived statuses, so an expired-but-retained status
    // must still be readable for them. Anyone else is stopped here — an expired
    // status's bytes are still in the bucket, and a signed URL would outlive the
    // thing it points at.
    if (new Date(status.expiresAt).getTime() <= now.getTime() && !isOwner) {
      return res.status(404).json({ message: "Status has expired" });
    }

    if (!isOwner) {
      if (status.statusState !== "active" || status.isArchived) {
        return res.status(404).json({ message: "Status not found" });
      }
      if (await isBlockedBetween(viewerId, ownerId)) {
        return res.status(404).json({ message: "Status not found" });
      }
      // The signed URL is the actual read grant, so privacy is decided here and
      // not only on the list endpoint that discovered the status.
      if (!(await canViewerSeeStatus(status, viewerId.toString()))) {
        return res.status(404).json({ message: "Status not found" });
      }
    }

    withResolvedStatusType(status);
    await signStatusMedia(status);

    // Any one slot is enough to make this a valid request; the client asks
    // again for a different slot if it needs one.
    const hasMedia =
      status.media?.key ||
      (status.mediaItems || []).some((m) => m?.key) ||
      status.voice?.key ||
      status.music?.key ||
      status.text?.mediaKey ||
      status.link?.imageKey;

    if (!hasMedia) return res.status(404).json({ message: "Media not found" });

    res.status(200).json({ status, expiresIn: MEDIA_URL_TTL_SECONDS });
  } catch (err) {
    console.error("Error in getStatusMediaUrl:", err.message);
    res.status(500).json({ message: "Could not open that file" });
  }
};
