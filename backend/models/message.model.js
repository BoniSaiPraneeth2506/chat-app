import mongoose, { Schema } from "mongoose";
import User from "./user.model.js";

const messageSchema = new Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    voice: {
      type: String,
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    isCallLog: {
      type: Boolean,
      default: false
    },
    callType: {
      type: String, // "voice" or "video"
    },
    callDuration: {
      type: Number, // duration in seconds
    },
    callStatus: {
      type: String, // "completed", "missed", "declined"
    },
    deleteAt: {
      type: Date,
      expires: 0
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        emoji: { type: String, required: true }
      }
    ],
    deletedFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: []
    }],
    isDeletedForEveryone: {
      type: Boolean,
      default: false
    },
    isPinned: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);
const Message=mongoose.model("Message",messageSchema)

export default Message;
