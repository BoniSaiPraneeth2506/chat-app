import crypto from "crypto";
import mongoose from "mongoose";
import Channel from "../models/channel.model.js";
import ChannelFollower from "../models/channelFollower.model.js";
import ChannelPost from "../models/channelPost.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorage, storageBucket, isStorageConfigured } from "../lib/storage.js";
import { sendPushNotification } from "../lib/fcmNotifications.js";

const MEDIA_URL_TTL_SECONDS = 3600;

// ── Access control — never trust the frontend's idea of roles ─────────────────
// Every handler re-derives the caller's role from the database. A client that
// fabricates an "owner" or "admin" id on a request finds the server reads the
// stored relationships instead.

const isOwner = (channel, userId) =>
  channel?.owner && String(channel.owner._id || channel.owner) === String(userId);

const isAdmin = (channel, userId) =>
  (channel?.admins || []).some((a) => String(a.user?._id || a.user) === String(userId));

const isOwnerOrAdmin = (channel, userId) => isOwner(channel, userId) || isAdmin(channel, userId);

const canPost = (channel, userId) => isOwnerOrAdmin(channel, userId);

const signPostMedia = async (post) => {
  if (!post || !post.media?.key || !isStorageConfigured()) return post;
  try {
    post.media.url = await getSignedUrl(
      getStorage(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: post.media.key,
        ResponseContentType: post.media.contentType || undefined,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: MEDIA_URL_TTL_SECONDS }
    );
  } catch {
    // Leave blank — caller requests a fresh URL on demand.
  }
  return post;
};

const signPosts = async (posts) => {
  if (!Array.isArray(posts)) return posts;
  await Promise.all(posts.map(signPostMedia));
  return posts;
};

const blockedIdsBetween = async (a, b) => {
  if (!a || !b) return false;
  const [aDoc, bDoc] = await Promise.all([
    User.findById(a).select("blockedUsers").lean(),
    User.findById(b).select("blockedUsers").lean(),
  ]);
  const aBlocks = (aDoc?.blockedUsers || []).map((id) => id.toString());
  const bBlocks = (bDoc?.blockedUsers || []).map((id) => id.toString());
  return aBlocks.includes(b.toString()) || bBlocks.includes(a.toString());
};

// ── Create / read / update / delete ───────────────────────────────────────────

export const createChannel = async (req, res) => {
  try {
    const { name, description, avatar, category, privacy } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Channel name is required" });
    }
    if (name.trim().length > 50) {
      return res.status(400).json({ message: "Channel name is too long (max 50)" });
    }

    const channel = new Channel({
      name: name.trim(),
      description: (description || "").trim(),
      avatar: avatar || "",
      category: (category || "").trim(),
      privacy: privacy === "private" ? "private" : "public",
      owner: req.user._id,
    });
    await channel.save();

    // The owner follows their own channel automatically so the Joined list and
    // feed always resolve.
    await ChannelFollower.updateOne(
      { channel: channel._id, user: req.user._id },
      { $setOnInsert: { channel: channel._id, user: req.user._id, muted: false } },
      { upsert: true }
    );
    await Channel.updateOne({ _id: channel._id }, { $set: { followerCount: 1 } });

    const populated = await channel.populate("owner", "fullName profilePic");
    res.status(201).json(populated.toObject());
  } catch (err) {
    console.error("Error in createChannel:", err.message);
    res.status(500).json({ message: "Failed to create channel" });
  }
};

export const getChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(channelId || ""))) {
      return res.status(400).json({ message: "Invalid channel id" });
    }
    const userId = req.user._id;

    const channel = await Channel.findById(channelId)
      .populate("owner", "fullName profilePic")
      .populate("admins.user", "fullName profilePic")
      .lean();
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.privacy === "private") {
      const isMember = await ChannelFollower.exists({ channel: channelId, user: userId });
      if (!isMember) {
        // Do not disclose the existence of a private channel.
        return res.status(404).json({ message: "Channel not found" });
      }
    }

    if (channel.owner && String(channel.owner._id) !== String(userId)) {
      if (await blockedIdsBetween(channel.owner._id, userId)) {
        return res.status(404).json({ message: "Channel not found" });
      }
    }

    const membership = await ChannelFollower.findOne({ channel: channelId, user: userId })
      .lean();
    const isFollowing = Boolean(membership);

    res.status(200).json({
      ...channel,
      isFollowing,
      isMuted: membership?.muted || false,
      isOwner: isOwner(channel, userId),
      isAdmin: isAdmin(channel, userId),
    });
  } catch (err) {
    console.error("Error in getChannel:", err.message);
    res.status(500).json({ message: "Failed to fetch channel" });
  }
};

export const getMyChannels = async (req, res) => {
  try {
    const userId = req.user._id;

    // Owned + followed channels, interleaved by most recent activity. Private
    // channels a user follows are fine to return — they chose to follow.
    const follows = await ChannelFollower.find({ user: userId })
      .select("channel muted followedAt")
      .lean();

    const channelIds = [
      ...new Set((follows || []).map((f) => String(f.channel))),
    ];
    if (channelIds.length === 0) return res.status(200).json([]);

    const channels = await Channel.find({ _id: { $in: channelIds } })
      .populate("owner", "fullName profilePic")
      .sort({ updatedAt: -1 })
      .lean();

    const mutedByChannel = new Map(
      (follows || []).filter((f) => f?.muted).map((f) => [String(f.channel), true])
    );

    // Latest post preview per channel — one query, grouped in memory. Gives the
    // Joined list the same "latest activity" line a chat list has.
    const latestPosts = await ChannelPost.aggregate([
      { $match: { channel: { $in: channelIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$channel",
          text: { $first: "$text" },
          hasMedia: { $first: { $ne: ["$media", null] } },
          mediaType: { $first: "$media.type" },
          createdAt: { $first: "$createdAt" },
        },
      },
    ]);
    const latestByChannel = new Map(latestPosts.map((p) => [String(p._id), p]));

    const result = channels.map((c) => {
      const latest = latestByChannel.get(String(c._id));
      return {
        ...c,
        latestPost: latest || null,
        isFollowing: true,
        isMuted: mutedByChannel.has(String(c._id)),
        isOwner: isOwner(c, userId),
        isAdmin: isAdmin(c, userId),
      };
    });

    res.status(200).json(result);
  } catch (err) {
    console.error("Error in getMyChannels:", err.message);
    res.status(500).json({ message: "Failed to fetch channels" });
  }
};

export const exploreChannels = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const channels = await Channel.find({ privacy: "public", followerCount: { $gt: 0 } })
      .populate("owner", "fullName profilePic")
      .sort({ followerCount: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const followed = new Set(
      (
        await ChannelFollower.find({ user: userId }).select("channel").lean()
      ).map((f) => String(f.channel))
    );

    const ownId = String(userId);
    const result = [];
    for (const c of channels) {
      if (isOwner(c, ownId)) continue;
      if (c.owner?._id && (await blockedIdsBetween(c.owner._id, userId))) continue;
      result.push({
        ...c,
        isFollowing: followed.has(String(c._id)),
        isOwner: false,
        isAdmin: false,
      });
    }
    res.status(200).json(result);
  } catch (err) {
    console.error("Error in exploreChannels:", err.message);
    res.status(500).json({ message: "Failed to explore channels" });
  }
};

export const searchChannels = async (req, res) => {
  try {
    const userId = req.user._id;
    const q = (req.query.q || "").trim();
    const category = (req.query.category || "").trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    if (!q && !category) return res.status(200).json([]);

    const match = { privacy: "public" };
    if (q && category) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      match.$and = [{ category: regex }, { $or: [{ name: regex }, { description: regex }] }];
    } else if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      match.$or = [{ name: regex }, { description: regex }, { category: regex }];
    } else if (category) {
      match.category = category;
    }

    const channels = await Channel.find(match)
      .populate("owner", "fullName profilePic")
      .sort({ followerCount: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const followed = new Set(
      (
        await ChannelFollower.find({ user: userId }).select("channel").lean()
      ).map((f) => String(f.channel))
    );

    const ownId = String(userId);
    const result = channels
      .filter((c) => !isOwner(c, ownId))
      .map((c) => ({
        ...c,
        isFollowing: followed.has(String(c._id)),
        isOwner: false,
        isAdmin: false,
      }));

    res.status(200).json(result);
  } catch (err) {
    console.error("Error in searchChannels:", err.message);
    res.status(500).json({ message: "Failed to search channels" });
  }
};

export const updateChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwnerOrAdmin(channel, userId)) {
      return res.status(403).json({ message: "You don't have permission to edit this channel" });
    }

    const { name, description, avatar, category, privacy } = req.body || {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Channel name is required" });
      if (name.trim().length > 50) return res.status(400).json({ message: "Channel name is too long" });
      channel.name = name.trim();
    }
    if (description !== undefined) channel.description = String(description || "").trim();
    if (avatar !== undefined) channel.avatar = String(avatar || "");
    if (category !== undefined) channel.category = String(category || "").trim();
    // Only the owner may change privacy.
    if (privacy !== undefined && isOwner(channel, userId)) {
      channel.privacy = privacy === "private" ? "private" : "public";
    }

    await channel.save();

    const populated = await channel.populate("owner", "fullName profilePic");
    res.status(200).json({ ...populated.toObject(), isOwner: isOwner(populated, userId), isAdmin: isAdmin(populated, userId) });
  } catch (err) {
    console.error("Error in updateChannel:", err.message);
    res.status(500).json({ message: "Failed to update channel" });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwner(channel, userId)) {
      return res.status(403).json({ message: "Only the owner can delete this channel" });
    }

    await ChannelPost.deleteMany({ channel: channelId });
    await ChannelFollower.deleteMany({ channel: channelId });
    await Channel.findByIdAndDelete(channelId);

    io.to(`channel_${channelId}`).emit("channel:deleted", { channelId });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in deleteChannel:", err.message);
    res.status(500).json({ message: "Failed to delete channel" });
  }
};

// ── Follow / unfollow ─────────────────────────────────────────────────────────

export const followChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId).populate("owner", "fullName profilePic");
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.privacy === "private") {
      return res.status(403).json({ message: "This channel is private — join via its invite link" });
    }

    if (isOwner(channel, userId)) {
      return res.status(200).json({ success: true, alreadyFollowing: true });
    }

    const existing = await ChannelFollower.findOne({ channel: channelId, user: userId }).lean();
    if (existing) {
      return res.status(200).json({ success: true, alreadyFollowing: true });
    }

    await ChannelFollower.create({ channel: channelId, user: userId });
    await Channel.updateOne({ _id: channelId }, { $inc: { followerCount: 1 } });

    // Real-time: owner sees the new follower, and the follower joins the room.
    io.to(`channel_${channelId}`).emit("channel:followersChanged", { channelId, delta: 1 });
    const ownerSocketId = getReceiverSocketId(String(channel.owner?._id));
    if (ownerSocketId) {
      io.to(ownerSocketId).emit("channel:newFollower", {
        channelId,
        channelName: channel.name,
        follower: { _id: userId, fullName: req.user.fullName, profilePic: req.user.profilePic },
      });
    }

    res.status(200).json({ success: true, followerCount: channel.followerCount + 1 });
  } catch (err) {
    console.error("Error in followChannel:", err.message);
    res.status(500).json({ message: "Failed to follow channel" });
  }
};

export const unfollowChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (isOwner(channel, userId)) {
      return res.status(400).json({ message: "You cannot unfollow a channel you own" });
    }

    const resDel = await ChannelFollower.deleteOne({ channel: channelId, user: userId });
    if (resDel.deletedCount > 0) {
      await Channel.updateOne({ _id: channelId }, { $inc: { followerCount: -1 } });
      io.to(`channel_${channelId}`).emit("channel:followersChanged", { channelId, delta: -1 });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in unfollowChannel:", err.message);
    res.status(500).json({ message: "Failed to unfollow channel" });
  }
};

// ── Invites (the only way into a private channel) ─────────────────────────────

export const generateInvite = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwnerOrAdmin(channel, userId)) {
      return res.status(403).json({ message: "You don't have permission to invite" });
    }

    channel.inviteCode = crypto.randomBytes(8).toString("hex");
    channel.inviteCreatedBy = userId;
    channel.inviteCreatedAt = new Date();
    await channel.save();

    res.status(200).json({ inviteCode: channel.inviteCode });
  } catch (err) {
    console.error("Error in generateInvite:", err.message);
    res.status(500).json({ message: "Failed to generate invite" });
  }
};

export const revokeInvite = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwnerOrAdmin(channel, userId)) {
      return res.status(403).json({ message: "You don't have permission" });
    }

    channel.inviteCode = undefined;
    await channel.save();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in revokeInvite:", err.message);
    res.status(500).json({ message: "Failed to revoke invite" });
  }
};

export const joinByInvite = async (req, res) => {
  try {
    const { inviteCode } = req.body || {};
    const userId = req.user._id;
    if (!inviteCode) return res.status(400).json({ message: "Invite code is required" });

    const channel = await Channel.findOne({ inviteCode }).populate("owner", "fullName profilePic");
    if (!channel) return res.status(404).json({ message: "Invalid invite link" });

    if (isOwner(channel, userId)) {
      return res.status(200).json({ channel: channel.toObject(), success: true });
    }

    const existing = await ChannelFollower.findOne({ channel: channel._id, user: userId }).lean();
    if (!existing) {
      await ChannelFollower.create({ channel: channel._id, user: userId });
      await Channel.updateOne({ _id: channel._id }, { $inc: { followerCount: 1 } });
    }

    res.status(200).json({ channel: channel.toObject(), success: true });
  } catch (err) {
    console.error("Error in joinByInvite:", err.message);
    res.status(500).json({ message: "Failed to join channel" });
  }
};

export const getInviteInfo = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    if (!inviteCode) return res.status(400).json({ message: "Invite code is required" });
    const channel = await Channel.findOne({ inviteCode })
      .populate("owner", "fullName profilePic")
      .lean();
    if (!channel) return res.status(404).json({ message: "Invalid invite link" });
    res.status(200).json({
      channelId: channel._id,
      name: channel.name,
      avatar: channel.avatar,
      description: channel.description,
      category: channel.category,
      followerCount: channel.followerCount,
      owner: channel.owner,
    });
  } catch (err) {
    console.error("Error in getInviteInfo:", err.message);
    res.status(500).json({ message: "Failed to fetch invite" });
  }
};

// ── Admins ────────────────────────────────────────────────────────────────────

export const addAdmin = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId: targetUserId } = req.body || {};
    const actorId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwner(channel, actorId)) {
      return res.status(403).json({ message: "Only the owner can manage admins" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(targetUserId || ""))) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (String(targetUserId) === String(actorId)) {
      return res.status(400).json({ message: "The owner is already the top admin" });
    }

    if (!isAdmin(channel, targetUserId)) {
      channel.admins.push({ user: targetUserId });
      await channel.save();
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in addAdmin:", err.message);
    res.status(500).json({ message: "Failed to add admin" });
  }
};

export const removeAdmin = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId: targetUserId } = req.body || {};
    const actorId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwner(channel, actorId)) {
      return res.status(403).json({ message: "Only the owner can manage admins" });
    }

    channel.admins = (channel.admins || []).filter(
      (a) => String(a.user?._id || a.user) !== String(targetUserId)
    );
    await channel.save();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in removeAdmin:", err.message);
    res.status(500).json({ message: "Failed to remove admin" });
  }
};

// ── Mute / report ─────────────────────────────────────────────────────────────

export const muteChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;
    const { muted } = req.body || {};
    await ChannelFollower.updateOne(
      { channel: channelId, user: userId },
      { $set: { muted: Boolean(muted) } },
      { upsert: true }
    );
    res.status(200).json({ success: true, muted: Boolean(muted) });
  } catch (err) {
    console.error("Error in muteChannel:", err.message);
    res.status(500).json({ message: "Failed to update mute" });
  }
};

export const reportChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { reason } = req.body || {};
    const reporterId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const Report = mongoose.models.Report;
    if (Report) {
      await Report.create({
        reportType: "channel",
        targetId: channelId,
        reporterId,
        reason: String(reason || "").slice(0, 500),
      });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in reportChannel:", err.message);
    res.status(500).json({ message: "Failed to report channel" });
  }
};

// ── Posts ─────────────────────────────────────────────────────────────────────

export const createPost = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;
    const { text, media } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!canPost(channel, userId)) {
      return res.status(403).json({ message: "Only admins can post to this channel" });
    }

    let mediaObj;
    if (media && media.key) {
      if (!isStorageConfigured()) {
        return res.status(503).json({ message: "File storage is not available" });
      }
      if (!["image", "video"].includes(media.type)) {
        return res.status(400).json({ message: "Only image and video posts are supported" });
      }
      if (!media.key.startsWith("image/") && !media.key.startsWith("video/")) {
        return res.status(400).json({ message: "Invalid attachment reference" });
      }
      try {
        const s3 = getStorage();
        const head = await s3.send(
          new HeadObjectCommand({ Bucket: storageBucket(), Key: media.key })
        );
        if (!head || head.$metadata?.httpStatusCode === 404) {
          return res.status(400).json({ message: "Upload not found — please try again" });
        }
      } catch {
        return res.status(400).json({ message: "Upload not found — please try again" });
      }
      mediaObj = {
        type: media.type,
        key: media.key,
        url: "",
        fileName: media.fileName || "",
        contentType: media.contentType || "",
        size: media.size || 0,
        duration: media.duration || 0,
      };
    }

    if (!text && !mediaObj) {
      return res.status(400).json({ message: "A post needs text or media" });
    }

    const post = new ChannelPost({
      channel: channelId,
      author: userId,
      text: (text || "").slice(0, 2000),
      media: mediaObj,
    });
    await post.save();

    await Channel.updateOne({ _id: channelId }, { $set: { updatedAt: new Date() } });

    const populated = await ChannelPost.findById(post._id)
      .populate("author", "fullName profilePic")
      .lean();
    await signPostMedia(populated);

    const payload = {
      ...populated,
      channel: { _id: channelId, name: channel.name, avatar: channel.avatar },
    };
    io.to(`channel_${channelId}`).emit("channel:postCreated", payload);

    // FCM fan-out to followers (respecting per-channel mute and global opt-out).
    fireChannelPush(channel, req.user, post).catch((err) =>
      console.error("[channel] push fan-out error:", err.message)
    );

    res.status(201).json(payload);
  } catch (err) {
    console.error("Error in createPost:", err.message);
    res.status(500).json({ message: "Failed to create post" });
  }
};

async function fireChannelPush(channel, author, post) {
  if (!isStorageConfigured()) return;
  const followers = await ChannelFollower.find({ channel: channel._id, muted: { $ne: true } })
    .select("user")
    .lean();
  const ids = followers
    .map((f) => String(f.user))
    .filter((id) => id && id !== String(author._id));
  if (!ids.length) return;

  const recipients = await User.find({ _id: { $in: ids } })
    .select("_id notificationPrefs blockedUsers")
    .lean();
  const text = post?.text || "";
  const messageContent = {
    text,
    image: post?.media?.type === "image" ? "1" : "",
    attachments: post?.media?.type === "video" ? [{ kind: "video" }] : [],
  };
  await Promise.all(
    recipients.map((recipient) =>
      sendPushNotification({
        recipient,
        senderName: channel.name || "Channel",
        type: "channel_post",
        conversationId: String(channel._id),
        messageId: String(post._id),
        senderId: String(author._id),
        messageContent,
      }).catch((err) => console.error("[channel] push error:", err.message))
    )
  );
}

export const getChannelPosts = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.privacy === "private") {
      const isMember = await ChannelFollower.exists({ channel: channelId, user: userId });
      if (!isMember && !isOwner(channel, userId)) {
        return res.status(404).json({ message: "Channel not found" });
      }
    } else if (!isOwner(channel, userId) && !isAdmin(channel, userId)) {
      const isMember = await ChannelFollower.exists({ channel: channelId, user: userId });
      if (!isMember) {
        return res.status(200).json({ posts: [], followed: false });
      }
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const posts = await ChannelPost.find({ channel: channelId })
      .populate("author", "fullName profilePic")
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    await signPosts(posts);

    const userIdStr = String(userId);
    const decorated = posts.map((p) => ({
      ...p,
      viewedByMe: (p.views || []).some((v) => String(v.user) === userIdStr),
      myReaction: (p.reactions || []).find(
        (r) => String(r.user) === userIdStr
      )?.reaction || "",
    }));

    res.status(200).json({ posts: decorated, page, hasMore: posts.length === limit });
  } catch (err) {
    console.error("Error in getChannelPosts:", err.message);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { channelId, postId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const post = await ChannelPost.findById(postId);
    if (!post || String(post.channel) !== String(channelId)) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!isOwnerOrAdmin(channel, userId) && String(post.author) !== String(userId)) {
      return res.status(403).json({ message: "You don't have permission to delete this post" });
    }

    if (post.media?.key) {
      try {
        const { destroyObjects } = await import("../lib/mediaCleanup.js");
        await destroyObjects([post.media.key]);
      } catch (err) {
        console.error("Failed to delete post media:", err.message);
      }
    }

    await ChannelPost.deleteOne({ _id: postId });
    io.to(`channel_${channelId}`).emit("channel:postDeleted", { channelId, postId });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in deletePost:", err.message);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

export const pinPost = async (req, res) => {
  try {
    const { channelId, postId } = req.params;
    const userId = req.user._id;
    const { pinned } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwnerOrAdmin(channel, userId)) {
      return res.status(403).json({ message: "Only admins can pin posts" });
    }

    const post = await ChannelPost.findById(postId);
    if (!post || String(post.channel) !== String(channelId)) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (pinned) {
      await ChannelPost.updateOne({ channel: channelId }, { $set: { pinned: false } });
    }
    post.pinned = Boolean(pinned);
    await post.save();
    res.status(200).json({ success: true, pinned: Boolean(pinned) });
  } catch (err) {
    console.error("Error in pinPost:", err.message);
    res.status(500).json({ message: "Failed to update pin" });
  }
};

export const reactToPost = async (req, res) => {
  try {
    const { channelId, postId } = req.params;
    const userId = req.user._id;
    const { reaction } = req.body || {};

    const post = await ChannelPost.findOne({ _id: postId, channel: channelId });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const isUnlike = reaction === "" || reaction === null;
    const emoji = isUnlike ? "" : String(reaction || "❤️");

    const existing = (post.reactions || []).find((r) => String(r.user) === String(userId));
    if (existing) {
      if (isUnlike) {
        await ChannelPost.updateOne(
          { _id: postId, "reactions.user": userId },
          { $pull: { reactions: { user: userId } } }
        );
      } else {
        await ChannelPost.updateOne(
          { _id: postId, "reactions.user": userId },
          { $set: { "reactions.$.reaction": emoji } }
        );
      }
    } else if (!isUnlike) {
      await ChannelPost.updateOne(
        { _id: postId },
        { $push: { reactions: { user: userId, reaction: emoji } } }
      );
    }

    const updated = await ChannelPost.findById(postId).lean();
    res.status(200).json({
      success: true,
      myReaction: isUnlike ? "" : emoji,
      count: (updated?.reactions || []).length,
    });
  } catch (err) {
    console.error("Error in reactToPost:", err.message);
    res.status(500).json({ message: "Failed to react to post" });
  }
};

export const viewPost = async (req, res) => {
  try {
    const { channelId, postId } = req.params;
    const userId = req.user._id;

    const post = await ChannelPost.findOne({ _id: postId, channel: channelId });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyViewed = (post.views || []).some((v) => String(v.user) === String(userId));
    if (!alreadyViewed) {
      await ChannelPost.updateOne(
        { _id: postId },
        { $addToSet: { views: { user: userId, viewedAt: new Date() } } }
      );
    }

    const fresh = await ChannelPost.findById(postId).lean();
    res.status(200).json({
      success: true,
      alreadyViewed,
      viewCount: (fresh?.views || []).length,
    });
  } catch (err) {
    console.error("Error in viewPost:", err.message);
    res.status(500).json({ message: "Failed to record view" });
  }
};

export const getPostMediaUrl = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ message: "File storage is not available" });
    }
    const { channelId, postId } = req.params;

    const post = await ChannelPost.findOne({ _id: postId, channel: channelId }).lean();
    if (!post || !post.media?.key) {
      return res.status(404).json({ message: "Media not found" });
    }

    const channel = await Channel.findById(channelId).lean();
    if (channel?.privacy === "private") {
      const isMember = await ChannelFollower.exists({ channel: channelId, user: req.user._id });
      if (!isMember) return res.status(404).json({ message: "Media not found" });
    }

    const url = await getSignedUrl(
      getStorage(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: post.media.key,
        ResponseContentType: post.media.contentType || undefined,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: MEDIA_URL_TTL_SECONDS }
    );
    res.status(200).json({ url, expiresIn: MEDIA_URL_TTL_SECONDS });
  } catch (err) {
    console.error("Error in getPostMediaUrl:", err.message);
    res.status(500).json({ message: "Could not open that file" });
  }
};

export const getPostViewers = async (req, res) => {
  try {
    const { channelId, postId } = req.params;
    const userId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    if (!isOwnerOrAdmin(channel, userId)) {
      return res.status(403).json({ message: "Only admins can see post analytics" });
    }

    const post = await ChannelPost.findOne({ _id: postId, channel: channelId })
      .populate("views.user", "fullName profilePic")
      .lean();
    if (!post) return res.status(404).json({ message: "Post not found" });

    const viewers = (post.views || []).map((v) => ({
      _id: v.user?._id,
      fullName: v.user?.fullName,
      profilePic: v.user?.profilePic,
      viewedAt: v.viewedAt,
    }));
    res.status(200).json({ viewers, count: viewers.length });
  } catch (err) {
    console.error("Error in getPostViewers:", err.message);
    res.status(500).json({ message: "Failed to fetch viewers" });
  }
};
