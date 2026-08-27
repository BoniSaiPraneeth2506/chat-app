import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorage, storageBucket, isStorageConfigured } from "../lib/storage.js";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

const STATUS_DURATION_MS = 24 * 60 * 60 * 1000;
const MEDIA_URL_TTL_SECONDS = 3600; // 1 hour

export const signStatusMedia = async (status) => {
  if (!status || !status.media?.key || !isStorageConfigured()) return status;
  try {
    const url = await getSignedUrl(
      getStorage(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: status.media.key,
        ResponseContentType: status.media.contentType || undefined,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: MEDIA_URL_TTL_SECONDS }
    );
    status.media.url = url;
  } catch (e) {
    // Keep as is
  }
  return status;
};

const isBlockedBetween = async (a, b) => {
  if (!a || !b) return false;
  const [aDoc, bDoc] = await Promise.all([
    User.findById(a).select("blockedUsers").lean(),
    User.findById(b).select("blockedUsers").lean(),
  ]);
  const aBlocks = (aDoc?.blockedUsers || []).map((id) => id.toString());
  const bBlocks = (bDoc?.blockedUsers || []).map((id) => id.toString());
  return aBlocks.includes(b.toString()) || bBlocks.includes(a.toString());
};

export const createStatus = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ message: "File storage is not available" });
    }

    const { key, type, fileName, contentType, size, duration, caption } = req.body || {};
    const userId = req.user._id;

    if (!key || !type) {
      return res.status(400).json({ message: "Media key and type are required" });
    }

    if (!["image", "video"].includes(type)) {
      return res.status(400).json({ message: "Only image and video statuses are supported" });
    }

    if (!key.startsWith("image/") && !key.startsWith("video/")) {
      return res.status(400).json({ message: "Invalid attachment reference" });
    }

    try {
      const s3 = getStorage();
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: storageBucket(), Key: key })
      );
      if (!head || head.$metadata?.httpStatusCode === 404) {
        return res.status(400).json({ message: "Upload not found — please try again" });
      }
    } catch {
      return res.status(400).json({ message: "Upload not found — please try again" });
    }

    const now = new Date();
    const status = new Status({
      user: userId,
      media: {
        type,
        key,
        url: "",
        fileName: fileName || "",
        contentType: contentType || "",
        size: size || 0,
        duration: duration || 0,
      },
      caption: caption || "",
      createdAt: now,
      expiresAt: new Date(now.getTime() + STATUS_DURATION_MS),
    });

    await status.save();

    const populated = await status.populate("user", "fullName profilePic");
    const populatedObj = populated.toObject();
    await signStatusMedia(populatedObj);

    const viewerIds = await getAuthorizedViewerIds(userId);
    for (const viewerId of viewerIds) {
      const socketId = getReceiverSocketId(viewerId);
      if (socketId) {
        io.to(socketId).emit("status:new", {
          _id: populatedObj._id,
          user: {
            _id: populatedObj.user._id,
            fullName: populatedObj.user.fullName,
            profilePic: populatedObj.user.profilePic,
          },
          media: populatedObj.media,
          caption: populatedObj.caption,
          createdAt: populatedObj.createdAt,
          expiresAt: populatedObj.expiresAt,
        });
      }
    }

    res.status(201).json(populatedObj);
  } catch (err) {
    console.error("Error in createStatus:", err.message);
    res.status(500).json({ message: "Failed to create status" });
  }
};

export const getStatuses = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const blockedIds = await getBlockedIds(userId);

    const statuses = await Status.find({
      expiresAt: { $gt: now },
      cleanupStatus: { $ne: "cleaned" },
    })
      .populate("user", "fullName profilePic")
      .sort({ createdAt: 1 })
      .lean();

    const filtered = statuses.filter(
      (s) =>
        s.user &&
        s.user._id.toString() !== userId.toString() &&
        !blockedIds.includes(s.user._id.toString())
    );

    // Pre-sign all media URLs in parallel for instant display
    await Promise.all(filtered.map(signStatusMedia));

    const grouped = new Map();
    for (const s of filtered) {
      const ownerId = s.user._id.toString();
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

    const myStatuses = await Status.find({
      user: userId,
      expiresAt: { $gt: now },
      cleanupStatus: { $ne: "cleaned" },
    })
      .sort({ createdAt: 1 })
      .lean();

    await Promise.all(myStatuses.map(signStatusMedia));

    const myHasUnseen = false;
    const myLatestStatusAt = myStatuses.length > 0
      ? myStatuses[myStatuses.length - 1].createdAt
      : null;

    const result = [];

    if (myStatuses.length > 0) {
      result.push({
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        statuses: myStatuses,
        hasUnseen: myHasUnseen,
        isOwn: true,
        latestStatusAt: myLatestStatusAt,
      });
    } else {
      result.push({
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        statuses: [],
        hasUnseen: false,
        isOwn: true,
        latestStatusAt: null,
      });
    }

    for (const [, group] of grouped) {
      const hasUnseen = group.statuses.some((s) =>
        !s.viewers?.some((v) => v.user?.toString() === userId.toString())
      );
      result.push({
        ...group,
        hasUnseen,
        isOwn: false,
      });
    }

    result.sort((a, b) => {
      if (a.isOwn) return -1;
      if (b.isOwn) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return new Date(b.latestStatusAt || 0) - new Date(a.latestStatusAt || 0);
    });

    res.status(200).json(result);
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

    const statuses = await Status.find({
      user: targetId,
      expiresAt: { $gt: now },
      cleanupStatus: { $ne: "cleaned" },
    })
      .populate("user", "fullName profilePic")
      .sort({ createdAt: 1 })
      .lean();

    if (statuses.length === 0) {
      return res.status(404).json({ message: "No active statuses" });
    }

    res.status(200).json(statuses);
  } catch (err) {
    console.error("Error in getUserStatuses:", err.message);
    res.status(500).json({ message: "Failed to fetch statuses" });
  }
};

export const viewStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const viewerId = req.user._id;

    const status = await Status.findById(statusId).lean();
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    if (new Date(status.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ message: "Status has expired" });
    }

    if (status.user.toString() === viewerId.toString()) {
      return res.status(200).json({ success: true, alreadyViewed: true });
    }

    if (await isBlockedBetween(viewerId, status.user)) {
      return res.status(404).json({ message: "Status not found" });
    }

    const alreadyViewed = (status.viewers || []).some(
      (v) => v.user?.toString() === viewerId.toString()
    );

    if (!alreadyViewed) {
      await Status.findByIdAndUpdate(statusId, {
        $addToSet: {
          viewers: { user: viewerId, viewedAt: new Date() },
        },
      });

      const ownerSocketId = getReceiverSocketId(status.user.toString());
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

export const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId);
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    if (status.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only delete your own status" });
    }

    if (status.media?.key) {
      try {
        const { destroyObjects } = await import("../lib/mediaCleanup.js");
        await destroyObjects([status.media.key]);
      } catch (err) {
        console.error("Failed to delete status media from B2:", err.message);
        status.cleanupStatus = "pending";
        await status.save();
        return res.status(500).json({ message: "Failed to delete media — will retry" });
      }
    }

    await Status.findByIdAndDelete(statusId);

    const viewerIds = (status.viewers || [])
      .map((v) => v.user?.toString())
      .filter((id) => id && id !== userId.toString());

    for (const viewerId of viewerIds) {
      const socketId = getReceiverSocketId(viewerId);
      if (socketId) {
        io.to(socketId).emit("status:deleted", { statusId });
      }
    }

    const ownerSocketId = getReceiverSocketId(userId.toString());
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("status:deleted", { statusId });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in deleteStatus:", err.message);
    res.status(500).json({ message: "Failed to delete status" });
  }
};

export const getStatusViewers = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findById(statusId)
      .populate("viewers.user", "fullName profilePic")
      .lean();

    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    if (status.user.toString() !== userId.toString()) {
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

export const reactToStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const { reaction, text, isLikeToggle } = req.body || {};
    const senderId = req.user._id;

    const status = await Status.findById(statusId).populate("user", "fullName profilePic").lean();
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    const ownerId = status.user._id.toString();

    // If reaction is empty string or explicitly null -> unlike
    const isUnlike = reaction === "" || reaction === null;
    const reactionEmoji = isUnlike ? "" : (reaction || (text ? "" : "❤️"));

    const existingViewer = (status.viewers || []).find(
      (v) => v.user?.toString() === senderId.toString()
    );

    if (existingViewer) {
      await Status.updateOne(
        { _id: statusId, "viewers.user": senderId },
        { $set: { "viewers.$.reaction": reactionEmoji } }
      );
    } else {
      await Status.findByIdAndUpdate(statusId, {
        $push: {
          viewers: {
            user: senderId,
            viewedAt: new Date(),
            reaction: reactionEmoji,
          },
        },
      });
    }

    // Notify status owner in real-time
    const ownerSocketId = getReceiverSocketId(ownerId);
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("status:reacted", {
        statusId,
        user: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        reaction: reactionEmoji,
      });
    }

    // ONLY send a message to individual chat for quick emoji strip reactions or text replies (NOT for like toggle)
    let populatedMsg = null;
    if (!isLikeToggle && !isUnlike) {
      const messageBody = text
        ? `Replied to status: ${text}`
        : `Reacted ${reactionEmoji} to status`;

      const newMessage = new Message({
        senderId,
        receiverId: ownerId,
        text: messageBody,
      });
      await newMessage.save();

      populatedMsg = await Message.findById(newMessage._id).populate("senderId", "fullName profilePic");

      if (ownerSocketId) {
        io.to(ownerSocketId).emit("newMessage", populatedMsg);
      }
      const senderSocketId = getReceiverSocketId(senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit("newMessage", populatedMsg);
      }
    }

    res.status(200).json({ success: true, reaction: reactionEmoji, message: populatedMsg });
  } catch (err) {
    console.error("Error in reactToStatus:", err.message);
    res.status(500).json({ message: "Failed to react to status" });
  }
};

export const getStatusMediaUrl = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ message: "File storage is not available" });
    }

    const { statusId } = req.params;
    const viewerId = req.user._id;
    const now = new Date();

    const status = await Status.findById(statusId).lean();
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    if (new Date(status.expiresAt).getTime() <= now.getTime()) {
      return res.status(404).json({ message: "Status has expired" });
    }

    if (status.user.toString() !== viewerId.toString()) {
      if (await isBlockedBetween(viewerId, status.user)) {
        return res.status(404).json({ message: "Status not found" });
      }
    }

    if (!status.media?.key) {
      return res.status(404).json({ message: "Media not found" });
    }

    const url = await getSignedUrl(
      getStorage(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: status.media.key,
        ResponseContentType: status.media.contentType || undefined,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: MEDIA_URL_TTL_SECONDS }
    );

    res.status(200).json({ url, expiresIn: MEDIA_URL_TTL_SECONDS });
  } catch (err) {
    console.error("Error in getStatusMediaUrl:", err.message);
    res.status(500).json({ message: "Could not open that file" });
  }
};

async function getBlockedIds(userId) {
  try {
    const user = await User.findById(userId).select("blockedUsers").lean();
    const myBlocked = (user?.blockedUsers || []).map((id) => id.toString());

    const blockers = await User.find({ blockedUsers: userId })
      .select("_id")
      .lean();
    const blockedBy = blockers.map((u) => u._id.toString());

    return [...new Set([...myBlocked, ...blockedBy])];
  } catch {
    return [];
  }
}

async function getAuthorizedViewerIds(userId) {
  try {
    const blockedIds = await getBlockedIds(userId);
    const allUsers = await User.find({
      _id: { $ne: userId },
    })
      .select("_id")
      .lean();
    return allUsers
      .map((u) => u._id.toString())
      .filter((id) => !blockedIds.includes(id));
  } catch {
    return [];
  }
}
