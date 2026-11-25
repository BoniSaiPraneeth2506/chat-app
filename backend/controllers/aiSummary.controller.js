import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import { summarizeUnreadMessages, mapMessageForSummary, AI_SUMMARY_LIMITS, isGeminiConfigured } from "../services/aiSummaryService.js";

const MAX_MSGS = AI_SUMMARY_LIMITS.maxMessagesPerConversation;
const MAX_CONVS = AI_SUMMARY_LIMITS.maxConversationsPerCatchUp;
const hits = new Map();
const LIMIT = Number(process.env.AI_SUMMARY_RATE_LIMIT || 8);
const WINDOW_MS = Number(process.env.AI_SUMMARY_RATE_WINDOW_MS || 60_000);

const rateLimited = (userId) => {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now > entry.resetAt) { hits.set(userId, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  entry.count += 1;
  return entry.count > LIMIT;
};
const readAtFor = (lastReadAt, id) => {
  const value = lastReadAt instanceof Map ? lastReadAt.get(String(id)) : lastReadAt?.[String(id)];
  return value ? new Date(value) : new Date(0);
};
const unexpired = () => ({ $or: [{ deleteAt: null }, { deleteAt: { $exists: false } }, { deleteAt: { $gt: new Date() } }] });
const threadFilter = () => ({ $or: [{ threadRootId: null }, { threadRootId: { $exists: false } }] });

const getUnreadDmMessages = async ({ meId, otherId, lastReadAt, since }) => {
  const cutoff = since instanceof Date && !Number.isNaN(since.getTime()) ? since : readAtFor(lastReadAt, otherId);
  const query = { groupId: null, senderId: otherId, receiverId: meId, deletedFor: { $ne: meId }, isDeletedForEveryone: { $ne: true }, createdAt: { $gt: cutoff }, $and: [unexpired()] };
  const unreadCount = await Message.countDocuments(query);
  if (!unreadCount) return { unreadCount: 0, messages: [], truncated: false };
  const limit = Math.min(MAX_MSGS, unreadCount);
  const skip = Math.max(0, unreadCount - limit);
  const messages = await Message.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit).populate("senderId", "fullName").lean();
  return { unreadCount, messages, truncated: unreadCount > messages.length };
};

const getUnreadGroupMessages = async ({ meId, groupId, lastReadAt, since }) => {
  const cutoff = since instanceof Date && !Number.isNaN(since.getTime()) ? since : readAtFor(lastReadAt, groupId);
  const query = { groupId, senderId: { $ne: meId }, deletedFor: { $ne: meId }, isDeletedForEveryone: { $ne: true }, createdAt: { $gt: cutoff }, $and: [threadFilter(), unexpired()] };
  const unreadCount = await Message.countDocuments(query);
  if (!unreadCount) return { unreadCount: 0, messages: [], truncated: false };
  const limit = Math.min(MAX_MSGS, unreadCount);
  const skip = Math.max(0, unreadCount - limit);
  const messages = await Message.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit).populate("senderId", "fullName").lean();
  return { unreadCount, messages, truncated: unreadCount > messages.length };
};

const summarizeConversation = async ({ conversationName, type, unreadCount, messages, truncated }) => {
  if (!messages.length) return null;
  const summary = await summarizeUnreadMessages({ conversationName, type, unreadCount, messages: messages.map(mapMessageForSummary) });
  return { ...summary, truncated: Boolean(truncated || summary.truncated) };
};

export const summarizeChat = async (req, res) => {
  try {
    if (!isGeminiConfigured()) return res.status(503).json({ message: "Gemini AI is not configured on this server" });
    const meId = req.user._id;
    if (rateLimited(String(meId))) return res.status(429).json({ message: "Too many AI summary requests. Try again in a moment." });
    const { conversationId } = req.params;
    const { type, since } = req.query || {};
    if (!mongoose.Types.ObjectId.isValid(conversationId)) return res.status(400).json({ message: "Invalid conversation id" });

    const me = await User.findById(meId).select("lastReadAt").lean();
    const lastReadAt = me?.lastReadAt || new Map();
    const sinceDate = since ? new Date(String(since)) : null;
    let resolvedType = type === "group" || type === "dm" ? type : null;
    let group = null;
    let otherUser = null;
    if (resolvedType !== "dm") {
      group = await Group.findOne({ _id: conversationId, "members.user": meId }).select("_id name").lean();
      if (group) resolvedType = "group";
    }
    if (!group && resolvedType !== "group") {
      otherUser = await User.findById(conversationId).select("_id fullName").lean();
      if (otherUser) resolvedType = "dm";
    }
    if (!group && !otherUser) return res.status(404).json({ message: "Conversation not found" });

    if (group) {
      const { unreadCount, messages, truncated } = await getUnreadGroupMessages({ meId, groupId: group._id, lastReadAt, since: sinceDate });
      if (!unreadCount) return res.status(200).json({ conversationId: String(group._id), type: "group", name: group.name, unreadCount: 0, summary: null });
      const summary = await summarizeConversation({ conversationName: group.name, type: "group chat", unreadCount, messages, truncated });
      return res.status(200).json({ conversationId: String(group._id), type: "group", name: group.name, unreadCount, summary });
    }

    const { unreadCount, messages, truncated } = await getUnreadDmMessages({ meId, otherId: otherUser._id, lastReadAt, since: sinceDate });
    if (!unreadCount) return res.status(200).json({ conversationId: String(otherUser._id), type: "dm", name: otherUser.fullName, unreadCount: 0, summary: null });
    const summary = await summarizeConversation({ conversationName: otherUser.fullName, type: "individual chat", unreadCount, messages, truncated });
    return res.status(200).json({ conversationId: String(otherUser._id), type: "dm", name: otherUser.fullName, unreadCount, summary });
  } catch (err) {
    console.error("Error in summarizeChat:", err.message);
    return res.status(err.status || 500).json({ message: err.message || "Failed to summarize chat" });
  }
};

export const catchUpSummaries = async (req, res) => {
  try {
    if (!isGeminiConfigured()) return res.status(503).json({ message: "Gemini AI is not configured on this server" });
    const meId = req.user._id;
    if (rateLimited(String(meId))) return res.status(429).json({ message: "Too many AI summary requests. Try again in a moment." });
    const me = await User.findById(meId).select("lastReadAt").lean();
    const lastReadAt = me?.lastReadAt || new Map();

    const groups = await Group.find({ "members.user": meId }).select("_id name groupPic updatedAt").lean();
    const groupCandidates = [];
    for (const g of groups) {
      const query = { groupId: g._id, senderId: { $ne: meId }, deletedFor: { $ne: meId }, isDeletedForEveryone: { $ne: true }, createdAt: { $gt: readAtFor(lastReadAt, g._id) }, $and: [threadFilter(), unexpired()] };
      const [unreadCount, latest] = await Promise.all([Message.countDocuments(query), Message.findOne(query).sort({ createdAt: -1 }).select("createdAt").lean()]);
      if (unreadCount > 0) groupCandidates.push({ type: "group", conversationId: String(g._id), name: g.name, groupPic: g.groupPic || "", unreadCount, latestAt: latest?.createdAt || g.updatedAt || new Date(0) });
    }

    const dmAgg = await Message.aggregate([
      { $match: { receiverId: new mongoose.Types.ObjectId(meId), groupId: null, isDeletedForEveryone: { $ne: true }, deletedFor: { $ne: new mongoose.Types.ObjectId(meId) }, $or: [{ deleteAt: null }, { deleteAt: { $exists: false } }, { deleteAt: { $gt: new Date() } }] } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$senderId", latestAt: { $first: "$createdAt" }, messages: { $push: "$createdAt" } } },
    ]);
    const dmCandidates = [];
    for (const row of dmAgg) {
      const senderId = String(row._id);
      const cutoff = readAtFor(lastReadAt, senderId);
      const unreadCount = (row.messages || []).filter((d) => new Date(d) > cutoff).length;
      if (unreadCount <= 0) continue;
      const user = await User.findById(row._id).select("_id fullName profilePic").lean();
      if (!user) continue;
      dmCandidates.push({ type: "dm", conversationId: String(user._id), name: user.fullName, profilePic: user.profilePic || "", unreadCount, latestAt: row.latestAt || new Date(0) });
    }

    const all = [...groupCandidates, ...dmCandidates].sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt)).slice(0, MAX_CONVS);
    const results = await Promise.all(all.map(async (conv) => {
      try {
        const payload = conv.type === "group"
          ? await getUnreadGroupMessages({ meId, groupId: new mongoose.Types.ObjectId(conv.conversationId), lastReadAt })
          : await getUnreadDmMessages({ meId, otherId: new mongoose.Types.ObjectId(conv.conversationId), lastReadAt });
        if (!payload.unreadCount) return { ...conv, unreadCount: 0, summary: null, error: null };
        const summary = await summarizeConversation({ conversationName: conv.name, type: conv.type === "group" ? "group chat" : "individual chat", unreadCount: payload.unreadCount, messages: payload.messages, truncated: payload.truncated });
        return { ...conv, unreadCount: payload.unreadCount, summary, error: null };
      } catch (e) {
        return { ...conv, summary: null, error: e?.message || "Failed to summarize" };
      }
    }));

    const conversations = results.filter((r) => r.unreadCount > 0);
    return res.status(200).json({ conversations, totalConversations: conversations.length, generatedAt: new Date().toISOString(), limits: AI_SUMMARY_LIMITS });
  } catch (err) {
    console.error("Error in catchUpSummaries:", err.message);
    return res.status(err.status || 500).json({ message: err.message || "Failed to generate catch-up summaries" });
  }
};
