import mongoose from "mongoose";

// One document per physical Android device's FCM registration token.
//
// A user can be logged in on several phones/tablets, so tokens are stored as
// their own documents rather than as an array on the user — deactivating a
// single revoked token (when FCM reports UNREGISTERED) becomes a targeted
// delete instead of rewriting the whole user row.
const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["android"],
      default: "android",
    },
    // Opaque client-generated id so an app instance can recognise and replace
    // its own stale entry instead of a duplicate being accumulated on relogin.
    deviceId: {
      type: String,
      default: "",
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);
export default DeviceToken;
