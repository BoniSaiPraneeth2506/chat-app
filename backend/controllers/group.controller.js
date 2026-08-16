import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
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
    const { limit = 30, skip = 0 } = req.query;

    const messages = await Message.find({ groupId })
      .populate("senderId", "fullName email profilePic")
      .populate("replyTo")
      .populate("poll.options.votes", "fullName profilePic")
      .sort({ createdAt: 1 })
      .skip(Number(skip))
      .limit(Number(limit));

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
    const { text, image, images, voice, replyTo } = req.body;
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
