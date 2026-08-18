import mongoose, { Schema } from "mongoose";
import User from "./user.model.js";

const pollOptionSchema = new Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  votes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: [],
  }],
});

const pollSchema = new Schema({
  question: {
    type: String,
    required: true,
    trim: true,
  },
  options: [pollOptionSchema],
  allowMultiple: {
    type: Boolean,
    default: false,
  },
  isClosed: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

// Large attachments (video, documents) live in Cloudflare R2 rather than
// Cloudinary, and are described by one polymorphic array instead of another
// pair of top-level fields. `key` is the source of truth: if the bucket or the
// domain in front of it ever changes, the key survives and `url` is rebuilt.
const attachmentSchema = new Schema({
  kind: {
    type: String,
    enum: ["video", "document"],
    required: true,
  },
  key: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: "",
  },
  mime: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number, // video length in seconds
  },
  width: {
    type: Number,
  },
  height: {
    type: Number,
  },
  posterUrl: {
    type: String, // client-generated video thumbnail; R2 does no transcoding
    default: "",
  },
}, { _id: false });

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
      required: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    images: [{
      type: String,
    }],
    voice: {
      type: String,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
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
    },
    // Users @-mentioned in this message. Sent explicitly by the composer's
    // picker rather than parsed from the text, so a name that merely looks
    // like a mention never silently notifies someone.
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: []
    }],
    // Transcript captured while the voice note was recorded.
    voiceTranscript: {
      type: String,
      default: ""
    },
    // Speech-to-text for a voice note, produced on demand by AssemblyAI and
    // then kept forever, so a message is never transcribed twice.
    //
    // Separate from voiceTranscript above, which was a client-side capture and
    // is left alone — repurposing it would have conflated "what the recorder
    // heard" with "what the service returned", and lost the status a retry needs.
    transcript: {
      text: { type: String, default: "" },
      status: {
        type: String,
        enum: ["not_requested", "processing", "completed", "failed"],
        default: "not_requested",
      },
      language: { type: String, default: "" },
      assemblyTranscriptId: { type: String, default: "" },
      error: { type: String, default: "" },
      // Stamped when a job is claimed. A server restart mid-transcription would
      // otherwise leave the message stuck on "processing" with nothing able to
      // clear it; a claim older than the stale window can be retried.
      requestedAt: { type: Date, default: null },
    },
    isForwarded: {
      type: Boolean,
      default: false
    },
    // Anonymous group question. senderId is still recorded — anonymity is a
    // presentation rule, not an absence of accountability — but the server never
    // includes it in any response or socket payload for these messages.
    isAnonymous: {
      type: Boolean,
      default: false
    },
    isOneView: {
      type: Boolean,
      default: false
    },
    viewedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: []
    }]
    ,
    // Scheduling fields (optional)
    scheduledAt: {
      type: Date,
      default: null,
    },
    scheduledStatus: {
      type: String,
      enum: ["scheduled", "queued", "sent", "failed"],
      default: null,
    },
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Interactive polls — group chats only
    poll: {
      type: pollSchema,
      default: undefined,
    }
  },
  { timestamps: true }
);
const Message=mongoose.model("Message",messageSchema)

export default Message;
