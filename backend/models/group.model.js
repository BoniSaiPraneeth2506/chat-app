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
    // Shareable join link. Absent until an admin generates one, and replaced
    // wholesale when revoked so an old link can never work again. Indexed
    // sparsely because most groups will never have one.
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
    // Off by default, so no existing group silently gains the ability. Only an
    // admin can turn it on.
    allowAnonymousQuestions: {
      type: Boolean,
      default: false,
    },
    // Shown once to each member the first time they open the group after
    // joining. Both optional: a group with neither set shows nothing, so
    // existing groups are unaffected.
    welcomeMessage: {
      type: String,
      default: "",
    },
    rules: {
      type: String,
      default: "",
    },
    // Who has already been shown the welcome. Held server-side rather than in
    // the browser so it does not reappear on another device or after a
    // reinstall, and so it is per account rather than per browser.
    welcomeSeenBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: [],
    }],
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
