import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from 'bcryptjs'
import cloudinary from "../lib/cloudinary.js";
import { updateUserPrivacyState } from "../lib/socket.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a safe, whitelisted subset of a user object for API responses.
 * Prevents internal/sensitive fields from leaking to the client.
 */
const sanitizeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  profilePic: user.profilePic,
  bio: user.bio,
  link: user.link,
  onlinePrivacy: user.onlinePrivacy,
  blockedUsers: user.blockedUsers || [],
  favorites: user.favorites || [],
  archived: user.archived || [],
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

        const token = generateToken(newUser._id, res);

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
    // Generic message for both "user not found" and "wrong password"
    // prevents user-enumeration attacks
    const INVALID_MSG = "Invalid email or password";

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: INVALID_MSG });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: INVALID_MSG });
        }

        const token = generateToken(user._id, res);

        res.status(200).json({
            ...sanitizeUser(user),
            token,
        });

    } catch (err) {
        console.error("Error in login:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const logout = async (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error("Error in logout:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { profilePic, fullName, email, bio, link, onlinePrivacy, messageTimer } = req.body;
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

const checkAuth = (req, res) => {
    try {
        // Return only whitelisted fields — never expose full DB document
        res.status(200).json(sanitizeUser(req.user));
    } catch (err) {
        console.error("Error in checkAuth:", err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export { signup, login, logout, updateProfile, checkAuth };