import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import crypto from "crypto";
import { canDo, canManagePermissions, sanitizePermissions } from "../lib/groupPermissions.js";

// Helper: Check user's role in a group
const getUserRole = (group, userId) => {
  const member = group.members.find((m) => m.user.toString() === userId.toString());
  return member ? member.role : null;
};

// 1. Create a new Group
export const createGroup = async (req, res) => {
  try {
    const { name, description, members, groupPic } = req.body;
    const creatorId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    let imageUrl = "";
    if (groupPic && groupPic.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic);
      imageUrl = uploadResponse.secure_url;
    } else if (groupPic) {
      imageUrl = groupPic;
    }

    // Include creator as admin
    const memberObjects = [
      { user: creatorId, role: "admin", joinedAt: new Date() },
    ];

    if (Array.isArray(members)) {
      members.forEach((memberId) => {
        if (memberId.toString() !== creatorId.toString()) {
          memberObjects.push({ user: memberId, role: "member", joinedAt: new Date() });
        }
      });
    }

    const newGroup = new Group({
      name: name.trim(),
      description: description || "",
      groupPic: imageUrl,
      createdBy: creatorId,
      members: memberObjects,
    });

    await newGroup.save();

    const populatedGroup = await Group.findById(newGroup._id).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    // Notify all members via sockets to update UI (use socketId lookup)
    populatedGroup.members.forEach((m) => {
      try {
        const userIdStr = m.user && m.user._id ? m.user._id.toString() : m.user.toString();
        const targetSocketId = getReceiverSocketId(userIdStr);
        if (targetSocketId) {
          io.to(targetSocketId).emit("groupCreated", populatedGroup);
        }
      } catch (err) {
        // ignore emit failures for offline or invalid users
      }
    });

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 2. Get all Groups for logged-in user
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ "members.user": userId })
      .populate("members.user", "fullName email profilePic bio lastSeen")
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 3. Get Group Details by ID
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.error("Error fetching group details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 4. Update Group Details (Name, Description, Avatar, isReadOnly)
export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, groupPic, isReadOnly, permissions } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!canDo(group, userId, "editInfo")) {
      return res.status(403).json({ message: "You don't have permission to edit this group" });
    }

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (isReadOnly !== undefined) {
      group.isReadOnly = isReadOnly;
      // Keep the legacy flag and the new permission from contradicting.
      group.permissions = { ...(group.permissions || {}), sendMessages: isReadOnly ? "admins" : "everyone" };
    }

    // Changing the rules themselves is an admin-only act, even where editing
    // the name or picture has been opened up to everyone.
    if (permissions !== undefined) {
      if (!canManagePermissions(group, userId)) {
        return res.status(403).json({ message: "Only admins can change group permissions" });
      }
      const next = sanitizePermissions(permissions, group.permissions || {});
      group.permissions = { ...(group.permissions || {}), ...next };
      if (next.sendMessages) group.isReadOnly = next.sendMessages === "admins";
    }

    if (groupPic && groupPic.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic);
      group.groupPic = uploadResponse.secure_url;
    }

    await group.save();

    const updatedGroup = await Group.findById(groupId).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    io.to(`group_${groupId}`).emit("groupUpdated", updatedGroup);
    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 5. Add Members to Group
export const addGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { newMembers } = req.body; // Array of userIds
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!canDo(group, userId, "addMembers")) {
      return res.status(403).json({ message: "You don't have permission to add members" });
    }

    if (!Array.isArray(newMembers) || newMembers.length === 0) {
      return res.status(400).json({ message: "No members specified" });
    }

    const existingMemberIds = group.members.map((m) => m.user.toString());

    newMembers.forEach((memberId) => {
      if (!existingMemberIds.includes(memberId.toString())) {
        group.members.push({ user: memberId, role: "member", joinedAt: new Date() });
      }
    });

    await group.save();

    const updatedGroup = await Group.findById(groupId).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    io.to(`group_${groupId}`).emit("groupUpdated", updatedGroup);
    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error adding group members:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 6. Remove Member or Leave Group
export const removeGroupMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const reqUserRole = getUserRole(group, userId);

    // Allowing user to leave or admin/moderator to remove
    const isSelfLeave = userId.toString() === memberId.toString();
    if (!isSelfLeave && (!reqUserRole || (reqUserRole !== "admin" && reqUserRole !== "moderator"))) {
      return res.status(403).json({ message: "Permission denied" });
    }

    group.members = group.members.filter((m) => m.user.toString() !== memberId.toString());
    await group.save();

    const updatedGroup = await Group.findById(groupId).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    io.to(`group_${groupId}`).emit("groupUpdated", updatedGroup);
    io.to(memberId.toString()).emit("removedFromGroup", { groupId });

    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error removing group member:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 7. Update Member Role (Admin only)
export const updateMemberRole = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { targetUserId, newRole } = req.body;
    const userId = req.user._id;

    if (!["admin", "moderator", "member"].includes(newRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const reqUserRole = getUserRole(group, userId);
    if (reqUserRole !== "admin") {
      return res.status(403).json({ message: "Only Group Admins can change member roles" });
    }

    const targetMember = group.members.find((m) => m.user.toString() === targetUserId.toString());
    if (!targetMember) {
      return res.status(404).json({ message: "Target user is not a group member" });
    }

    targetMember.role = newRole;
    await group.save();

    const updatedGroup = await Group.findById(groupId).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    io.to(`group_${groupId}`).emit("groupUpdated", updatedGroup);
    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error updating member role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 8. Get Group Messages
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 0;
    const skip = parseInt(req.query.skip) || 0;

    // Membership check. This endpoint previously required only a valid login,
    // so any authenticated user could read any group's messages by id.
    const group = await Group.findById(groupId).select("members.user");
    if (!group) return res.status(404).json({ message: "Group not found" });
    const isMember = group.members.some((m) => m.user?.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ message: "Not a member of this group" });

    // Messages the caller deleted for themselves stay hidden. Without this,
    // "delete for me" in a group looked like it worked and then came back on
    // the next load, because only local state had dropped them.
    const query = { groupId, deletedFor: { $ne: userId } };

    const base = () =>
      Message.find(query)
        .populate("senderId", "fullName email profilePic")
        .populate("replyTo")
        .populate("poll.options.votes", "fullName profilePic");

    // A page must be taken from the NEWEST end and then flipped back into
    // chronological order — the same shape getMessages uses for DMs. Sorting
    // ascending and then limiting returned the OLDEST N instead, so a group
    // with more than the default page size showed only its opening messages
    // and every recent one appeared to be missing. It also made the sidebar's
    // `?limit=1` "latest message" preview show the group's first message.
    if (limit > 0) {
      const page = await base().sort({ createdAt: -1 }).skip(skip).limit(limit);
      return res.status(200).json(page.reverse());
    }

    const messages = await base().sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching group messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Polls (group chats only) ─────────────────────────────────────────────────

const MAX_POLL_OPTIONS = 12;

const populatePollMessage = (messageId) =>
  Message.findById(messageId)
    .populate("senderId", "fullName email profilePic")
    .populate("poll.options.votes", "fullName profilePic");

export const createGroupPoll = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { question, options, allowMultiple } = req.body;
    const senderId = req.user._id;

    const cleanedOptions = (Array.isArray(options) ? options : [])
      .map((option) => (typeof option === "string" ? option.trim() : ""))
      .filter(Boolean);

    if (!question || !question.trim()) {
      return res.status(400).json({ message: "Poll question is required" });
    }
    if (cleanedOptions.length < 2) {
      return res.status(400).json({ message: "A poll needs at least 2 options" });
    }
    if (cleanedOptions.length > MAX_POLL_OPTIONS) {
      return res.status(400).json({ message: `A poll can have at most ${MAX_POLL_OPTIONS} options` });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const userRole = getUserRole(group, senderId);
    if (!userRole) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }
    if (group.isReadOnly && userRole === "member") {
      return res.status(403).json({ message: "Only Admins and Moderators can create polls in this group" });
    }

    const newMessage = new Message({
      senderId,
      groupId,
      poll: {
        question: question.trim(),
        options: cleanedOptions.map((text) => ({ text, votes: [] })),
        allowMultiple: Boolean(allowMultiple),
      },
    });

    await newMessage.save();

    const populatedMessage = await populatePollMessage(newMessage._id);
    io.to(`group_${groupId}`).emit("newGroupMessage", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error creating group poll:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const voteGroupPoll = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const { optionIds } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!getUserRole(group, userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const message = await Message.findOne({ _id: messageId, groupId });
    if (!message || !message.poll) {
      return res.status(404).json({ message: "Poll not found" });
    }
    if (message.poll.isClosed) {
      return res.status(403).json({ message: "This poll is closed" });
    }

    const selected = (Array.isArray(optionIds) ? optionIds : [optionIds])
      .filter(Boolean)
      .map(String);

    const validIds = message.poll.options.map((option) => option._id.toString());
    if (selected.some((id) => !validIds.includes(id))) {
      return res.status(400).json({ message: "Invalid poll option" });
    }
    if (!message.poll.allowMultiple && selected.length > 1) {
      return res.status(400).json({ message: "This poll only allows one choice" });
    }

    message.poll.options.forEach((option) => {
      const hasVoted = option.votes.some((voter) => voter.toString() === userId.toString());
      const isSelected = selected.includes(option._id.toString());
      if (isSelected && !hasVoted) {
        option.votes.push(userId);
      } else if (!isSelected && hasVoted) {
        option.votes = option.votes.filter((voter) => voter.toString() !== userId.toString());
      }
    });

    await message.save();

    const populatedMessage = await populatePollMessage(message._id);
    io.to(`group_${groupId}`).emit("groupPollUpdated", populatedMessage);

    res.status(200).json(populatedMessage);
  } catch (error) {
    console.error("Error voting on group poll:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const closeGroupPoll = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const role = getUserRole(group, userId);
    if (!role) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const message = await Message.findOne({ _id: messageId, groupId });
    if (!message || !message.poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const isCreator = message.senderId.toString() === userId.toString();
    if (!isCreator && role !== "admin" && role !== "moderator") {
      return res.status(403).json({ message: "Only the poll creator, Admins and Moderators can close a poll" });
    }

    message.poll.isClosed = true;
    await message.save();

    const populatedMessage = await populatePollMessage(message._id);
    io.to(`group_${groupId}`).emit("groupPollUpdated", populatedMessage);

    res.status(200).json(populatedMessage);
  } catch (error) {
    console.error("Error closing group poll:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// 9. Send Message to Group
export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { text, image, images, voice, replyTo, mentions, voiceTranscript } = req.body;
    const senderId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const userRole = getUserRole(group, senderId);
    if (!userRole) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    if (!canDo(group, senderId, "sendMessages")) {
      return res.status(403).json({ message: "Only admins and moderators can send messages in this group" });
    }

    // Only real members can be mentioned — otherwise a client could make any
    // user id light up as "mentioned you" in a group they aren't in.
    const memberIds = new Set(group.members.map((m) => (m.user?._id || m.user).toString()));
    const validMentions = Array.isArray(mentions)
      ? [...new Set(mentions.map(String))].filter((id) => memberIds.has(id))
      : [];


    let imageUrl = "";
    if (image && image.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    } else if (image) {
      imageUrl = image;
    }

    let uploadedImages = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img.startsWith("data:image")) {
          const uploadRes = await cloudinary.uploader.upload(img);
          uploadedImages.push(uploadRes.secure_url);
        } else {
          uploadedImages.push(img);
        }
      }
    }

    let voiceUrl = "";
    if (voice && voice.startsWith("data:audio")) {
      const uploadResponse = await cloudinary.uploader.upload(voice, {
        resource_type: "video", // Cloudinary handles audio files under 'video'
      });
      voiceUrl = uploadResponse.secure_url;
    } else if (voice) {
      voiceUrl = voice;
    }

    const newMessage = new Message({
      senderId,
      groupId,
      text: text || "",
      image: imageUrl,
      images: uploadedImages,
      voice: voiceUrl,
      replyTo: replyTo || null,
      mentions: validMentions,
      voiceTranscript: typeof voiceTranscript === "string" ? voiceTranscript.slice(0, 2000) : "",
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName email profilePic")
      .populate("replyTo");

    // Emit socket event to the group room
    io.to(`group_${groupId}`).emit("newGroupMessage", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending group message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ── Invite links ─────────────────────────────────────────────────────────────

/** URL-safe, unguessable, and short enough to share by hand. */
const newInviteCode = () => crypto.randomBytes(9).toString("base64url");

/**
 * Creates or replaces the group's invite code.
 *
 * Regenerating is how revoking works: the old code stops resolving the moment
 * it is overwritten, so a link that has leaked can be killed without touching
 * the members who already joined with it.
 */
export const createGroupInvite = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Handing out a join link is effectively adding members, so it follows the
    // same permission rather than inventing a second, looser rule.
    if (!canDo(group, userId, "addMembers")) {
      return res.status(403).json({ message: "You don't have permission to invite people" });
    }

    group.inviteCode = newInviteCode();
    group.inviteCreatedBy = userId;
    group.inviteCreatedAt = new Date();
    await group.save();

    res.status(200).json({
      inviteCode: group.inviteCode,
      inviteCreatedAt: group.inviteCreatedAt,
    });
  } catch (error) {
    console.error("Error in createGroupInvite:", error.message);
    res.status(500).json({ message: "Could not create an invite link" });
  }
};

/** Removes the link entirely — no code, no joining. */
export const revokeGroupInvite = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!canDo(group, userId, "addMembers")) {
      return res.status(403).json({ message: "You don't have permission to manage invites" });
    }

    group.inviteCode = undefined;
    group.inviteCreatedBy = undefined;
    group.inviteCreatedAt = undefined;
    await group.save();

    res.status(200).json({ revoked: true });
  } catch (error) {
    console.error("Error in revokeGroupInvite:", error.message);
    res.status(500).json({ message: "Could not revoke the invite link" });
  }
};

/** Public preview so someone can see what they are joining before committing. */
export const previewGroupInvite = async (req, res) => {
  try {
    const { code } = req.params;
    const group = await Group.findOne({ inviteCode: code }).select(
      "name description groupPic members"
    );
    if (!group) return res.status(404).json({ message: "This invite link is no longer valid" });

    const alreadyMember = group.members.some(
      (m) => (m.user?._id || m.user).toString() === req.user._id.toString()
    );

    res.status(200).json({
      _id: group._id,
      name: group.name,
      description: group.description,
      groupPic: group.groupPic,
      memberCount: group.members.length,
      alreadyMember,
    });
  } catch (error) {
    console.error("Error in previewGroupInvite:", error.message);
    res.status(500).json({ message: "Could not load this invite" });
  }
};

export const joinGroupByInvite = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({ inviteCode: code });
    if (!group) return res.status(404).json({ message: "This invite link is no longer valid" });

    const alreadyMember = group.members.some(
      (m) => (m.user?._id || m.user).toString() === userId.toString()
    );
    if (!alreadyMember) {
      group.members.push({ user: userId, role: "member", joinedAt: new Date() });
      await group.save();
    }

    const populated = await Group.findById(group._id).populate(
      "members.user",
      "fullName email profilePic bio lastSeen"
    );

    // Tell the room so existing members see the new arrival without a refetch,
    // and the joiner's own session gets the group added to their list.
    if (!alreadyMember) {
      io.to(`group_${group._id.toString()}`).emit("groupUpdated", populated);
      const joinerSocketId = getReceiverSocketId(userId.toString());
      if (joinerSocketId) io.to(joinerSocketId).emit("groupCreated", populated);
    }

    res.status(200).json({ group: populated, alreadyMember });
  } catch (error) {
    console.error("Error in joinGroupByInvite:", error.message);
    res.status(500).json({ message: "Could not join this group" });
  }
};
