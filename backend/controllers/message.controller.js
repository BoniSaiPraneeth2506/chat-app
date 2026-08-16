// import Message from "../models/message.model.js";
// import User from "../models/user.model.js";
// import cloudinary from "../lib/cloudinary.js";

// const getUsersForSidebar=async (req,res)=>{
//     try{
//         const loggedinUserId=req.user._id;
//         const filteredUsers=await User.find({_id:{$ne:loggedinUserId}}).select("-password")
//         res.status(200).json(filteredUsers);
//     }catch(err){
//         console.log(err);
//         res.status(500).json({message:"internal server error"})
//     }
// }


// const getMessages=async (req,res)=>{
//     try{
//       const {id:userToChatId}=req.params;
//     const myId=req.user._id;

//     const messages=await Message.find({
//         $or :[
//             {senderId:myId,receiverId:userToChatId},
//             {senderId:userToChatId,receiverId:myId}
//         ]
//     })
//     res.status(200).json(messages)
//     }catch(err){
//         console.log(err);
//         res.status(500).json({message:"internal server error"})
//     }
   
// }

// const sendMessage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { text, image } = req.body;
//     const senderId = req.user._id;

//     let imageUrl = "";

//     if (image) {
//       const uploadResponse = await cloudinary.uploader.upload(image);
//       imageUrl = uploadResponse.secure_url;
//     }

//     const newMessage = new Message({
//       senderId,
//       receiverId:id,
//       text,
//       image: imageUrl
//     });

//     await newMessage.save();

//     res.status(201).json(newMessage);

//   } catch (error) {
//     console.log("Error in sendMessage:", error);
//     res.status(500).json({ message: "Failed to send message" });
// }
// };
// export {getUsersForSidebar,getMessages,sendMessage}


import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import sanitizeHtml from "sanitize-html";
import { destroyMessageAssets, assetUrlsOf, destroyAssets } from "../lib/mediaCleanup.js";
import {
  verifyAttachment,
  publicUrlForKey,
  safeDisplayName,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "../lib/attachments.js";

// ── Security Helpers ──────────────────────────────────────────────────────────

/**
 * Escape special regex characters to prevent ReDoS / NoSQL injection
 * when building $regex queries from user input.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Strip all HTML/JS from message text.
 * Stores plain text only — safe to render anywhere.
 */
const sanitizeText = (text) =>
  sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

/** Validate image data URI: type whitelist + size cap */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMG_BYTES = 8_000_000; // ~6 MB actual after base64

const validateImage = (dataUri) => {
  if (!dataUri.startsWith("data:")) return { valid: false, reason: "Invalid image format" };
  const mime = dataUri.split(";")[0].split(":")[1];
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    return { valid: false, reason: "Only JPEG, PNG, GIF, and WebP images are allowed" };
  }
  if (dataUri.length > MAX_IMG_BYTES) {
    return { valid: false, reason: "Image file too large (max 6 MB)" };
  }
  return { valid: true };
};

/** Validate audio/voice data URI */
const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];
const MAX_VOICE_BYTES = 15_000_000; // ~11 MB actual

const validateVoice = (dataUri) => {
  if (!dataUri.startsWith("data:")) return { valid: false, reason: "Invalid voice format" };
  const mime = dataUri.split(";")[0].split(":")[1];
  if (!ALLOWED_AUDIO_TYPES.includes(mime)) {
    return { valid: false, reason: "Unsupported audio format" };
  }
  if (dataUri.length > MAX_VOICE_BYTES) {
    return { valid: false, reason: "Voice message too large (max 11 MB)" };
  }
  return { valid: true };
};

/**
 * Fields never sent to the client when listing other users. `lastReadAt` is a
 * private record of when someone read each of their chats, and the reset/
 * session fields were already sensitive — `-password` alone let all of them
 * through on the sidebar payload.
 */
const SIDEBAR_USER_FIELDS = "-password -lastReadAt -resetPasswordOtp -resetPasswordExpires -sessions";

/**
 * Attaches an `unreadCount` to each sidebar user: messages they sent me since
 * I last read that conversation.
 *
 * This is what makes unread badges survive the app being closed. The count
 * used to be incremented purely from live socket events, so anything that
 * arrived while the app wasn't running was never counted.
 */
const attachUnreadCounts = async (users, me) => {
  if (!users.length) return users;

  const lastReadAt = me.lastReadAt || new Map();
  const readAtFor = (id) => {
    const value = lastReadAt instanceof Map ? lastReadAt.get(id) : lastReadAt[id];
    return value ? new Date(value) : new Date(0);
  };

  // One clause per conversation, because the "unread since" threshold differs
  // per sender. Never-opened chats fall back to epoch, so everything counts.
  const clauses = users.map((u) => ({
    senderId: u._id,
    createdAt: { $gt: readAtFor(u._id.toString()) },
  }));

  const counts = await Message.aggregate([
    {
      $match: {
        receiverId: me._id,
        groupId: null,
        deletedFor: { $ne: me._id },
        isDeletedForEveryone: { $ne: true },
        $or: clauses,
      },
    },
    { $group: { _id: "$senderId", count: { $sum: 1 } } },
  ]);

  const countBySender = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return users.map((u) => ({ ...u, unreadCount: countBySender.get(u._id.toString()) || 0 }));
};

const MAX_NICKNAME_LENGTH = 40;

/**
 * Sets or clears a private alias for one contact.
 *
 * The alias lives on the caller's own user document, so it never touches the
 * contact's real profile and is invisible to them. Sending an empty string
 * clears it and falls back to their real name.
 */
const setContactNickname = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    const { nickname } = req.body || {};
    const userId = req.user._id;

    if (contactId === userId.toString()) {
      return res.status(400).json({ message: "You can't rename yourself here" });
    }

    const contact = await User.findById(contactId).select("_id");
    if (!contact) {
      return res.status(404).json({ message: "User not found" });
    }

    const cleaned = sanitizeText(String(nickname ?? "")).trim().slice(0, MAX_NICKNAME_LENGTH);

    if (cleaned) {
      await User.updateOne({ _id: userId }, { $set: { [`contactNicknames.${contactId}`]: cleaned } });
    } else {
      await User.updateOne({ _id: userId }, { $unset: { [`contactNicknames.${contactId}`]: "" } });
    }

    res.status(200).json({ contactId, nickname: cleaned });
  } catch (error) {
    console.error("Error in setContactNickname:", error.message);
    res.status(500).json({ message: "Could not save the nickname" });
  }
};

/**
 * The people this user has blocked, with enough profile to recognise them.
 *
 * `authUser.blockedUsers` is only an array of ids, and a blocked contact may
 * have no chat history — so there is no guarantee the sidebar list contains
 * them and the client cannot resolve the names on its own.
 */
const getBlockedUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select("blockedUsers")
      .populate("blockedUsers", "fullName email profilePic bio");
    res.status(200).json(me?.blockedUsers || []);
  } catch (error) {
    console.error("Error in getBlockedUsers:", error.message);
    res.status(500).json({ message: "Could not load blocked users" });
  }
};

/**
 * Exports one conversation as JSON.
 *
 * Deliberately server-side rather than dumping whatever the client happens to
 * have cached: the device only holds recent pages, and an export that silently
 * omits older messages is worse than none.
 */
const exportChat = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    const myId = req.user._id;

    const [me, contact] = await Promise.all([
      User.findById(myId).select("fullName email"),
      User.findById(contactId).select("fullName email"),
    ]);
    if (!contact) return res.status(404).json({ message: "User not found" });

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: contactId, groupId: null },
        { senderId: contactId, receiverId: myId, groupId: null },
      ],
      deletedFor: { $ne: myId },
    })
      .sort({ createdAt: 1 })
      .select("senderId text image images voice createdAt isDeletedForEveryone isCallLog callType callStatus callDuration");

    const nameFor = (id) => (id.toString() === myId.toString() ? me.fullName : contact.fullName);

    res.status(200).json({
      exportedAt: new Date().toISOString(),
      participants: [
        { name: me.fullName, email: me.email },
        { name: contact.fullName, email: contact.email },
      ],
      messageCount: messages.length,
      messages: messages.map((m) => ({
        from: nameFor(m.senderId),
        at: m.createdAt,
        text: m.isDeletedForEveryone ? "[deleted]" : m.text || "",
        media: [m.image, ...(m.images || []), m.voice].filter(Boolean),
        call: m.isCallLog
          ? { type: m.callType, status: m.callStatus, durationSeconds: m.callDuration }
          : undefined,
      })),
    });
  } catch (error) {
    console.error("Error in exportChat:", error.message);
    res.status(500).json({ message: "Could not export this chat" });
  }
};

const getUsersForSidebar = async (req, res) => {
  try {
    const { search } = req.query;
    const loggedInUserId = req.user._id;

    if (search) {
      // Escape special regex chars to prevent ReDoS / NoSQL injection
      const safeSearch = escapeRegex(search.trim().slice(0, 60));
      const filteredUsers = await User.find({
        _id: { $ne: loggedInUserId },
        fullName: { $regex: safeSearch, $options: "i" }
      }).select(SIDEBAR_USER_FIELDS).lean();
      return res.status(200).json(await attachUnreadCounts(filteredUsers, req.user));
    }

    // 1. Get IDs of users the logged-in user has chatted with (1-on-1 only, exclude group messages where groupId is set)
    const chattedUserIds = await Message.distinct("receiverId", { senderId: loggedInUserId, groupId: null });
    const chattedUserIds2 = await Message.distinct("senderId", { receiverId: loggedInUserId, groupId: null });

    const chattedSet = new Set([
      ...chattedUserIds.filter(Boolean).map(id => id.toString()),
      ...chattedUserIds2.filter(Boolean).map(id => id.toString())
    ]);
    chattedSet.delete(loggedInUserId.toString());
    const chattedIds = Array.from(chattedSet);

    // 2. Fetch the chatted users
    const chattedUsers = await User.find({
      _id: { $in: chattedIds, $ne: loggedInUserId },
      fullName: { $exists: true, $ne: "" }
    }).select(SIDEBAR_USER_FIELDS).lean();

    // 3. Fetch up to 4 dummy seeded users (excluding the logged-in user, and excluding already chatted users)
    const dummyUsers = await User.find({
      _id: { $ne: loggedInUserId, $nin: chattedIds },
      fullName: { $exists: true, $ne: "" },
      email: { $regex: "@example\\.com$" }
    })
    .limit(4)
    .select(SIDEBAR_USER_FIELDS)
    .lean();

    // 4. Combine chatted users and dummy users
    const combinedUsers = [...chattedUsers, ...dummyUsers];

    return res.status(200).json(await attachUnreadCounts(combinedUsers, req.user));
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const limit = parseInt(req.query.limit) || 0;
    const skip = parseInt(req.query.skip) || 0;

    const pinnedMessage = await Message.findOne({
      $or: [
        { senderId: myId, receiverId: userToChatId, groupId: null },
        { senderId: userToChatId, receiverId: myId, groupId: null }
      ],
      isPinned: true,
      deletedFor: { $ne: myId }
    }).populate("replyTo");

    if (pinnedMessage) {
      res.setHeader("X-Pinned-Message", encodeURIComponent(JSON.stringify(pinnedMessage)));
    }

    if (limit > 0) {
      const messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: userToChatId, groupId: null },
          { senderId: userToChatId, receiverId: myId, groupId: null }
        ],
        deletedFor: { $ne: myId }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("replyTo");

      res.status(200).json(messages.reverse());
    } else {
      const messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: userToChatId, groupId: null },
          { senderId: userToChatId, receiverId: myId, groupId: null }
        ],
        deletedFor: { $ne: myId }
      })
      .sort({ createdAt: 1 })
      .populate("replyTo");
      res.status(200).json(messages);
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const { text, image, images, voice, replyTo, isForwarded, isOneView, scheduledAt, attachments } = req.body;
    const senderId = req.user._id;

    // Check block list
    const sender = await User.findById(senderId);
    const recipient = await User.findById(receiverId);
    if (!recipient || !sender) {
      return res.status(404).json({ message: "User not found" });
    }
    const isSenderBlocked = recipient.blockedUsers && recipient.blockedUsers.includes(senderId);
    const isRecipientBlocked = sender.blockedUsers && sender.blockedUsers.includes(receiverId);
    if (isSenderBlocked || isRecipientBlocked) {
      return res.status(403).json({ message: "You cannot send messages due to blocking" });
    }

    let imageUrl = "";
    if (image) {
      const imgValidation = validateImage(image);
      if (!imgValidation.valid) {
        return res.status(400).json({ message: imgValidation.reason });
      }
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let imagesUrlArray = [];
    if (Array.isArray(images) && images.length > 0) {
      const imagesToUpload = images.slice(0, 5); // Limit max 5 images
      for (const imgData of imagesToUpload) {
        const imgValidation = validateImage(imgData);
        if (!imgValidation.valid) {
          return res.status(400).json({ message: imgValidation.reason });
        }
      }
      const uploadPromises = imagesToUpload.map((imgData) => cloudinary.uploader.upload(imgData));
      const uploadResponses = await Promise.all(uploadPromises);
      imagesUrlArray = uploadResponses.map((res) => res.secure_url);
    }

    let voiceUrl = "";
    if (voice) {
      const voiceValidation = validateVoice(voice);
      if (!voiceValidation.valid) {
        return res.status(400).json({ message: voiceValidation.reason });
      }
      const uploadResponse = await cloudinary.uploader.upload(voice, {
        resource_type: "video"
      });
      voiceUrl = uploadResponse.secure_url;
    }

    // R2 attachments arrive as metadata only — the bytes went straight from the
    // client to the bucket. Each one is confirmed to actually exist and match
    // what was authorized before it is allowed onto a message, otherwise a
    // client could reference a key it never uploaded.
    let verifiedAttachments = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        return res.status(400).json({
          message: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at once`,
        });
      }

      for (const att of attachments) {
        const check = await verifyAttachment({
          key: att?.key,
          kind: att?.kind,
          size: att?.size,
          mime: att?.mime,
        });
        if (!check.valid) {
          return res.status(400).json({ message: check.reason });
        }

        verifiedAttachments.push({
          kind: att.kind,
          key: att.key,
          // Rebuilt server-side so a client cannot point the bubble at an
          // arbitrary URL while passing a legitimate key.
          url: publicUrlForKey(att.key),
          name: safeDisplayName(att.name),
          mime: check.mime,
          size: check.size,
          duration: Number.isFinite(att.duration) ? att.duration : undefined,
          width: Number.isFinite(att.width) ? att.width : undefined,
          height: Number.isFinite(att.height) ? att.height : undefined,
          posterUrl: typeof att.posterUrl === "string" ? att.posterUrl : "",
        });
      }
    }

    const timer = sender?.disappearingTimers?.get(receiverId) || "off";

    let deleteAt = undefined;
    if (timer !== "off") {
      const durationMap = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000
      };
      const ms = durationMap[timer];
      if (ms) {
        deleteAt = new Date(Date.now() + ms);
      }
    }

    // If a scheduledAt is provided and is a future date, create a scheduled message
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Invalid scheduledAt value" });
      }
      if (scheduledDate.getTime() <= Date.now()) {
        return res.status(400).json({ message: "scheduledAt must be in the future" });
      }

      const scheduledMessage = new Message({
        senderId,
        receiverId,
        text: text ? sanitizeText(text) : text,
        image: imageUrl,
        images: imagesUrlArray.length > 0 ? imagesUrlArray : undefined,
        voice: voiceUrl || undefined,
        replyTo: replyTo || null,
        isForwarded: isForwarded || false,
        isOneView: isOneView || false,
        scheduledAt: scheduledDate,
        scheduledStatus: "scheduled",
        scheduledBy: senderId,
      });

      await scheduledMessage.save();
      return res.status(201).json(scheduledMessage);
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text ? sanitizeText(text) : text, // strip HTML/JS from message text
      image: imageUrl,
      images: imagesUrlArray.length > 0 ? imagesUrlArray : undefined,
      voice: voiceUrl || undefined,
      deleteAt,
      replyTo: replyTo || null,
      isForwarded: isForwarded || false,
      isOneView: isOneView || false
    });

    await newMessage.save();
    await newMessage.populate("replyTo");

    const receiverSocketId=getReceiverSocketId(receiverId);
    if(receiverSocketId){
      io.to(receiverSocketId).emit("newMessage",newMessage)
    }

    res.status(201).json(newMessage);

  } catch (error) {
    console.log("Error in sendMessage:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

const setDisappearingTimer = async (req, res) => {
  try {
    const { id: recipientId } = req.params;
    const { timer } = req.body; // "off", "1h", "24h", "7d"
    const senderId = req.user._id;

    if (!["off", "1h", "24h", "7d"].includes(timer)) {
      return res.status(400).json({ message: "Invalid timer value" });
    }

    // 1. Update sender's disappearingTimers map
    const sender = await User.findById(senderId);
    if (!sender.disappearingTimers) {
      sender.disappearingTimers = new Map();
    }
    sender.disappearingTimers.set(recipientId, timer);
    await sender.save();

    // 2. Update recipient's disappearingTimers map
    const recipient = await User.findById(recipientId);
    if (recipient) {
      if (!recipient.disappearingTimers) {
        recipient.disappearingTimers = new Map();
      }
      recipient.disappearingTimers.set(senderId.toString(), timer);
      await recipient.save();

      // 3. Emit real-time update to recipient if online
      const receiverSocketId = getReceiverSocketId(recipientId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("disappearingTimerUpdate", { userId: senderId.toString(), timer });
      }
    }

    res.status(200).json(sender);
  } catch (error) {
    console.log("Error in setDisappearingTimer:", error);
    res.status(500).json({ message: "Failed to update disappearing timer" });
  }
};

const toggleMessageReaction = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body; // emoji character (e.g. 👍, ❤️)
    const userId = req.user._id;

    const message = await Message.findById(messageId).populate("replyTo");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the user already reacted to this message
    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        // Toggle off if clicking the same reaction emoji
        message.reactions.splice(existingIndex, 1);
      } else {
        // Replace with new reaction emoji
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      // Add new reaction emoji
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    // Broadcast update via socket
    const receiverId = message.senderId.toString() === userId.toString()
      ? message.receiverId.toString()
      : message.senderId.toString();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReaction", {
        messageId: message._id.toString(),
        reactions: message.reactions
      });
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in toggleMessageReaction:", error);
    res.status(500).json({ message: "Failed to update reaction" });
  }
};

const toggleContactAction = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    const { action } = req.body; // "favorite" or "archive"
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (action === "favorite") {
      const idx = user.favorites.indexOf(contactId);
      if (idx > -1) {
        user.favorites.splice(idx, 1);
      } else {
        user.favorites.push(contactId);
      }
    } else if (action === "archive") {
      const idx = user.archived.indexOf(contactId);
      if (idx > -1) {
        user.archived.splice(idx, 1);
      } else {
        user.archived.push(contactId);
      }
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await user.save();
    res.status(200).json(user);
  } catch (error) {
    console.error("Error in toggleContactAction:", error);
    res.status(500).json({ message: "Failed to update action" });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { type } = req.body; // "me" or "everyone"
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (type === "me") {
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }

      // Hidden by both participants (or by the only participant, in a
      // self-chat) means it is unreachable — reclaim the row and its media
      // instead of keeping a document nobody can ever load.
      const participants = new Set(
        [message.senderId?.toString(), message.receiverId?.toString()].filter(Boolean)
      );
      const hiddenBy = new Set(message.deletedFor.map((id) => id.toString()));
      const hiddenByAll = !message.groupId && [...participants].every((id) => hiddenBy.has(id));

      if (hiddenByAll) {
        await destroyMessageAssets(message);
        await Message.deleteOne({ _id: message._id });
        return res.status(200).json({ _id: message._id, purged: true });
      }
    } else if (type === "everyone") {
      // Validate that caller is the sender
      if (message.senderId.toString() !== userId.toString()) {
        return res.status(403).json({ message: "You can only delete your own messages for everyone" });
      }

      // Free the Cloudinary assets before clearing the URLs — once the
      // fields are blanked there is no record of what to delete.
      await destroyMessageAssets(message);

      message.isDeletedForEveryone = true;
      message.text = "";
      message.image = "";
      message.images = [];
      message.voice = undefined;
      message.reactions = []; // Clear reactions
      await message.save();

      // Broadcast socket event to receiver
      const receiverId = message.receiverId.toString();
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageDeleted", {
          messageId: message._id.toString(),
          isDeletedForEveryone: true
        });
      }
    } else {
      return res.status(400).json({ message: "Invalid delete type" });
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ message: "Failed to delete message" });
  }
};

const clearChatHistory = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    const myId = req.user._id;

    // Append myId to deletedFor array of all messages in this conversation
    await Message.updateMany(
      {
        $or: [
          { senderId: myId, receiverId: contactId, groupId: null },
          { senderId: contactId, receiverId: myId, groupId: null }
        ],
        deletedFor: { $ne: myId }
      },
      {
        $addToSet: { deletedFor: myId }
      }
    );

    // Anything now hidden by both sides is unreachable forever, so reclaim
    // the media and the rows. Clearing a long chat is the single biggest
    // source of stranded uploads, since every image in it becomes orphaned.
    const purgeable = await Message.find({
      $or: [
        { senderId: myId, receiverId: contactId, groupId: null },
        { senderId: contactId, receiverId: myId, groupId: null },
      ],
      deletedFor: { $all: [myId, contactId] },
    }).select("image images voice");

    if (purgeable.length > 0) {
      await destroyAssets(purgeable.flatMap(assetUrlsOf));
      await Message.deleteMany({ _id: { $in: purgeable.map((m) => m._id) } });
    }

    res.status(200).json({
      message: "Chat history cleared successfully",
      purged: purgeable.length,
    });
  } catch (error) {
    console.error("Error in clearChatHistory:", error);
    res.status(500).json({ message: "Failed to clear chat history" });
  }
};

const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId).populate("replyTo");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }

    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - new Date(message.createdAt).getTime() > fifteenMinutes) {
      return res.status(400).json({ message: "Messages can only be edited within 15 minutes of sending" });
    }

    message.text = text ? sanitizeText(text) : text; // strip HTML/JS on edit too
    message.isEdited = true;
    await message.save();

    const receiverId = message.receiverId.toString();
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in editMessage:", error);
    res.status(500).json({ message: "Failed to edit message" });
  }
};

const toggleBlockUser = async (req, res) => {
  try {
    const { id: targetId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const idx = user.blockedUsers.indexOf(targetId);
    let isBlocked = false;
    if (idx > -1) {
      user.blockedUsers.splice(idx, 1);
    } else {
      user.blockedUsers.push(targetId);
      isBlocked = true;
    }

    await user.save();
    res.status(200).json({ user, isBlocked });
  } catch (error) {
    console.error("Error in toggleBlockUser:", error);
    res.status(500).json({ message: "Failed to update block state" });
  }
};

const createCallLog = async (req, res) => {
  try {
    // Supports both 1-on-1 and group call logs. For group calls, pass `groupId` in the body.
    const { receiverId, groupId, callType, callDuration, callStatus } = req.body;
    const senderId = req.user._id;

    let text = "";
    if (callStatus === "completed") {
      const minutes = Math.floor(callDuration / 60);
      const seconds = callDuration % 60;
      const durationStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
      text = `${callType === "video" ? "📹 Video Call" : "📞 Voice Call"} (${durationStr})`;
    } else if (callStatus === "missed") {
      text = `Missed ${callType} call`;
    } else if (callStatus === "declined") {
      text = `Declined ${callType} call`;
    }

    const newMessageData = {
      senderId,
      text,
      isCallLog: true,
      callType,
      callDuration,
      callStatus,
    };

    if (groupId) {
      newMessageData.groupId = groupId;
    } else if (receiverId) {
      newMessageData.receiverId = receiverId;
    }

    const newMessage = new Message(newMessageData);
    await newMessage.save();
    await newMessage.populate("replyTo");

    if (groupId) {
      // Broadcast to group room
      io.to(`group_${groupId}`).emit("newGroupMessage", newMessage);
    } else if (receiverId) {
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in createCallLog:", error);
    res.status(500).json({ message: "Failed to create call log" });
  }
};

const togglePinMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString() && message.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    const otherUser = message.senderId.toString() === userId.toString() ? message.receiverId : message.senderId;
    const isPinning = !message.isPinned;

    if (isPinning) {
      await Message.updateMany(
        {
          $or: [
            { senderId: userId, receiverId: otherUser },
            { senderId: otherUser, receiverId: userId }
          ],
          isPinned: true
        },
        { $set: { isPinned: false } }
      );
    }

    message.isPinned = isPinning;
    await message.save();

    const receiverSocketId = getReceiverSocketId(otherUser.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messagePinned", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in togglePinMessage:", error);
    res.status(500).json({ message: "Failed to toggle pin state" });
  }
};

const updateChatWallpaper = async (req, res) => {
  try {
    const { id: recipientId } = req.params;
    let { wallpaper } = req.body;
    const myId = req.user._id;

    let dimTag = "";
    if (wallpaper && wallpaper.includes("#dim=")) {
      const parts = wallpaper.split("#dim=");
      wallpaper = parts[0];
      dimTag = `#dim=${parts[1]}`;
    }

    if (wallpaper && wallpaper.startsWith("data:image")) {
      const uploadResponse = await cloudinary.uploader.upload(wallpaper);
      wallpaper = uploadResponse.secure_url + dimTag;
    } else if (dimTag) {
      wallpaper = wallpaper + dimTag;
    }

    const myUser = await User.findById(myId);
    if (!myUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!myUser.chatWallpapers) myUser.chatWallpapers = new Map();
    myUser.chatWallpapers.set(recipientId.toString(), wallpaper);
    await myUser.save();

    const recipientUser = await User.findById(recipientId);
    if (recipientUser) {
      if (!recipientUser.chatWallpapers) recipientUser.chatWallpapers = new Map();
      recipientUser.chatWallpapers.set(myId.toString(), wallpaper);
      await recipientUser.save();
    }

    const receiverSocketId = getReceiverSocketId(recipientId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chatWallpaperUpdate", {
        updatedBy: myId.toString(),
        wallpaper
      });
    }

    res.status(200).json({ myUser, wallpaper });
  } catch (error) {
    console.error("Error in updateChatWallpaper:", error);
    res.status(500).json({ message: "Failed to update chat wallpaper" });
  }
};

const viewOneViewMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.isOneView) {
      return res.status(400).json({ message: "Not a view once message" });
    }

    if (!message.viewedBy) {
      message.viewedBy = [];
    }

    const userIdStr = userId.toString();
    const viewedByStrs = message.viewedBy.map(id => id.toString());

    if (!viewedByStrs.includes(userIdStr)) {
      message.viewedBy.push(userId);
      await message.save();

      // Emit real-time viewed status via socket to both participants
      const senderSocketId = getReceiverSocketId(message.senderId.toString());
      const receiverSocketId = getReceiverSocketId(message.receiverId.toString());

      const updatePayload = { messageId: message._id, viewedBy: message.viewedBy.map(id => id.toString()) };

      if (senderSocketId) io.to(senderSocketId).emit("messageViewed", updatePayload);
      if (receiverSocketId) io.to(receiverSocketId).emit("messageViewed", updatePayload);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in viewOneViewMessage:", error);
    res.status(500).json({ message: "Failed to view message" });
  }
};

const deleteMessagesBulk = async (req, res) => {
  try {
    const { messageIds, type } = req.body; // type: "me" or "everyone"
    const userId = req.user._id;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: "No messages selected" });
    }

    if (type === "me") {
      // Add user to deletedFor list in all selected messages
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { deletedFor: userId } }
      );
    } else {
      // Delete for everyone: verify sender ownership and delete
      // We will update isDeletedForEveryone to true and clear attachments
      const messages = await Message.find({ _id: { $in: messageIds }, senderId: userId });
      const validIds = messages.map((m) => m._id);

      await Message.updateMany(
        { _id: { $in: validIds } },
        {
          $set: {
            isDeletedForEveryone: true,
            text: "",
            image: "",
            voice: "",
            reactions: []
          }
        }
      );

      // Emit socket event to update everyone
      messages.forEach((msg) => {
        const receiverSocketId = getReceiverSocketId(msg.receiverId.toString());
        const senderSocketId = getReceiverSocketId(msg.senderId.toString());

        const payload = { messageId: msg._id, isDeletedForEveryone: true };

        if (receiverSocketId) io.to(receiverSocketId).emit("messageDeleted", payload);
        if (senderSocketId) io.to(senderSocketId).emit("messageDeleted", payload);
      });
    }

    res.status(200).json({ message: "Messages deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMessagesBulk:", error);
    res.status(500).json({ message: "Failed to delete messages in bulk" });
  }
};

const cancelScheduledMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.scheduledStatus !== 'scheduled') return res.status(400).json({ message: 'Only scheduled messages can be cancelled' });
    if (msg.senderId.toString() !== userId.toString()) return res.status(403).json({ message: 'Not authorized' });

    msg.scheduledStatus = 'failed';
    await msg.save();
    res.status(200).json({ message: 'Scheduled message cancelled' });
  } catch (err) {
    console.error('Error cancelling scheduled message', err);
    res.status(500).json({ message: 'Failed to cancel scheduled message' });
  }
};

export { 
  getUsersForSidebar, 
  getMessages, 
  sendMessage, 
  setDisappearingTimer, 
  toggleMessageReaction,
  toggleContactAction,
  deleteMessage,
  clearChatHistory,
  editMessage,
  toggleBlockUser,
  createCallLog,
  togglePinMessage,
  updateChatWallpaper,
  viewOneViewMessage,
  deleteMessagesBulk
  ,cancelScheduledMessage
  ,setContactNickname
  ,getBlockedUsers
  ,exportChat
};
