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

const getUsersForSidebar = async (req, res) => {
  try {
    const { search } = req.query;
    const loggedInUserId = req.user._id;

    if (search) {
      const filteredUsers = await User.find({
        _id: { $ne: loggedInUserId },
        fullName: { $regex: search, $options: "i" }
      }).select("-password");
      return res.status(200).json(filteredUsers);
    }

    // 1. Get IDs of users the logged-in user has chatted with
    const chattedUserIds = await Message.distinct("receiverId", { senderId: loggedInUserId });
    const chattedUserIds2 = await Message.distinct("senderId", { receiverId: loggedInUserId });

    const chattedSet = new Set([
      ...chattedUserIds.map(id => id.toString()),
      ...chattedUserIds2.map(id => id.toString())
    ]);
    chattedSet.delete(loggedInUserId.toString());
    const chattedIds = Array.from(chattedSet);

    // 2. Fetch the chatted users
    const chattedUsers = await User.find({
      _id: { $in: chattedIds, $ne: loggedInUserId },
      fullName: { $exists: true, $ne: "" }
    }).select("-password");

    // 3. Fetch up to 4 dummy seeded users (excluding the logged-in user, and excluding already chatted users)
    const dummyUsers = await User.find({
      _id: { $ne: loggedInUserId, $nin: chattedIds },
      fullName: { $exists: true, $ne: "" },
      email: { $regex: "@example\\.com$" }
    })
    .limit(4)
    .select("-password");

    // 4. Combine chatted users and dummy users
    const combinedUsers = [...chattedUsers, ...dummyUsers];

    return res.status(200).json(combinedUsers);
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
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId }
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
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId }
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
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId }
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
    const { text, image, voice, replyTo } = req.body;
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
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let voiceUrl = "";
    if (voice) {
      const uploadResponse = await cloudinary.uploader.upload(voice, {
        resource_type: "video"
      });
      voiceUrl = uploadResponse.secure_url;
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

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      voice: voiceUrl || undefined,
      deleteAt,
      replyTo: replyTo || null
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
    } else if (type === "everyone") {
      // Validate that caller is the sender
      if (message.senderId.toString() !== userId.toString()) {
        return res.status(403).json({ message: "You can only delete your own messages for everyone" });
      }

      message.isDeletedForEveryone = true;
      message.text = "";
      message.image = "";
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
          { senderId: myId, receiverId: contactId },
          { senderId: contactId, receiverId: myId }
        ],
        deletedFor: { $ne: myId }
      },
      {
        $addToSet: { deletedFor: myId }
      }
    );

    res.status(200).json({ message: "Chat history cleared successfully" });
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

    message.text = text;
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
    const { receiverId, callType, callDuration, callStatus } = req.body;
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

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      isCallLog: true,
      callType,
      callDuration,
      callStatus
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
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
  updateChatWallpaper
};
