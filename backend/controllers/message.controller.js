// import Message from "../models/message.model.js";
// import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import mongoose from "mongoose";
import { transcribeAudioUrl, isTranscriptionConfigured } from "../lib/assemblyai.js";
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
import { getReceiverSocketId, io, invalidateBlockCache, emitAccountLists } from "../lib/socket.js";
import sanitizeHtml from "sanitize-html";
import { destroyMessageAssets, assetUrlsOf, destroyAssets, attachmentKeysOf, destroyObjects } from "../lib/mediaCleanup.js";
import { isGiphyMediaUrl } from "../lib/giphy.js";
import {
  verifyAttachment,
  publicUrlForKey,
  safeDisplayName,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "../lib/attachments.js";
import { pushDmNotification } from "../lib/fcmNotifications.js";

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

// ── Chat Streak Helper ────────────────────────────────────────────────────────
//
// Snapchat-style daily streaks between two DM contacts. Both users' maps are
// updated atomically so the count is consistent regardless of who sent the
// message. A streak continues if both users message on consecutive calendar
// days (UTC); it resets to 1 if a day is missed.

const utcDayKey = (date = new Date()) =>
  date.toISOString().slice(0, 10); // "YYYY-MM-DD"

const yesterdayKey = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDayKey(d);
};

/**
 * Updates the streak between sender and receiver on both users' documents.
 * Best-effort: a failure here must never block the message from being delivered.
 */
const updateChatStreaks = async (userIdA, userIdB) => {
  try {
    const today = utcDayKey();
    const yesterday = yesterdayKey();

    const computeStreak = (existing) => {
      const prev = existing?.count || 0;
      const lastDay = existing?.lastActiveDay || "";
      const longest = existing?.longestStreak || 0;

      let count;
      if (lastDay === today) {
        count = prev;
      } else if (lastDay === yesterday) {
        count = prev + 1;
      } else {
        count = 1;
      }
      return { count, lastActiveDay: today, longestStreak: Math.max(longest, count) };
    };

    const [userA, userB] = await Promise.all([
      User.findById(userIdA).select("chatStreaks"),
      User.findById(userIdB).select("chatStreaks"),
    ]);

    if (!userA || !userB) return;

    const streakA = userA.chatStreaks?.get?.(userIdB.toString()) || userA.chatStreaks?.get?.(userIdB) || {};
    const streakB = userB.chatStreaks?.get?.(userIdA.toString()) || userB.chatStreaks?.get?.(userIdA) || {};

    const newStreakA = computeStreak(streakA);
    const newStreakB = computeStreak(streakB);

    userA.chatStreaks.set(userIdB.toString(), newStreakA);
    userB.chatStreaks.set(userIdA.toString(), newStreakB);

    await Promise.all([userA.save(), userB.save()]);

    const toObj = (v) => v && typeof v === "object" ? { count: v.count || 0, longestStreak: v.longestStreak || 0, lastActiveDay: v.lastActiveDay || "" } : null;

    const sockA = getReceiverSocketId(userIdA);
    const sockB = getReceiverSocketId(userIdB);
    if (sockA) io.to(sockA).emit("streakUpdate", { partnerId: userIdB, streak: toObj(newStreakA) });
    if (sockB) io.to(sockB).emit("streakUpdate", { partnerId: userIdA, streak: toObj(newStreakB) });
  } catch (err) {
    console.error("updateChatStreaks error:", err);
  }
};

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

/**
 * A client-supplied video poster, or nothing.
 *
 * This is the one place bytes are allowed into the database, so it is bounded on
 * both shape and size: a small JPEG data URL and nothing else. Left unchecked, the
 * field would accept any string of any length — an arbitrary remote URL that every
 * viewer's browser would then fetch, or a payload large enough to bloat the
 * document.
 */
const safePosterUrl = (value) => {
  if (typeof value !== "string" || !value.startsWith("data:image/jpeg;base64,")) return "";
  // ~80 KB of base64 is a generous ceiling for a 320px thumbnail.
  if (value.length > 110_000) return "";
  return value;
};

/**
 * Hosts an image may be referenced from rather than uploaded.
 *
 * Until now this path took a data URI and nothing else, which quietly broke two
 * things: forwarding an image sent its existing URL and was rejected as an
 * "invalid image format", and a GIF picked from GIPHY had nowhere to go but a
 * re-upload of a file GIPHY already hosts permanently.
 *
 * A URL from a client ends up stored on a message and then loaded by everyone
 * else's browser, so the host is checked rather than trusted. Only three are
 * allowed: our own image storage, our own file storage, and GIPHY's media
 * domains. Anything else still has to arrive as data and go through validation.
 */
const isTrustedMediaUrl = (value) => {
  if (typeof value !== "string" || !value.startsWith("https://") || value.length > 400) {
    return false;
  }
  if (isGiphyMediaUrl(value)) return true;
  try {
    const { hostname } = new URL(value);
    if (hostname === "res.cloudinary.com") return true;
    const r2 = String(process.env.R2_PUBLIC_URL || "");
    if (r2) {
      const r2Host = new URL(r2).hostname;
      if (r2Host && hostname === r2Host) return true;
    }
    return false;
  } catch {
    return false;
  }
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

  // When each contact last read MY messages, for the sender-side read ticks.
  // The client used to keep this in localStorage, seeded only from a live
  // socket event, so ticks reset on reinstall and were shared across every
  // account signed in on the same browser.
  //
  // Only the single value for this viewer is returned. Sending a contact's
  // whole lastReadAt map would expose who else they talk to, which is why
  // SIDEBAR_USER_FIELDS strips the field and this is fetched separately.
  const readRows = await User.find({ _id: { $in: users.map((u) => u._id) } })
    .select("lastReadAt")
    .lean();
  const myId = me._id.toString();
  const readMineAt = new Map(
    readRows.map((r) => {
      const map = r.lastReadAt || {};
      const value = map instanceof Map ? map.get(myId) : map[myId];
      return [r._id.toString(), value ? new Date(value).getTime() : 0];
    })
  );

  return users.map((u) => ({
    ...u,
    unreadCount: countBySender.get(u._id.toString()) || 0,
    readMyMessagesAt: readMineAt.get(u._id.toString()) || 0,
  }));
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

/**
 * Attaches each contact's newest message to the rows the sidebar will render.
 *
 * The client used to build these previews by requesting every conversation in
 * full — one round trip per contact, each returning that contact's entire history
 * so the last item could be read off the end. Two queries replace all of it, and
 * the cost stops growing with how much has been said.
 *
 * Only messages this user can still see count: cleared ones carry them in
 * deletedFor, and an expired disappearing message is gone from the conversation,
 * so neither should be quoted in a preview.
 */
const attachLastMessages = async (users, myId) => {
  if (!Array.isArray(users) || users.length === 0) return users;
  const ids = users.map((u) => u._id);

  const newest = await Message.aggregate([
    {
      $match: {
        $and: [
          { groupId: null, deletedFor: { $ne: myId } },
          { $or: [{ senderId: myId }, { receiverId: myId }] },
          unexpired(),
        ],
      },
    },
    {
      $addFields: {
        counterparty: {
          $cond: [{ $eq: ["$senderId", myId] }, "$receiverId", "$senderId"],
        },
      },
    },
    { $match: { counterparty: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$counterparty", messageId: { $first: "$_id" } } },
  ]);

  if (newest.length === 0) return users.map((u) => ({ ...u, lastMessage: null }));

  const previews = await Message.find({ _id: { $in: newest.map((n) => n.messageId) } })
    .select(
      "senderId receiverId text image images voice attachments contact createdAt isDeletedForEveryone isCallLog callType callStatus callDuration"
    )
    .lean();

  const byId = new Map(previews.map((m) => [String(m._id), m]));
  const byCounterparty = new Map(
    newest.map((n) => [String(n._id), byId.get(String(n.messageId)) || null])
  );

  return users.map((u) => ({ ...u, lastMessage: byCounterparty.get(String(u._id)) || null }));
};

/**
 * Excludes a disappearing message whose time is up.
 *
 * The row itself is removed by the media sweep moments later, and by the TTL
 * index after that if the sweep is down. Filtering at read time is what makes
 * either delay invisible: the message leaves the conversation the instant it
 * expires, not whenever a background job happens to catch it.
 */
const unexpired = () => ({
  $or: [{ deleteAt: null }, { deleteAt: { $exists: false } }, { deleteAt: { $gt: new Date() } }],
});

/**
 * One contact, by id, for a QR deep link.
 *
 * The link used to be resolved against the sidebar list, which only holds people
 * this user has already talked to — so scanning a code for someone new always
 * ended in "could not find that user" and a bounce to the home screen, which is
 * precisely the case the feature exists for. A cleared conversation had the same
 * problem for the same reason.
 *
 * A locked contact is refused. Otherwise the deep link would be a way around the
 * lock: the row is withheld from every list, and handing it back here would undo
 * that for anyone holding the URL.
 */
const getContactById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if ((req.user.lockedChats || []).some((locked) => String(locked) === String(id))) {
      return res.status(404).json({ message: "User not found" });
    }

    const contact = await User.findById(id).select(SIDEBAR_USER_FIELDS).lean();
    if (!contact || !contact.fullName) {
      return res.status(404).json({ message: "User not found" });
    }

    const [withCounts] = await attachUnreadCounts([contact], req.user);
    res.status(200).json(withCounts || contact);
  } catch (error) {
    console.error("Error in getContactById:", error);
    res.status(500).json({ message: "Internal server error" });
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
        _id: { $ne: loggedInUserId, $nin: req.user.lockedChats || [] },
        fullName: { $regex: safeSearch, $options: "i" }
      }).select(SIDEBAR_USER_FIELDS).lean();
      return res.status(200).json(
        await attachLastMessages(await attachUnreadCounts(filteredUsers, req.user), loggedInUserId)
      );
    }

    // 1. Users the logged-in user has chatted with (1-on-1 only; groupId is set
    //    for group messages).
    //
    //    Messages this user has hidden are excluded. Clearing a chat only adds
    //    the user to each message's `deletedFor`, so without this filter the
    //    conversation still counted as "chatted with" and the contact stayed in
    //    the sidebar after being deleted. Skipping them makes the row disappear
    //    like WhatsApp, and reappear on the next message — which is not hidden.
    const visibleToMe = { groupId: null, deletedFor: { $ne: loggedInUserId } };
    // Independent of each other, so they go out together rather than one after
    // the other — this is on the path of every sidebar load.
    const [chattedUserIds, chattedUserIds2] = await Promise.all([
      Message.distinct("receiverId", { ...visibleToMe, senderId: loggedInUserId }),
      Message.distinct("senderId", { ...visibleToMe, receiverId: loggedInUserId }),
    ]);

    const chattedSet = new Set([
      ...chattedUserIds.filter(Boolean).map(id => id.toString()),
      ...chattedUserIds2.filter(Boolean).map(id => id.toString())
    ]);
    chattedSet.delete(loggedInUserId.toString());
    const chattedIds = Array.from(chattedSet);

    // Locked conversations are withheld here rather than hidden in the client.
    // If they were sent and merely not rendered, the lock would be one edited
    // state away from being bypassed.
    const lockedIds = (req.user.lockedChats || []).map(String);
    const clearedIds = (req.user.clearedChats || []).map(String);
    const withheld = [...new Set([...lockedIds, ...clearedIds])];

    // 2. Fetch the chatted users
    const chattedUsers = await User.find({
      _id: { $in: chattedIds.filter((id) => !withheld.includes(id)), $ne: loggedInUserId },
      fullName: { $exists: true, $ne: "" }
    }).select(SIDEBAR_USER_FIELDS).lean();

    // 3. Fetch up to 4 dummy seeded users (excluding the logged-in user, and excluding already chatted users)
    // The locked list has to be excluded here as well as from the chatted query.
    // A locked contact with no message history is not in chattedIds, so it fell
    // through this second query and appeared in the sidebar anyway.
    const dummyUsers = await User.find({
      _id: { $ne: loggedInUserId, $nin: [...chattedIds, ...withheld] },
      fullName: { $exists: true, $ne: "" },
      email: { $regex: "@example\\.com$" }
    })
    .limit(4)
    .select(SIDEBAR_USER_FIELDS)
    .lean();

    // 4. Combine chatted users and dummy users
    const combinedUsers = [...chattedUsers, ...dummyUsers];

    return res.status(200).json(
      await attachLastMessages(await attachUnreadCounts(combinedUsers, req.user), loggedInUserId)
    );
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

    // A window centred on one message, for jumping to a date from the calendar.
    //
    // Paging backwards from the newest end until the target appears would mean a
    // request per page and could be dozens of them on an old conversation. This
    // reads outwards from the message itself: half the window before it, half
    // after, in one pair of indexed queries.
    if (req.query.around) {
      const aroundId = String(req.query.around);
      if (!mongoose.Types.ObjectId.isValid(aroundId)) {
        return res.status(400).json({ message: "Invalid message id" });
      }

      const conversation = {
        $and: [
          {
            $or: [
              { senderId: myId, receiverId: userToChatId, groupId: null },
              { senderId: userToChatId, receiverId: myId, groupId: null },
            ],
          },
          unexpired(),
        ],
        deletedFor: { $ne: myId },
      };

      const target = await Message.findOne({ _id: aroundId, ...conversation }).lean();
      if (!target) {
        return res.status(404).json({ message: "That message is no longer here" });
      }

      const half = Math.max(Math.floor((limit || 40) / 2), 5);
      const [before, after] = await Promise.all([
        Message.find({ ...conversation, createdAt: { $lte: target.createdAt } })
          .sort({ createdAt: -1 })
          .limit(half + 1)
          .populate("replyTo"),
        Message.find({ ...conversation, createdAt: { $gt: target.createdAt } })
          .sort({ createdAt: 1 })
          .limit(half)
          .populate("replyTo"),
      ]);

      // `before` came back newest-first and includes the target itself.
      const window = [...before.reverse(), ...after];
      res.setHeader("X-Window-Anchor", aroundId);
      res.setHeader("X-Window-Has-Newer", after.length === half ? "1" : "0");
      return res.status(200).json(window);
    }

    if (limit > 0) {
      const messages = await Message.find({
        $and: [
          {
            $or: [
              { senderId: myId, receiverId: userToChatId, groupId: null },
              { senderId: userToChatId, receiverId: myId, groupId: null }
            ],
          },
          unexpired(),
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
        $and: [
          {
            $or: [
              { senderId: myId, receiverId: userToChatId, groupId: null },
              { senderId: userToChatId, receiverId: myId, groupId: null }
            ],
          },
          unexpired(),
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
    const { text, image, images, voice, replyTo, isForwarded, isOneView, scheduledAt, attachments, contact, clientId } = req.body;
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
      if (isTrustedMediaUrl(image)) {
        // Already hosted — a forwarded image, or a GIF. Copying it into our own
        // storage would spend quota on a file that is served fine where it is.
        imageUrl = image;
      } else {
        const imgValidation = validateImage(image);
        if (!imgValidation.valid) {
          return res.status(400).json({ message: imgValidation.reason });
        }
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      }
    }

    let imagesUrlArray = [];
    if (Array.isArray(images) && images.length > 0) {
      const incoming = images.slice(0, 5); // Limit max 5 images
      // Same split as the single image above: already-hosted ones pass through in
      // place, the rest are validated and uploaded.
      for (const imgData of incoming) {
        if (isTrustedMediaUrl(imgData)) continue;
        const imgValidation = validateImage(imgData);
        if (!imgValidation.valid) {
          return res.status(400).json({ message: imgValidation.reason });
        }
      }
      imagesUrlArray = await Promise.all(
        incoming.map(async (imgData) => {
          if (isTrustedMediaUrl(imgData)) return imgData;
          const uploaded = await cloudinary.uploader.upload(imgData);
          return uploaded.secure_url;
        })
      );
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

    // Attachments arrive as metadata only — the bytes went straight from the
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
          posterUrl: safePosterUrl(att.posterUrl),
        });
      }
    }

    // A shared contact is resolved from the id rather than taken as given: the
    // client sends who it means, and the name and picture come from that account
    // here. Otherwise a card could carry any name against any profile.
    let contactCard = undefined;
    if (contact?.user) {
      if (!mongoose.Types.ObjectId.isValid(String(contact.user))) {
        return res.status(400).json({ message: "Invalid contact" });
      }
      const shared = await User.findById(contact.user).select("fullName email profilePic").lean();
      if (!shared) {
        return res.status(400).json({ message: "That contact no longer exists" });
      }
      contactCard = {
        user: shared._id,
        name: shared.fullName || "",
        email: shared.email || "",
        profilePic: shared.profilePic || "",
      };
    }

    const timer = sender?.disappearingTimers?.get(receiverId) || sender?.messageTimer || "off";

    let deleteAt = undefined;
    if (timer !== "off") {
      const durationMap = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
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
      isOneView: isOneView || false,
      attachments: verifiedAttachments.length > 0 ? verifiedAttachments : undefined,
      contact: contactCard,
    });

    await newMessage.save();
    await newMessage.populate("replyTo");

    // Either side writing again undoes the deletion, on both accounts: the sender
    // is plainly in this conversation once more, and the recipient has something
    // new to read. Anything already hidden stays hidden — only the row returns.
    await User.updateOne({ _id: senderId }, { $pull: { clearedChats: receiverId } });
    await User.updateOne({ _id: receiverId }, { $pull: { clearedChats: senderId } });

    // Snapchat-style daily streaks: update both users' counters. Best-effort,
    // so a failure here never blocks the message.
    if (receiverId) {
      updateChatStreaks(senderId, receiverId).catch(() => {});
    }

    // Delivered to the recipient and to the sender's own other devices.
    //
    // Only the recipient used to hear about this, so a message sent from a phone
    // never appeared on the same account's laptop until something refetched —
    // which is not how any messenger behaves. The echo carries the sending
    // client's own id back with it, which is what lets that one device recognise
    // its own optimistic copy and merge rather than show the message twice.
    // Devices that have no such copy simply append it.
    const payload = { ...newMessage.toObject(), clientId: clientId || null };
    const rooms = new Set();
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) rooms.add(receiverSocketId);
    const senderRoom = getReceiverSocketId(senderId);
    if (senderRoom) rooms.add(senderRoom);
    if (rooms.size > 0) io.to([...rooms]).emit("newMessage", payload);

    // Android push fallback: notify the recipient's registered devices when
    // they aren't already viewing this exact conversation. The service is a
    // best-effort no-op if Firebase is unconfigured or the user has muted /
    // opted out — it never blocks the message that was already delivered.
    pushDmNotification({
      recipientUser: recipient,
      sender,
      message: newMessage,
      type: newMessage.replyTo ? "reply" : "chat_message",
    }).catch(() => {});

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

    if (!["off", "1h", "24h", "7d", "30d"].includes(timer)) {
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

    // Same shape of bug the delete and edit paths had: a group message has no
    // receiverId, so working out "the other party" threw a TypeError here and the
    // whole request came back 500 — which is why reacting in a group did nothing.
    if (message.groupId) {
      io.to(`group_${message.groupId.toString()}`).emit("groupMessageReaction", {
        messageId: message._id.toString(),
        groupId: message.groupId.toString(),
        reactions: message.reactions,
      });
    } else {
      const otherParty =
        message.senderId.toString() === userId.toString()
          ? message.receiverId?.toString()
          : message.senderId.toString();

      const receiverSocketId = otherParty ? getReceiverSocketId(otherParty) : null;
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageReaction", {
          messageId: message._id.toString(),
          reactions: message.reactions,
        });
      }
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in toggleMessageReaction:", error);
    res.status(500).json({ message: "Failed to update reaction" });
  }
};

const MAX_PINNED_CHATS = 2;

const toggleContactAction = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    // scope decides which set of lists is touched. Groups keep their own arrays
    // because the DM ones are ref:"User"; sharing them would break populate.
    const { action, scope } = req.body; // action: favorite | archive | pin
    const isGroup = scope === "group";
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const toggle = (list) => {
      const idx = list.indexOf(contactId);
      if (idx > -1) list.splice(idx, 1);
      else list.push(contactId);
    };

    const lists = isGroup
      ? { favorite: "favoriteGroups", archive: "archivedGroups", pin: "pinnedGroups" }
      : { favorite: "favorites", archive: "archived", pin: "pinnedChats" };

    if (action === "favorite") {
      toggle(user[lists.favorite]);
    } else if (action === "archive") {
      toggle(user[lists.archive]);
    } else if (action === "pin") {
      // The cap is enforced here as well as in the UI: the client used to own
      // this entirely via localStorage, so nothing stopped a stale or crafted
      // client from pinning without limit.
      const target = user[lists.pin];
      const alreadyPinned = target.some((id) => id.toString() === contactId);
      const pinnedTotal = (user.pinnedChats?.length || 0) + (user.pinnedGroups?.length || 0);
      if (!alreadyPinned && pinnedTotal >= MAX_PINNED_CHATS) {
        return res
          .status(400)
          .json({ message: `You can only pin up to ${MAX_PINNED_CHATS} chats` });
      }
      toggle(target);
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await user.save();

    // Only the three lists are returned. This previously sent the whole
    // Mongoose document — password hash, session records and password-reset
    // OTP included — and the client assigned it straight into authUser.
    // Named for what it is, since `lists` above already means the field-name map.
    const payload = {
      favorites: user.favorites,
      archived: user.archived,
      pinnedChats: user.pinnedChats,
      favoriteGroups: user.favoriteGroups,
      archivedGroups: user.archivedGroups,
      pinnedGroups: user.pinnedGroups,
    };

    // The device that made the change already has the response; this is for the
    // user's other devices.
    emitAccountLists(userId, payload);

    res.status(200).json(payload);
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

      // Broadcast. A group message has no receiverId — reading it unguarded
      // threw a TypeError here and surfaced as a 500, which is why group
      // messages could not be deleted for everyone at all.
      if (message.groupId) {
        io.to(`group_${message.groupId.toString()}`).emit("groupMessageDeleted", {
          messageId: message._id.toString(),
          groupId: message.groupId.toString(),
          isDeletedForEveryone: true
        });
      } else if (message.receiverId) {
        const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageDeleted", {
            messageId: message._id.toString(),
            isDeletedForEveryone: true
          });
        }
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

/**
 * Which days this conversation has messages on, and where each one starts.
 *
 * The calendar in a contact's profile used to work this out from the loaded page —
 * the newest twenty messages — so every day older than those read as empty even
 * when it held a hundred messages. One grouped count answers it for the whole
 * conversation instead.
 *
 * Grouped in the caller's timezone, not UTC. A message sent at 00:30 in Chennai is
 * the 19th there and the 18th in UTC, and a calendar that disagrees with the date
 * separator above the message is worse than no calendar.
 */
const getMessageDates = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const contact = new mongoose.Types.ObjectId(contactId);
    const myId = req.user._id;

    // "+05:30" / "-08:00". Anything else falls back to UTC rather than being
    // passed through to the database.
    const tz = /^[+-]\d{2}:\d{2}$/.test(String(req.query.tz || "")) ? req.query.tz : "+00:00";

    const rows = await Message.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { senderId: myId, receiverId: contact, groupId: null },
                { senderId: contact, receiverId: myId, groupId: null },
              ],
            },
            unexpired(),
          ],
          deletedFor: { $ne: myId },
        },
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } },
          // The first message of that day is where the jump should land.
          firstId: { $first: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      days: rows.map((row) => ({ date: row._id, firstId: String(row.firstId), count: row.count })),
    });
  } catch (error) {
    console.error("Error in getMessageDates:", error);
    res.status(500).json({ message: "Failed to load chat dates" });
  }
};

/**
 * Every image in a conversation, for the gallery in a contact's profile.
 *
 * The panel used to build this from whatever was loaded in the open conversation,
 * which is the newest page and nothing more — so it painted from the cache, then
 * the fetch replaced that page and every picture older than the last twenty
 * messages disappeared a couple of seconds after the panel opened.
 *
 * Multi-image messages are included. Those keep their files in `images` and leave
 * `image` empty, so the old filter missed them entirely and the count was wrong
 * even for what was loaded.
 */
const getSharedMedia = async (req, res) => {
  try {
    const { id: contactId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const contact = new mongoose.Types.ObjectId(contactId);
    const myId = req.user._id;

    // The profile panel shows a handful of tiles; the gallery behind it asks for
    // pages. Capped so a single request cannot be turned into a full export.
    const LIMIT = Math.min(Math.max(parseInt(req.query.limit, 10) || 60, 1), 120);
    const SKIP = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const scope = {
      $and: [
        {
          $or: [
            { senderId: myId, receiverId: contact, groupId: null },
            { senderId: contact, receiverId: myId, groupId: null },
          ],
        },
        { $or: [{ image: { $nin: [null, ""] } }, { "images.0": { $exists: true } }] },
        unexpired(),
      ],
      deletedFor: { $ne: myId },
      isDeletedForEveryone: { $ne: true },
    };

    const [recent, totals] = await Promise.all([
      Message.find(scope)
        .sort({ createdAt: -1 })
        .skip(SKIP)
        .limit(LIMIT)
        .select("image images createdAt")
        .lean(),
      Message.aggregate([
        { $match: scope },
        {
          $project: {
            pictures: {
              $add: [
                { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$image", ""] } }, 0] }, 1, 0] },
                { $size: { $ifNull: ["$images", []] } },
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$pictures" } } },
      ]),
    ]);

    const total = totals[0]?.total || 0;

    // One entry per picture, newest first, so a message carrying five of them
    // contributes five tiles rather than one.
    const items = [];
    for (const message of recent) {
      const urls = message.image ? [message.image] : [];
      if (Array.isArray(message.images)) urls.push(...message.images.filter(Boolean));
      urls.forEach((url, index) => {
        items.push({ _id: `${message._id}-${index}`, url, createdAt: message.createdAt });
      });
    }

    res.status(200).json({
      items,
      total,
      hasMore: recent.length === LIMIT,
      skip: SKIP,
    });
  } catch (error) {
    console.error("Error in getSharedMedia:", error);
    res.status(500).json({ message: "Failed to load shared media" });
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
      await Promise.all([
        destroyAssets(purgeable.flatMap(assetUrlsOf)),
        destroyObjects(purgeable.flatMap(attachmentKeysOf)),
      ]);
      await Message.deleteMany({ _id: { $in: purgeable.map((m) => m._id) } });
    }

    // Remembered so the row stays out of the sidebar. Without this the contact
    // simply stopped counting as someone this user had talked to, which let the
    // introductory-accounts query offer them again on the next load.
    await User.updateOne({ _id: myId }, { $addToSet: { clearedChats: contactId } });

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

    // Same shape of bug the delete paths had: a group message has no
    // receiverId, so reading it unguarded threw and the edit came back 500.
    if (message.groupId) {
      const populated = await message.populate("senderId", "fullName profilePic");
      io.to(`group_${message.groupId.toString()}`).emit("groupMessageEdited", populated);
      return res.status(200).json(populated);
    }

    if (message.receiverId) {
      const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageEdited", message);
      }
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

    // The socket layer caches block lists to keep `typing` cheap; drop the
    // entry so a new block takes effect immediately rather than after its TTL.
    invalidateBlockCache(userId);

    // Only the list is returned. This previously sent the whole Mongoose
    // document — password hash, sessions and reset OTP — which the client
    // assigned directly into authUser.
    res.status(200).json({ blockedUsers: user.blockedUsers, isBlocked });
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
      // The caller's own other devices get the log too, so a call placed from the
      // phone shows in the laptop's history. Both copies carry the same _id, which
      // is what the client dedups on.
      const rooms = new Set();
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) rooms.add(receiverSocketId);
      const senderRoom = getReceiverSocketId(senderId);
      if (senderRoom) rooms.add(senderRoom);
      if (rooms.size > 0) io.to([...rooms]).emit("newMessage", newMessage);
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

/** Ids of every group the user belongs to — used to scope bulk operations. */
const groupIdsForUser = async (userId) => {
  const groups = await Group.find({ "members.user": userId }).select("_id");
  return groups.map((g) => g._id);
};

/**
 * Per-message read state ("Message info").
 *
 * There is no per-message read flag in the schema, and adding one would mean a
 * write per recipient per message. Instead this derives seen state from the
 * `lastReadAt` map already maintained for unread counts: a conversation read
 * at or after a message was sent means that message was seen. The map is keyed
 * by the other user's id for a DM and by the group's id for a group.
 *
 * Consequence worth knowing: the timestamp returned is when the reader last
 * opened the conversation, not the instant this specific message was read. For
 * the newest message those coincide; for older ones the real read time may be
 * earlier. Delivery is not tracked at all, so it is not reported rather than
 * being guessed at.
 */
const getMessageInfo = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id.toString();

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ message: "You can only see info for your own messages" });
    }

    const sentAt = message.createdAt;
    const seenBy = [];
    const pending = [];

    const place = (user, readAt) => {
      const entry = {
        _id: user._id,
        fullName: user.fullName,
        profilePic: user.profilePic,
        readAt: readAt || null,
      };
      if (readAt && new Date(readAt) >= new Date(sentAt)) seenBy.push(entry);
      else pending.push(entry);
    };

    if (message.groupId) {
      const group = await Group.findById(message.groupId)
        .populate("members.user", "fullName profilePic lastReadAt");
      if (!group) return res.status(404).json({ message: "Group not found" });

      const isMember = group.members.some((m) => m.user?._id?.toString() === userId);
      if (!isMember) return res.status(403).json({ message: "Not a member of this group" });

      const key = message.groupId.toString();
      group.members
        .filter((m) => m.user && m.user._id.toString() !== userId)
        .forEach((m) => place(m.user, m.user.lastReadAt?.get?.(key)));
    } else if (message.receiverId) {
      const other = await User.findById(message.receiverId).select("fullName profilePic lastReadAt");
      if (other) place(other, other.lastReadAt?.get?.(userId));
    }

    const byTime = (a, b) => new Date(b.readAt) - new Date(a.readAt);
    res.status(200).json({
      messageId: message._id,
      sentAt,
      isGroup: Boolean(message.groupId),
      seenBy: seenBy.sort(byTime),
      pending,
    });
  } catch (error) {
    console.error("Error in getMessageInfo:", error);
    res.status(500).json({ message: "Failed to load message info" });
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
      // Only hide messages the caller can actually see. Previously this
      // updated every id passed in with no ownership check at all, so any
      // authenticated user could write themselves into `deletedFor` on
      // messages from conversations they have no part in.
      const groupIds = await groupIdsForUser(userId);
      const visible = await Message.find({
        _id: { $in: messageIds },
        $or: [
          { senderId: userId },
          { receiverId: userId },
          { groupId: { $in: groupIds } },
        ],
      }).select("_id");

      await Message.updateMany(
        { _id: { $in: visible.map((m) => m._id) } },
        { $addToSet: { deletedFor: userId } }
      );
    } else {
      // Delete for everyone: only the sender's own messages qualify.
      const messages = await Message.find({ _id: { $in: messageIds }, senderId: userId });
      const validIds = messages.map((m) => m._id);

      // Free the hosted assets before the URLs are blanked — afterwards there
      // is no record of what to delete. The single-message path already did
      // this; bulk did not, so bulk deletes leaked storage forever.
      for (const msg of messages) {
        await destroyMessageAssets(msg);
      }

      await Message.updateMany(
        { _id: { $in: validIds } },
        {
          $set: {
            isDeletedForEveryone: true,
            text: "",
            image: "",
            images: [],
            voice: "",
            attachments: [],
            reactions: []
          }
        }
      );

      messages.forEach((msg) => {
        const payload = { messageId: msg._id.toString(), isDeletedForEveryone: true };

        if (msg.groupId) {
          io.to(`group_${msg.groupId.toString()}`).emit("groupMessageDeleted", {
            ...payload,
            groupId: msg.groupId.toString(),
          });
          return;
        }

        // Guarded: a group message has no receiverId, and calling
        // .toString() on it threw here, failing the whole request.
        if (msg.receiverId) {
          const receiverSocketId = getReceiverSocketId(msg.receiverId.toString());
          if (receiverSocketId) io.to(receiverSocketId).emit("messageDeleted", payload);
        }
        const senderSocketId = getReceiverSocketId(msg.senderId.toString());
        if (senderSocketId) io.to(senderSocketId).emit("messageDeleted", payload);
      });
    }

    res.status(200).json({ message: "Messages deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMessagesBulk:", error);
    res.status(500).json({ message: "Failed to delete messages in bulk" });
  }
};

// A claim this old is treated as abandoned, so a restart mid-transcription
// cannot pin a message on "processing" forever.
const STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * Sends transcript state to exactly the people entitled to the message.
 *
 * Group messages go to the group room; DMs go to the two participants only. The
 * payload carries no author information, so it is also safe for an anonymous
 * question — and it never includes anything about the transcription service.
 */
const broadcastTranscript = (message, transcript) => {
  const payload = { messageId: message._id.toString(), transcript };

  if (message.groupId) {
    io.to(`group_${message.groupId.toString()}`).emit("groupMessageTranscript", {
      ...payload,
      groupId: message.groupId.toString(),
    });
    return;
  }

  for (const party of [message.senderId, message.receiverId]) {
    if (!party) continue;
    const socketId = getReceiverSocketId(party.toString());
    if (socketId) io.to(socketId).emit("messageTranscript", payload);
  }
};

/**
 * Runs the transcription and records the outcome.
 *
 * Runs outside the request, so every exit has to persist something: leaving the
 * document on "processing" would strand the message until the stale window
 * expired. The message is re-read afterwards because it may have been deleted
 * while the job was running.
 */
const runTranscription = async (messageId, audioUrl) => {
  const result = await transcribeAudioUrl(audioUrl);

  const update = result.ok
    ? {
        "transcript.status": "completed",
        "transcript.text": (result.text || "").slice(0, 20000),
        "transcript.language": result.language || "",
        "transcript.assemblyTranscriptId": result.id || "",
        "transcript.error": "",
      }
    : {
        "transcript.status": "failed",
        "transcript.error": result.error || "Transcription failed",
        "transcript.assemblyTranscriptId": result.id || "",
      };

  const saved = await Message.findByIdAndUpdate(messageId, { $set: update }, { new: true });
  if (!saved) return; // deleted while transcribing

  broadcastTranscript(
    saved,
    result.ok
      ? { status: "completed", text: saved.transcript.text, language: saved.transcript.language }
      : { status: "failed", error: saved.transcript.error }
  );
};

/**
 * Requests speech-to-text for a voice note.
 *
 * Costs money per call, so the whole design is about calling AssemblyAI exactly
 * once per message, ever:
 *
 *   completed  -> return the stored text, no upstream call
 *   processing -> return that state, no upstream call
 *   otherwise  -> claim the job atomically, then transcribe in the background
 *
 * The claim is a single findOneAndUpdate whose filter includes the current
 * status. Reading the status and then writing it would leave a window where four
 * rapid clicks each see "not_requested" and each start a job; here only the first
 * update matches, and the losers fall through to the "already processing" reply.
 *
 * The response returns immediately rather than waiting for the transcript. A
 * voice note can take tens of seconds, and holding the request open would tie up
 * the client and break on any proxy timeout — the result arrives over the socket
 * the app already uses.
 */
const requestTranscript = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (!message.voice) {
      return res.status(400).json({ message: "That message has no voice note" });
    }
    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "That message was deleted" });
    }

    // Same access rules as reading the conversation itself: a member for a group,
    // one of the two participants for a DM. Without this, any signed-in user
    // could transcribe any voice note by guessing an id — and spend the credits.
    if (message.groupId) {
      const group = await Group.findById(message.groupId).select("members.user");
      const isMember = group?.members?.some((m) => m.user?.toString() === userId.toString());
      if (!isMember) return res.status(403).json({ message: "Not a member of this group" });
    } else {
      const participants = [message.senderId?.toString(), message.receiverId?.toString()];
      if (!participants.includes(userId.toString())) {
        return res.status(403).json({ message: "Not your conversation" });
      }
      // Blocking already prevents sending; it should equally prevent spending
      // credits on the other party's audio.
      const [me, other] = await Promise.all([
        User.findById(userId).select("blockedUsers"),
        User.findById(participants.find((p) => p !== userId.toString())).select("blockedUsers"),
      ]);
      const blocked =
        me?.blockedUsers?.some((b) => b.toString() === other?._id?.toString()) ||
        other?.blockedUsers?.some((b) => b.toString() === userId.toString());
      if (blocked) return res.status(403).json({ message: "Unavailable" });
    }

    const current = message.transcript || {};

    // Already done — hand back what is stored. This is the path every viewer
    // after the first one takes, including the other participant.
    if (current.status === "completed") {
      return res.status(200).json({
        status: "completed",
        text: current.text || "",
        language: current.language || "",
      });
    }

    // Already in flight. Only a claim with a recent timestamp counts as live: a
    // restart between claiming and finishing would otherwise pin the message on
    // "processing" with nothing able to clear it.
    if (current.status === "processing") {
      const claimedAt = current.requestedAt ? new Date(current.requestedAt).getTime() : 0;
      const isLive = claimedAt > 0 && Date.now() - claimedAt <= STALE_CLAIM_MS;
      if (isLive) return res.status(200).json({ status: "processing" });
      // Otherwise fall through and try to reclaim an abandoned job.
    }

    if (!isTranscriptionConfigured()) {
      return res.status(503).json({ message: "Transcription is not available right now" });
    }

    // Atomic claim: whichever request's update matches first wins, and the rest
    // stop matching because status is now "processing" with a fresh timestamp.
    //
    // The staleness bound has to live inside this filter rather than being
    // decided from the earlier read. Deciding it beforehand meant a
    // never-requested message — which has no requestedAt — looked stale to every
    // concurrent request at once, so all of them claimed it and four clicks
    // started four billable jobs.
    const staleCutoff = new Date(Date.now() - STALE_CLAIM_MS);

    const claimed = await Message.findOneAndUpdate(
      { _id: messageId, $or: [
        { "transcript.status": { $in: ["not_requested", "failed"] } },
        { "transcript.status": { $exists: false } },
        { transcript: { $exists: false } },
        // Abandoned claims only. A live claim carries a recent timestamp and
        // fails both of these, which is what makes the losers lose.
        { "transcript.status": "processing", "transcript.requestedAt": { $lt: staleCutoff } },
        { "transcript.status": "processing", "transcript.requestedAt": null },
      ] },
      {
        $set: {
          "transcript.status": "processing",
          "transcript.requestedAt": new Date(),
          "transcript.error": "",
        },
      },
      { new: true }
    );

    if (!claimed) {
      // Someone else claimed it between our read and our update.
      return res.status(200).json({ status: "processing" });
    }

    broadcastTranscript(claimed, { status: "processing" });

    // Deliberately not awaited: the HTTP response goes out now and the result
    // reaches clients over the socket.
    runTranscription(messageId, claimed.voice).catch((err) =>
      console.error("Unhandled transcription failure:", err?.message || err)
    );

    return res.status(202).json({ status: "processing" });
  } catch (error) {
    console.error("Error in requestTranscript:", error);
    res.status(500).json({ message: "Failed to start transcription" });
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

/**
 * Call history for the Updates tab.
 *
 * Every call the signed-in user was part of — as caller or callee in a 1-on-1,
 * or as a member of a group call — is a Message with isCallLog set. This pulls
 * the most recent of those across every chat and reports them newest-first,
 * with enough contact information to render a WhatsApp-style history row.
 */
const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);

    const calls = await Message.find({
      isCallLog: true,
      $or: [
        { senderId: userId, groupId: null, receiverId: { $exists: true } },
        { receiverId: userId, groupId: null },
        { groupId: { $exists: true } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic")
      .populate("groupId", "name groupPic")
      .lean();

    const history = calls.map((call) => {
      let user = null;
      let isGroup = Boolean(call.groupId);

      if (isGroup) {
        user = {
          _id: call.groupId?._id,
          name: call.groupId?.name || "Group call",
          picture: call.groupId?.groupPic || "",
          idType: "group",
          idValue: call.groupId?._id?.toString(),
        };
      } else {
        const other =
          String(call.senderId?._id) === String(userId)
            ? call.receiverId
            : call.senderId;
        user = {
          _id: other?._id,
          name: other?.fullName || "Unknown",
          picture: other?.profilePic || "",
          idType: "user",
          idValue: other?._id?.toString(),
        };
      }

      return {
        _id: call._id,
        callType: call.callType || "voice",
        callStatus: call.callStatus || "completed",
        callDuration: call.callDuration || 0,
        createdAt: call.createdAt,
        isGroup,
        user,
        isOutgoing: String(call.senderId?._id) === String(userId),
      };
    });

    res.status(200).json(history);
  } catch (err) {
    console.error("Error in getCallHistory:", err.message);
    res.status(500).json({ message: "Failed to fetch call history" });
  }
};

export { 
  attachLastMessages,
  getCallHistory,
  getContactById,
  getSharedMedia,
  getMessageDates,
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
  deleteMessagesBulk,
  getMessageInfo
  ,cancelScheduledMessage
  ,setContactNickname
  ,getBlockedUsers
  ,exportChat
  ,requestTranscript
  ,SIDEBAR_USER_FIELDS
  ,attachUnreadCounts
};
