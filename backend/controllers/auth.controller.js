import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from 'bcryptjs'
import cloudinary from "../lib/cloudinary.js";
import { updateUserPrivacyState, updateTypingPrivacyState, disconnectRevokedSessions } from "../lib/socket.js";
import { sendPasswordResetOtp } from "../lib/mailer.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import { assetUrlsOf, destroyAssets } from "../lib/mediaCleanup.js";
import { buildSession } from "../lib/deviceInfo.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Reads JWT claims from the cookie or Authorization header without throwing. */
const readTokenClaims = (req) => {
    // Header before cookie, matching protectRoute — with saved accounts the
    // httpOnly cookie can belong to a different account than the bearer token
    // the client is actually using, and logout must end the right session.
    const header = req.headers.authorization;
    const token =
        (header?.startsWith("Bearer ") ? header.split(" ")[1] : null) || req.cookies?.jwt || null;
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
};

/** Records a new device session on the user and returns a JWT bound to it. */
const startSession = async (user, req, res) => {
    const session = buildSession(req, crypto.randomUUID());
    await User.updateOne({ _id: user._id }, { $push: { sessions: session } });
    return generateToken(user._id, res, session.sid);
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The only social platforms accepted on a profile — anything else is dropped. */
const SOCIAL_LINK_KEYS = ["github", "twitter", "linkedin", "youtube", "portfolio"];
const MAX_SOCIAL_LINK_LENGTH = 300;

/**
 * Normalizes one user-supplied social URL, or returns "" to clear it.
 * Every value is rendered client-side as an <a href>, so anything that isn't
 * plainly http(s) (`javascript:`, `data:`, ...) is rejected outright rather
 * than escaped — a profile link has no legitimate reason to use those.
 */
const sanitizeSocialLink = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_SOCIAL_LINK_LENGTH) return "";
  // Bare inputs like "github.com/me" are a normal thing to type, so give
  // them a scheme before parsing instead of rejecting them.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname.includes(".")) return "";
    return url.toString();
  } catch {
    return "";
  }
};

/** Builds the full 5-key social links object from arbitrary request input. */
const sanitizeSocialLinks = (input) => {
  const source = input && typeof input === "object" ? input : {};
  return SOCIAL_LINK_KEYS.reduce((acc, key) => {
    acc[key] = sanitizeSocialLink(source[key]);
    return acc;
  }, {});
};

/**
 * Always hands the client all 5 keys, even for profiles saved before the
 * field existed, so the UI never has to null-check individual platforms.
 */
const normalizeSocialLinksForResponse = (socialLinks) => {
  const source = socialLinks?.toObject ? socialLinks.toObject() : (socialLinks || {});
  return SOCIAL_LINK_KEYS.reduce((acc, key) => {
    acc[key] = typeof source[key] === "string" ? source[key] : "";
    return acc;
  }, {});
};

/** Mongoose Map (or a lean plain object) to a plain object, always. */
const mapToObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return typeof value === "object" ? { ...value } : {};
};

/**
 * Returns a safe, whitelisted subset of a user object for API responses.
 * Prevents internal/sensitive fields from leaking to the client.
 */
const sanitizeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  profilePic: user.profilePic,
  bannerPic: user.bannerPic,
  bio: user.bio,
  link: user.link,
  socialLinks: normalizeSocialLinksForResponse(user.socialLinks),
  // Sent as a plain object so the client can index it directly. Only ever
  // returned for the signed-in user — never for the contacts they list.
  contactNicknames: mapToObject(user.contactNicknames),
  onlinePrivacy: user.onlinePrivacy,
  typingPrivacy: user.typingPrivacy !== false,
  blockedUsers: user.blockedUsers || [],
  favorites: user.favorites || [],
  archived: user.archived || [],
  pinnedChats: user.pinnedChats || [],
  lastSeen: user.lastSeen,
  messageTimer: user.messageTimer,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/** Validate that a base64 data URI is an allowed image type and within size limit */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_BYTES = 8_000_000; // ~8 MB base64 string ≈ ~6 MB actual file

const validateImageUpload = (dataUri) => {
  if (!dataUri.startsWith("data:")) return { valid: false, reason: "Invalid file format" };
  const mime = dataUri.split(";")[0].split(":")[1];
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    return { valid: false, reason: "Only JPEG, PNG, GIF, and WebP images are allowed" };
  }
  if (dataUri.length > MAX_FILE_BYTES) {
    return { valid: false, reason: "File size exceeds 6 MB limit" };
  }
  return { valid: true };
};

// ── Controllers ───────────────────────────────────────────────────────────────

const signup = async (req, res) => {
    const { fullName, email, password } = req.body;

    try {
        if (!password || !fullName || !email) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        const token = await startSession(newUser, req, res);

        res.status(201).json({
            ...sanitizeUser(newUser),
            token,
        });

    } catch (err) {
        console.error("Error in signup:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    // Provide specific feedback: email not found vs incorrect password
    // NOTE: this reveals which emails are registered — acceptable for this request.

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Email not found" });
        }

        if (!user.password) {
            return res.status(401).json({ message: "This account uses Google Sign-In. Continue with Google instead." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        const token = await startSession(user, req, res);

        res.status(200).json({
            ...sanitizeUser(user),
            token,
        });

    } catch (err) {
        console.error("Error in login:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const googleAuth = async (req, res) => {
    const { idToken } = req.body;

    try {
        if (!idToken) {
            return res.status(400).json({ message: "Missing Google ID token" });
        }

        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } catch (verifyErr) {
            console.error("Error verifying Google ID token:", verifyErr.message);
            return res.status(401).json({ message: "Invalid Google sign-in" });
        }

        if (!payload?.email_verified) {
            return res.status(401).json({ message: "Google account email is not verified" });
        }

        let user = await User.findOne({ googleId: payload.sub });

        if (!user) {
            // Google has already verified this email, so an existing password
            // account with the same address is safe to link automatically.
            // A targeted update (not a full-document .save()) avoids
            // re-validating unrelated fields on accounts that predate a
            // schema change, e.g. old seed data missing fullName.
            user = await User.findOne({ email: payload.email });
            if (user) {
                await User.updateOne({ _id: user._id }, { $set: { googleId: payload.sub } });
                user.googleId = payload.sub;
            }
        }

        if (!user) {
            const fallbackName =
                payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(" ") || payload.email?.split("@")[0] || "Google User";
            user = new User({
                fullName: fallbackName,
                email: payload.email,
                googleId: payload.sub,
                profilePic: payload.picture || "",
            });
            await user.save();
        }

        const token = await startSession(user, req, res);

        res.status(200).json({
            ...sanitizeUser(user),
            token,
        });
    } catch (err) {
        console.error("Error in googleAuth:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const logout = async (req, res) => {
    try {
        // The route is public, so the session is resolved from the token when present.
        const claims = readTokenClaims(req);
        if (claims?.userId && claims?.sid) {
            await User.updateOne({ _id: claims.userId }, { $pull: { sessions: { sid: claims.sid } } });
        }
        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error("Error in logout:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { profilePic, bannerPic, fullName, email, bio, link, socialLinks, onlinePrivacy, typingPrivacy, messageTimer } = req.body;
        const userId = req.user._id;

        const updateData = {};

        if (fullName) updateData.fullName = fullName;

        if (email) {
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser._id.toString() !== userId.toString()) {
                return res.status(400).json({ message: "Email is already taken" });
            }
            updateData.email = email;
        }

        if (bio !== undefined) updateData.bio = bio;
        if (link !== undefined) updateData.link = link;

        if (socialLinks !== undefined) updateData.socialLinks = sanitizeSocialLinks(socialLinks);

        if (typingPrivacy !== undefined) {
            updateData.typingPrivacy = Boolean(typingPrivacy);
            updateTypingPrivacyState(userId, typingPrivacy === false);
        }
        if (onlinePrivacy !== undefined) {
            updateData.onlinePrivacy = onlinePrivacy;
            updateUserPrivacyState(userId, onlinePrivacy === false);
        }

        if (messageTimer !== undefined) updateData.messageTimer = messageTimer;

        if (profilePic) {
            // Validate file type and size before uploading
            const validation = validateImageUpload(profilePic);
            if (!validation.valid) {
                return res.status(400).json({ message: validation.reason });
            }
            const uploadResponse = await cloudinary.uploader.upload(profilePic);
            updateData.profilePic = uploadResponse.secure_url;
        }

        // Unlike profilePic, an empty string is meaningful here: it's how the
        // client removes a cover photo it previously set.
        if (bannerPic !== undefined) {
            if (!bannerPic) {
                updateData.bannerPic = "";
            } else if (bannerPic.startsWith("data:")) {
                const validation = validateImageUpload(bannerPic);
                if (!validation.valid) {
                    return res.status(400).json({ message: validation.reason });
                }
                const uploadResponse = await cloudinary.uploader.upload(bannerPic);
                updateData.bannerPic = uploadResponse.secure_url;
            }
            // An already-hosted URL resent unchanged needs no re-upload.
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        );

        // Return only whitelisted fields
        res.status(200).json(sanitizeUser(updatedUser));

    } catch (error) {
        console.error("Error in updateProfile:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Permanently deletes the signed-in account.
 *
 * Requires the current password (or explicit typed confirmation for
 * Google-only accounts, which have none) because this is irreversible and a
 * stolen session should not be enough to destroy someone's history.
 *
 * Messages *sent* by this user are removed along with their uploads. Messages
 * they only received are left alone — those belong to the other person's
 * conversation, and deleting one account should not silently gut someone
 * else's chat history.
 */
const deleteAccount = async (req, res) => {
    try {
        const { password, confirm } = req.body || {};
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "Account not found" });

        if (user.password) {
            if (!password) return res.status(400).json({ message: "Enter your password to confirm" });
            const ok = await bcrypt.compare(password, user.password);
            if (!ok) return res.status(400).json({ message: "Incorrect password" });
        } else if (String(confirm || "").trim().toUpperCase() !== "DELETE") {
            // Google-only accounts have no password to check against.
            return res.status(400).json({ message: 'Type DELETE to confirm' });
        }

        // Free the storage this user's own messages hold before dropping them.
        const sent = await Message.find({ senderId: userId }).select("image images voice");
        if (sent.length > 0) {
            await destroyAssets(sent.flatMap(assetUrlsOf));
            await Message.deleteMany({ senderId: userId });
        }

        // Leave every group. A group left with no members at all is removed;
        // otherwise the remaining members keep it.
        const groups = await Group.find({ "members.user": userId });
        for (const group of groups) {
            group.members = group.members.filter(
                (m) => (m.user?._id || m.user).toString() !== userId.toString()
            );
            if (group.members.length === 0) await Group.deleteOne({ _id: group._id });
            else await group.save();
        }

        // Stop appearing in anyone else's blocked list or nicknames.
        await User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } });
        await User.updateMany({}, { $unset: { [`contactNicknames.${userId}`]: "" } });

        await User.deleteOne({ _id: userId });

        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({ deleted: true });
    } catch (error) {
        console.error("Error in deleteAccount:", error.message);
        res.status(500).json({ message: "Could not delete the account" });
    }
};

const checkAuth = (req, res) => {
    try {
        // Return only whitelisted fields — never expose full DB document
        res.status(200).json(sanitizeUser(req.user));
    } catch (err) {
        console.error("Error in checkAuth:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const GENERIC_RESET_MESSAGE =
    "If an account exists with that email, a reset code has been sent.";

const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json({ message: GENERIC_RESET_MESSAGE });
        }

        const otp = String(crypto.randomInt(100000, 1000000));
        user.resetPasswordOtp = hashOtp(otp);
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        let emailSent = false;
        try {
            const result = await sendPasswordResetOtp(user.email, otp);
            emailSent = Boolean(result?.sent);
        } catch (mailErr) {
            console.error("Error sending reset email:", mailErr.message);
            user.resetPasswordOtp = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(500).json({ message: "Could not send reset code. Please try again." });
        }

        const payload = { message: GENERIC_RESET_MESSAGE };
        if (!emailSent && process.env.NODE_ENV !== "production") {
            payload.devOtp = otp;
        }

        res.status(200).json(payload);
    } catch (err) {
        console.error("Error in forgotPassword:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "Email, code, and new password are required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const user = await User.findOne({
            email,
            resetPasswordOtp: { $exists: true, $ne: null },
            resetPasswordExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset code" });
        }

        const incomingHash = hashOtp(otp);
        const storedHash = user.resetPasswordOtp;
        if (
            storedHash.length !== incomingHash.length ||
            !crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(incomingHash))
        ) {
            return res.status(400).json({ message: "Invalid or expired reset code" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await User.updateOne(
            { _id: user._id },
            {
                $set: { password: hashedPassword },
                $unset: { resetPasswordOtp: 1, resetPasswordExpires: 1 },
            }
        );

        res.status(200).json({ message: "Password reset successfully. You can now sign in." });
    } catch (err) {
        console.error("Error in resetPassword:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ── Active sessions / device manager ──────────────────────────────────────────

const getSessions = async (req, res) => {
    try {
        const sessions = (req.user.sessions || [])
            .map((s) => ({
                sid: s.sid,
                ip: s.ip,
                browser: s.browser,
                os: s.os,
                device: s.device,
                createdAt: s.createdAt,
                lastActive: s.lastActive,
                isCurrent: s.sid === req.sessionId,
            }))
            .sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

        res.status(200).json(sessions);
    } catch (err) {
        console.error("Error in getSessions:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const revokeSession = async (req, res) => {
    try {
        const { sid } = req.params;
        if (sid === req.sessionId) {
            return res.status(400).json({ message: "Use logout to end the current session" });
        }

        const result = await User.updateOne({ _id: req.user._id }, { $pull: { sessions: { sid } } });
        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "Session not found" });
        }

        disconnectRevokedSessions(req.user._id, (socketSid) => socketSid === sid);

        res.status(200).json({ message: "Session logged out" });
    } catch (err) {
        console.error("Error in revokeSession:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const revokeOtherSessions = async (req, res) => {
    try {
        if (!req.sessionId) {
            return res.status(400).json({ message: "Sign in again to manage your sessions" });
        }

        const kept = (req.user.sessions || []).filter((s) => s.sid === req.sessionId);
        const removed = (req.user.sessions || []).length - kept.length;
        await User.updateOne({ _id: req.user._id }, { $set: { sessions: kept } });

        disconnectRevokedSessions(req.user._id, (socketSid) => socketSid !== req.sessionId);

        res.status(200).json({ message: `Logged out ${removed} other session${removed === 1 ? "" : "s"}`, removed });
    } catch (err) {
        console.error("Error in revokeOtherSessions:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export { signup, login, logout, googleAuth, updateProfile, checkAuth, deleteAccount, forgotPassword, resetPassword, getSessions, revokeSession, revokeOtherSessions };