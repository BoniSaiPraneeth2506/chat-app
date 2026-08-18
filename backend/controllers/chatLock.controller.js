import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import { SIDEBAR_USER_FIELDS, attachUnreadCounts } from "./message.controller.js";
import { emitAccountLists } from "../lib/socket.js";

// ── Chat lock ────────────────────────────────────────────────────────────────
//
// A second secret, separate from the account password, guarding specific
// conversations. Separate on purpose: the threat is someone holding the unlocked
// phone, and a lock that opens with the login password would not help there.
//
// Every check happens on the server. A client-side comparison would be trivially
// bypassed by editing state, and the locked conversations are also withheld from
// the sidebar payload, so an unpatched client cannot simply render what it was
// never sent.

const MIN_LOCK_PASSWORD = 4;
const MAX_LOCK_PASSWORD = 64;
const MAX_QUESTION = 140;

/** Answers are compared case- and space-insensitively; people do not retype exactly. */
const normalizeAnswer = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const lockStatus = (user) => ({
  enabled: Boolean(user.chatLock?.enabled),
  securityQuestion: user.chatLock?.securityQuestion || "",
  lockedChats: (user.lockedChats || []).map(String),
  lockedGroups: (user.lockedGroups || []).map(String),
});

/** Enables the lock and stores the recovery question. */
const setupChatLock = async (req, res) => {
  try {
    const { password, securityQuestion, securityAnswer } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.chatLock?.enabled) {
      return res.status(400).json({ message: "Chat lock is already set up" });
    }
    if (!password || String(password).length < MIN_LOCK_PASSWORD) {
      return res.status(400).json({ message: `Password must be at least ${MIN_LOCK_PASSWORD} characters` });
    }
    if (String(password).length > MAX_LOCK_PASSWORD) {
      return res.status(400).json({ message: "Password is too long" });
    }
    // The question is required at setup rather than offered later, because the
    // moment it is actually needed is the moment the user cannot get in to add it.
    if (!securityQuestion?.trim() || !securityAnswer?.trim()) {
      return res.status(400).json({ message: "A security question and answer are required" });
    }

    const salt = await bcrypt.genSalt(10);
    const chatLock = {
      enabled: true,
      passwordHash: await bcrypt.hash(String(password), salt),
      securityQuestion: securityQuestion.trim().slice(0, MAX_QUESTION),
      securityAnswerHash: await bcrypt.hash(normalizeAnswer(securityAnswer), salt),
      updatedAt: new Date(),
    };
    const saved = await User.findByIdAndUpdate(user._id, { $set: { chatLock } }, { new: true });

    emitAccountLists(user._id, lockStatus(saved));
    res.status(200).json(lockStatus(saved));
  } catch (error) {
    console.error("Error in setupChatLock:", error);
    res.status(500).json({ message: "Failed to set up chat lock" });
  }
};

/**
 * Verifies the password and returns the locked conversations.
 *
 * The list only exists in this response. Nothing else exposes it, so a client
 * that has not passed the password has nothing to display.
 */
const unlockChats = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user?.chatLock?.enabled) {
      return res.status(400).json({ message: "Chat lock is not set up" });
    }

    const ok = await bcrypt.compare(String(password || ""), user.chatLock.passwordHash);
    if (!ok) return res.status(401).json({ message: "Wrong password" });

    const [users, groups] = await Promise.all([
      User.find({ _id: { $in: user.lockedChats || [] } }).select(SIDEBAR_USER_FIELDS).lean(),
      Group.find({ _id: { $in: user.lockedGroups || [] }, "members.user": user._id })
        .select("name groupPic members")
        .lean(),
    ]);

    res.status(200).json({
      users: await attachUnreadCounts(users, user),
      groups: groups.map((g) => ({ ...g, memberCount: g.members?.length || 0, members: undefined })),
    });
  } catch (error) {
    console.error("Error in unlockChats:", error);
    res.status(500).json({ message: "Failed to unlock" });
  }
};

/** Changes the lock password. The current one is required. */
const changeChatLockPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user?.chatLock?.enabled) {
      return res.status(400).json({ message: "Chat lock is not set up" });
    }

    const ok = await bcrypt.compare(String(currentPassword || ""), user.chatLock.passwordHash);
    if (!ok) return res.status(401).json({ message: "Current password is wrong" });

    if (!newPassword || String(newPassword).length < MIN_LOCK_PASSWORD) {
      return res.status(400).json({ message: `Password must be at least ${MIN_LOCK_PASSWORD} characters` });
    }

    const salt = await bcrypt.genSalt(10);
    await User.updateOne(
      { _id: user._id },
      { $set: { "chatLock.passwordHash": await bcrypt.hash(String(newPassword), salt), "chatLock.updatedAt": new Date() } }
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error in changeChatLockPassword:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
};

/**
 * Resets the password using the security answer.
 *
 * The question is returned by the status endpoint so the client can show it; the
 * answer is only ever compared here, never sent out.
 */
const recoverChatLock = async (req, res) => {
  try {
    const { securityAnswer, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user?.chatLock?.enabled) {
      return res.status(400).json({ message: "Chat lock is not set up" });
    }
    if (!user.chatLock.securityAnswerHash) {
      return res.status(400).json({ message: "No security question is set for this account" });
    }

    const ok = await bcrypt.compare(normalizeAnswer(securityAnswer), user.chatLock.securityAnswerHash);
    if (!ok) return res.status(401).json({ message: "That answer does not match" });

    if (!newPassword || String(newPassword).length < MIN_LOCK_PASSWORD) {
      return res.status(400).json({ message: `Password must be at least ${MIN_LOCK_PASSWORD} characters` });
    }

    const salt = await bcrypt.genSalt(10);
    await User.updateOne(
      { _id: user._id },
      { $set: { "chatLock.passwordHash": await bcrypt.hash(String(newPassword), salt), "chatLock.updatedAt": new Date() } }
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error in recoverChatLock:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};

/**
 * Turns the lock off.
 *
 * The password is required, and every conversation is released — leaving chats
 * marked as locked with no lock to open them would strand them out of the
 * sidebar with no way back.
 */
const disableChatLock = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    if (!user?.chatLock?.enabled) {
      return res.status(400).json({ message: "Chat lock is not set up" });
    }

    const ok = await bcrypt.compare(String(password || ""), user.chatLock.passwordHash);
    if (!ok) return res.status(401).json({ message: "Wrong password" });

    const saved = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          chatLock: {
            enabled: false,
            passwordHash: "",
            securityQuestion: "",
            securityAnswerHash: "",
            updatedAt: new Date(),
          },
          lockedChats: [],
          lockedGroups: [],
        },
      },
      { new: true }
    );

    emitAccountLists(user._id, lockStatus(saved));
    res.status(200).json(lockStatus(saved));
  } catch (error) {
    console.error("Error in disableChatLock:", error);
    res.status(500).json({ message: "Failed to disable chat lock" });
  }
};

/** Locks or unlocks one conversation. */
const toggleChatLocked = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // "user" | "group"
    const user = await User.findById(req.user._id);
    if (!user?.chatLock?.enabled) {
      return res.status(400).json({ message: "Set up chat lock first" });
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }
    if (id === user._id.toString()) {
      return res.status(400).json({ message: "Personal Notes cannot be locked" });
    }

    const list = type === "group" ? "lockedGroups" : "lockedChats";
    const current = (user[list] || []).map(String);
    const isLocked = current.includes(id);

    const saved = await User.findByIdAndUpdate(
      user._id,
      isLocked ? { $pull: { [list]: id } } : { $addToSet: { [list]: id } },
      { new: true }
    );

    emitAccountLists(user._id, lockStatus(saved));
    res.status(200).json({ ...lockStatus(saved), locked: !isLocked });
  } catch (error) {
    console.error("Error in toggleChatLocked:", error);
    res.status(500).json({ message: "Failed to update chat lock" });
  }
};

/** Status for the settings screen and the unlock prompt. Never returns a hash. */
const getChatLockStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "chatLock.enabled chatLock.securityQuestion lockedChats lockedGroups"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(lockStatus(user));
  } catch (error) {
    console.error("Error in getChatLockStatus:", error);
    res.status(500).json({ message: "Failed to read chat lock status" });
  }
};

export {
  setupChatLock,
  unlockChats,
  changeChatLockPassword,
  recoverChatLock,
  disableChatLock,
  toggleChatLocked,
  getChatLockStatus,
};
