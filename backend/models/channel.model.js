import mongoose from "mongoose";

// A Channel is a one-way broadcast. Unlike a group, followers never send — the
// owner and admins publish posts and everyone who follows reads them.
const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    avatar: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    // public channels appear in Explore and can be followed by anyone. private
    // channels are hidden from search/explore and only reachable by invite
    // link — the system never exposes their existence to non-followers.
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Moderators who can post and moderate but not delete the channel.
    admins: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Shareable join link. Absent until the owner generates one, and replaced
    // wholesale when revoked so an old link can never work again. Indexed
    // sparsely because most channels will never have one.
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    inviteCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    inviteCreatedAt: {
      type: Date,
    },
    // Denormalised follower count so list/explore queries never aggregate.
    followerCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Explore and search read "public channels ordered by recent activity".
// Followers' lists read "channels a user follows, newest activity first" via
// the ChannelFollower collection, so the useful index here is by owner, privacy
// and recency.
channelSchema.index({ privacy: 1, updatedAt: -1 });
channelSchema.index({ owner: 1, updatedAt: -1 });
channelSchema.index({ category: 1, privacy: 1 });

const Channel = mongoose.model("Channel", channelSchema);
export default Channel;
