import mongoose from "mongoose";

// One document per channel-follower pair. The unique compound index makes
// follow idempotent and lets us count followers without scanning posts.
const channelFollowerSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Per-channel mute: a muted follower still sees the channel but gets no
    // push notification for new posts.
    muted: {
      type: Boolean,
      default: false,
    },
    followedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// The "join this channel" and "is this user following" lookups.
channelFollowerSchema.index({ channel: 1, user: 1 }, { unique: true });
// "what channels has this user followed, newest first" — the joined-channels list.
channelFollowerSchema.index({ user: 1, followedAt: -1 });
// Counting followers of one channel.
channelFollowerSchema.index({ channel: 1, followedAt: -1 });

const ChannelFollower = mongoose.model("ChannelFollower", channelFollowerSchema);
export default ChannelFollower;
