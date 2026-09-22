import mongoose from "mongoose";

// Tracks a single active live-location share between two users.
//
// The share is created when a `location.isLive` message is sent and survives
// server restarts / socket reconnects so a recipient can always query the
// sharer's most recent coordinates. Real-time coordinate refreshes are relayed
// over Socket.IO (`liveLocation:update`); this document just holds the latest
// known point and the share's lifecycle (active / stopped / expired).
const liveLocationSchema = new mongoose.Schema(
  {
    sharerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The message id of the `location.isLive` message that started the share.
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      unique: true,
    },
    // Duration in minutes: 15, 60 or 480.
    duration: {
      type: Number,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    latestLat: {
      type: Number,
      default: null,
    },
    latestLng: {
      type: Number,
      default: null,
    },
    lastUpdateAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

liveLocationSchema.index({ sharerId: 1, recipientId: 1 });
liveLocationSchema.index({ expiresAt: 1 });

const LiveLocation = mongoose.model("LiveLocation", liveLocationSchema);
export default LiveLocation;
