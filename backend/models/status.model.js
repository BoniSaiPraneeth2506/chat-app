import mongoose from "mongoose";

/**
 * One piece of uploaded media.
 *
 * `key` is the source of truth — the bucket is private, so there is no lasting
 * address to store. `url` is a short-lived signed URL the API fills in per
 * request and nothing else should ever persist.
 */
const statusMediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["image", "video", "audio"],
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
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
}, { _id: false });

// ── Text ──────────────────────────────────────────────────────────────────────
// A text status is rendered from these fields, never from markup, so nothing
// here can carry script into another person's viewer.
const textStyleSchema = new mongoose.Schema({
  content: { type: String, default: "", maxlength: 500 },
  font: { type: String, default: "classic" },
  fontSize: { type: Number, default: 32 },
  color: { type: String, default: "#ffffff" },
  backgroundColor: { type: String, default: "#0b1b3a" },
  backgroundGradient: { type: String, default: "" },
  align: { type: String, enum: ["left", "center", "right"], default: "center" },
  position: { type: String, enum: ["top", "center", "bottom"], default: "center" },
  emoji: { type: String, default: "" },
  // A chosen photo behind the words, if any. Keyed like any other media.
  mediaKey: { type: String, default: "" },
  mediaContentType: { type: String, default: "" },
}, { _id: false });

// ── Voice ─────────────────────────────────────────────────────────────────────
// Reuses the bucket rather than the base64 path voice notes use in chat: a
// status is public to a group of people, so it must not ride inside a message
// document.
const voiceSchema = new mongoose.Schema({
  key: { type: String, default: "" },
  url: { type: String, default: "" },
  contentType: { type: String, default: "" },
  size: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  // Normalised 0..1 bars, so the waveform renders identically on any screen.
  waveform: { type: [Number], default: [] },
  backgroundKey: { type: String, default: "" },
  backgroundContentType: { type: String, default: "" },
}, { _id: false });

// ── Music ─────────────────────────────────────────────────────────────────────
const musicSchema = new mongoose.Schema({
  key: { type: String, default: "" },
  url: { type: String, default: "" },
  contentType: { type: String, default: "" },
  size: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  title: { type: String, default: "" },
  artist: { type: String, default: "" },
  albumArtKey: { type: String, default: "" },
  // Where in the track playback starts, so a status can join in partway.
  startAt: { type: Number, default: 0 },
}, { _id: false });

// ── Poll ──────────────────────────────────────────────────────────────────────
const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 60 },
  // One entry per voter. Server enforces a single choice, so this doubles as
  // the tally and never needs reconciling.
  votes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
}, { _id: false });

const pollSchema = new mongoose.Schema({
  question: { type: String, default: "", maxlength: 200 },
  options: { type: [pollOptionSchema], default: [] },
  isClosed: { type: Boolean, default: false },
}, { _id: false });

// ── Question ──────────────────────────────────────────────────────────────────
const questionSchema = new mongoose.Schema({
  prompt: { type: String, default: "", maxlength: 200 },
  answers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, default: "", maxlength: 300 },
    createdAt: { type: Date, default: Date.now },
  }],
  // The owner may switch answers off; viewers never see them either way.
  answersVisibleToOwner: { type: Boolean, default: true },
}, { _id: false });

// ── Link ──────────────────────────────────────────────────────────────────────
const linkSchema = new mongoose.Schema({
  url: { type: String, default: "" },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  imageKey: { type: String, default: "" },
  imageContentType: { type: String, default: "" },
  domain: { type: String, default: "" },
}, { _id: false });

// ── Location ──────────────────────────────────────────────────────────────────
// Coordinates only ever arrive from an explicit in-app choice. Nothing here
// reads the device's position on its own.
const locationSchema = new mongoose.Schema({
  lat: { type: Number, default: 0 },
  lng: { type: Number, default: 0 },
  name: { type: String, default: "" },
  address: { type: String, default: "" },
  precision: {
    type: String,
    enum: ["exact", "approximate"],
    // Approximate, matching what the controller does. A default of "exact" here
    // would mean any write that skipped the controller's own defaulting — a
    // script, a migration, a future endpoint — silently published a precise pin
    // for a status nobody asked to share one.
    default: "approximate",
  },
}, { _id: false });

// ── Countdown ─────────────────────────────────────────────────────────────────
const countdownSchema = new mongoose.Schema({
  title: { type: String, default: "", maxlength: 100 },
  // Absolute instant. Storing the target rather than a duration means a
  // countdown edited later, or a device with a wrong clock, still lands on the
  // same moment for everyone.
  targetAt: { type: Date, required: true },
}, { _id: false });

/**
 * Who a status is for.
 *
 * `include`/`exclude` are only read for the modes that name them, and are
 * enforced in lib/statusPrivacy.js on every read path — including the one that
 * signs media URLs. Hiding a row in the client would not be privacy.
 */
const privacySchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ["everyone", "contacts", "closeFriends", "only", "except"],
    default: "contacts",
  },
  include: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  exclude: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { _id: false });

const statusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // What kind of status this is. Image and video keep the original behaviour
  // (a required single `media`); everything else carries its own payload and
  // may or may not have media of its own.
  type: {
    type: String,
    enum: [
      "image",
      "video",
      "text",
      "layout",
      "voice",
      "music",
      "poll",
      "question",
      "link",
      "location",
      "countdown",
    ],
    default: "image",
  },
  // Primary media. Optional now that a text or poll status needs no upload;
  // still the only media a plain photo or video status carries.
  media: {
    type: statusMediaSchema,
    default: null,
  },
  // Extra items for multi-photo layouts. Empty for every other type, and a
  // layout's own `media` is its first photo, so a renderer can treat the two
  // the same way.
  mediaItems: { type: [statusMediaSchema], default: [] },
  caption: {
    type: String,
    default: "",
    maxlength: 300,
  },
  text: { type: textStyleSchema },
  voice: { type: voiceSchema },
  music: { type: musicSchema },
  poll: { type: pollSchema },
  question: { type: questionSchema },
  link: { type: linkSchema },
  location: { type: locationSchema },
  countdown: { type: countdownSchema },
  privacy: { type: privacySchema },
  // Chosen from the contact picker, never parsed out of the text, so a name that
  // merely looks like a mention never notifies anyone.
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  // Likes are separate from viewers[].reaction: a like is a toggle with no emoji
  // to pick, and overloading one field for both made "liked" and "reacted with
  // a heart" indistinguishable.
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  // Text replies made from the viewer. Long answers live as ordinary chat
  // messages carrying a statusRef; this keeps the short ones with the status so
  // the owner's list is a single read.
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, default: "", maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  // A scheduled status is invisible until statusPublisher promotes it, so it can
  // never leak early through the list endpoint.
  statusState: {
    type: String,
    enum: ["active", "scheduled"],
    default: "active",
  },
  scheduledFor: {
    type: Date,
    default: null,
  },
  // Expired but kept because the owner asked for it. Never shown to anyone else.
  isArchived: { type: Boolean, default: false },
  viewers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
    reaction: {
      type: String,
      default: "",
    },
  }],
  cleanupStatus: {
    type: String,
    enum: ["active", "pending", "cleaned"],
    default: "active",
  },
  // How many times the sweep has tried to delete this status's media. Bounded so
  // one undeletable object cannot hold a batch hostage for ever.
  cleanupAttempts: { type: Number, default: 0 },
}, { timestamps: false });

statusSchema.index({ user: 1, createdAt: -1 });
statusSchema.index({ expiresAt: 1, cleanupStatus: 1 });
// The publisher sweeps for due statuses on a timer; this is the index it uses.
statusSchema.index({ statusState: 1, scheduledFor: 1 });
statusSchema.index({ user: 1, isArchived: 1, createdAt: -1 });

const Status = mongoose.model("Status", statusSchema);
export default Status;
