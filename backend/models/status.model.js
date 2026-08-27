import mongoose from "mongoose";

const statusMediaSchema = new mongoose.Schema({
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
}, { _id: false });

const statusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  media: {
    type: statusMediaSchema,
    required: true,
  },
  caption: {
    type: String,
    default: "",
    maxlength: 300,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  viewers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  cleanupStatus: {
    type: String,
    enum: ["active", "pending", "cleaned"],
    default: "active",
  },
}, { timestamps: false });

statusSchema.index({ user: 1, createdAt: -1 });
statusSchema.index({ expiresAt: 1, cleanupStatus: 1 });

const Status = mongoose.model("Status", statusSchema);
export default Status;
