import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

const MODES = ["everyone", "contacts", "nobody"];
const CACHE_TTL_MS = 30_000;
const visibilityCache = new Map();
const contactCache = new Map();

const idOf = (value) => {
  if (!value) return "";
  if (value._id) return String(value._id);
  return String(value);
};

export const invalidateVisibilityCache = (userId) => {
  if (userId) visibilityCache.delete(idOf(userId));
  contactCache.clear();
};

const loadDocs = async (ids) => {
  const wanted = [...new Set((ids || []).map(idOf).filter(Boolean))];
  const now = Date.now();
  const missing = wanted.filter((id) => {
    const hit = visibilityCache.get(id);
    return !hit || now - hit.at >= CACHE_TTL_MS;
  });
  if (missing.length) {
    const docs = await User.find({ _id: { $in: missing } })
      .select("_id onlineVisibility photoVisibility onlinePrivacy")
      .lean();
    for (const id of missing) {
      visibilityCache.set(id, {
        at: now,
        doc: docs.find((d) => String(d._id) === id) || null,
      });
    }
  }
  return new Map(
    wanted.map((id) => [id, visibilityCache.get(id)?.doc || null])
  );
};

const modeFor = (doc, kind) => {
  if (kind === "online" && doc?.onlinePrivacy === false) return "nobody";
  const configured = kind === "online" ? doc?.onlineVisibility : doc?.photoVisibility;
  if (MODES.includes(configured)) return configured;
  return "everyone";
};

const areContacts = async (a, b) => {
  const first = idOf(a);
  const second = idOf(b);
  if (!first || !second) return false;
  if (first === second) return true;
  const key = [first, second].sort().join("|");
  const hit = contactCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    const [messaged, grouped] = await Promise.all([
      Message.exists({
        $or: [
          { senderId: first, receiverId: second },
          { senderId: second, receiverId: first },
        ],
      }),
      Group.exists({ "members.user": { $all: [first, second] } }),
    ]);
    const value = Boolean(messaged || grouped);
    contactCache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value || false;
  }
};

export const visibilityModeOf = async (userId, kind = "online") => {
  const id = idOf(userId);
  if (!id) return "everyone";
  const doc = (await loadDocs([id])).get(id);
  return modeFor(doc, kind);
};

export const canSeeOnline = async (target, viewerId, { doc } = {}) => {
  const targetId = idOf(target?._id || target);
  const viewer = idOf(viewerId);
  if (!targetId || !viewer) return false;
  if (targetId === viewer) return true;
  const loaded = doc || (await loadDocs([targetId])).get(targetId);
  const mode = modeFor(loaded, "online");
  if (mode === "everyone") return true;
  if (mode === "nobody") return false;
  return areContacts(targetId, viewer);
};

export const canSeePhoto = async (target, viewerId, { doc } = {}) => {
  const targetId = idOf(target?._id || target);
  const viewer = idOf(viewerId);
  if (!targetId || !viewer) return false;
  if (targetId === viewer) return true;
  const loaded = doc || (await loadDocs([targetId])).get(targetId);
  const mode = modeFor(loaded, "photo");
  if (mode === "everyone") return true;
  if (mode === "nobody") return false;
  return areContacts(targetId, viewer);
};

export const applyContactVisibility = async (users, viewerId) => {
  const list = (users || []).filter(Boolean);
  if (!list.length) return list;
  const docs = await loadDocs(list.map((u) => u._id));
  const viewer = idOf(viewerId);
  return list.map((u) => {
    const plain = u.toObject ? u.toObject() : { ...u };
    const id = idOf(plain._id);
    if (id !== viewer) {
      const doc = docs.get(id);
      if (!canSeeOnline(doc, viewer, { doc })) plain.lastSeen = null;
      if (!canSeePhoto(doc, viewer, { doc })) plain.profilePic = "";
    }
    return plain;
  });
};

export const redactGroupMemberVisibility = async (group, viewerId) => {
  if (!group?.members) return group;
  const docs = await loadDocs(group.members.map((m) => m.user?._id || m.user));
  const viewer = idOf(viewerId);
  for (const member of group.members) {
    const user = member.user;
    if (!user) continue;
    const id = idOf(user._id || user);
    if (id === viewer) continue;
    const doc = docs.get(id);
    if (!doc) continue;
    if (!canSeePhoto(doc, viewer, { doc })) {
      if (typeof user.set === "function") user.set("profilePic", "");
      else user.profilePic = "";
    }
    if (!canSeeOnline(doc, viewer, { doc })) {
      if (typeof user.set === "function") user.set("lastSeen", null);
      else user.lastSeen = null;
    }
  }
  return group;
};

export const applyMessageContactVisibility = async (messages, viewerId) => {
  const list = (messages || []).filter(Boolean);
  const ids = list
    .map((m) => m.contact?.user?._id || m.contact?.user)
    .filter(Boolean);
  if (!ids.length) return list;
  const docs = await loadDocs(ids);
  const viewer = idOf(viewerId);
  for (const message of list) {
    const id = idOf(message.contact?.user?._id || message.contact?.user);
    if (!id || id === viewer) continue;
    const doc = docs.get(id);
    if (doc && !canSeePhoto(doc, viewer, { doc })) {
      if (!message.contact) continue;
      if (typeof message.set === "function") message.set("contact.profilePic", "");
      else message.contact.profilePic = "";
    }
  }
  return list;
};

export const applyMessageSenderVisibility = async (messages, viewerId) => {
  const list = (messages || []).filter(Boolean);
  const ids = list
    .map((message) => message.senderId?._id || message.senderId)
    .filter(Boolean);
  if (!ids.length) return list;
  const docs = await loadDocs(ids);
  const viewer = idOf(viewerId);
  for (const message of list) {
    const sender = message.senderId;
    if (!sender) continue;
    const id = idOf(sender._id || sender);
    if (!id || id === viewer) continue;
    const doc = docs.get(id);
    if (!doc) continue;
    if (!canSeePhoto(doc, viewer, { doc })) {
      if (typeof sender.set === "function") sender.set("profilePic", "");
      else sender.profilePic = "";
    }
    if (!canSeeOnline(doc, viewer, { doc })) {
      if (typeof sender.set === "function") sender.set("lastSeen", null);
      else sender.lastSeen = null;
    }
  }
  return list;
};

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/:?#]/)[0];

const domainOfLink = (value) => {
  const withScheme = /^www\./i.test(value) ? `https://${value}` : value;
  try {
    return normalizeDomain(new URL(withScheme).hostname);
  } catch {
    return "";
  }
};

export const sanitizeModeration = (input, current = {}) => {
  const source = input && typeof input === "object" ? input : {};
  const blockedWords = Array.isArray(source.blockedWords)
    ? [...new Set(source.blockedWords.map((w) => String(w).trim().slice(0, 60)).filter(Boolean))].slice(0, 100)
    : current.blockedWords || [];
  const links = source.links && typeof source.links === "object" ? source.links : {};
  const mode = ["allow", "block", "allowedOnly"].includes(links.mode)
    ? links.mode
    : current.links?.mode || "allow";
  const allowedDomains = Array.isArray(links.allowedDomains)
    ? [...new Set(links.allowedDomains.map(normalizeDomain).filter(Boolean))].slice(0, 100)
    : current.links?.allowedDomains || [];
  return { blockedWords, links: { mode, allowedDomains } };
};

export const checkGroupTextModeration = (group, text) => {
  const value = String(text || "");
  const lower = value.toLowerCase();
  const words = (group?.moderation?.blockedWords || [])
    .map((word) => String(word).trim().toLowerCase())
    .filter(Boolean);
  if (words.some((word) => lower.includes(word))) {
    return { allowed: false, reason: "Message contains a blocked word" };
  }
  const mode = group?.moderation?.links?.mode || "allow";
  if (mode === "allow") return { allowed: true };
  const links = value.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (!links.length) return { allowed: true };
  if (mode === "block") {
    return { allowed: false, reason: "Links are not allowed in this group" };
  }
  const allowed = new Set((group?.moderation?.links?.allowedDomains || []).map(normalizeDomain).filter(Boolean));
  for (const link of links) {
    const domain = domainOfLink(link);
    if (!domain || (!allowed.has(domain) && ![...allowed].some((d) => domain.endsWith(`.${d}`)))) {
      return { allowed: false, reason: "This link's domain is not allowed in this group" };
    }
  }
  return { allowed: true };
};

export const canBypassModeration = (group, userId) =>
  (group?.members || []).some((member) => {
    const id = idOf(member.user?._id || member.user);
    return id === idOf(userId) && (member.role === "admin" || member.role === "moderator");
  });
