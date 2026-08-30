import mongoose from "mongoose";

// A single broadcast post on a channel. Only the owner and admins create these;
// followers read them and can react and view (which feeds "seen by" stats).
const channelPostMediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    contentType: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const channelReactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reaction: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const channelPostSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    media: {
      type: channelPostMediaSchema,
    },
    // A viewer id recording that a follower opened this post at least once.
    // Deduplicated per follower so "views" means unique followers, not opens.
    views: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactions: [channelReactionSchema],
    pinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Feed reads are "the newest posts on this channel" and pinned posts are held
// out for separate fetching by admins.
channelPostSchema.index({ channel: 1, createdAt: -1 });
channelPostSchema.index({ channel: 1, pinned: 1 });

const ChannelPost = mongoose.model("ChannelPost", channelPostSchema);
export default ChannelPost;
