import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "moderator", "member"],
    default: "member",
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    groupPic: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [groupMemberSchema],
    isReadOnly: {
      type: Boolean,
      default: false, // Legacy: kept in sync with permissions.sendMessages
    },
    // Per-action restrictions. Each is "everyone" or "admins" (which includes
    // moderators). Left undefined the effective value is derived — see
    // lib/groupPermissions.js — so groups created before this existed keep
    // behaving exactly as they did.
    permissions: {
      sendMessages: { type: String, enum: ["everyone", "admins"] },
      addMembers: { type: String, enum: ["everyone", "admins"] },
      editInfo: { type: String, enum: ["everyone", "admins"] },
      startCalls: { type: String, enum: ["everyone", "admins"] },
    },
    activeCall: {
      isActive: { type: Boolean, default: false },
      type: { type: String, enum: ["voice", "video"] },
      startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
  },
  { timestamps: true }
);

const Group = mongoose.model("Group", groupSchema);
export default Group;
