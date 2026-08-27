import DeviceToken from "../models/deviceToken.model.js";
import User from "../models/user.model.js";

// FCM device-token registration. Tokens are always bound to the authenticated
// user (req.user), so a user can only ever register/remove their own devices —
// there is no way to touch another account's tokens through these endpoints.

/**
 * POST /api/notifications/device-token
 * body: { token, deviceId? }
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const token = (req.body?.token || "").trim();
    const deviceId = (req.body?.deviceId || "").toString().slice(0, 200);

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    if (token.length > 4096) {
      return res.status(400).json({ message: "Invalid token" });
    }

    // Replace any prior token belonging to this exact registration, otherwise
    // repeated logins stack up stale duplicates.
    const filter = { token };
    const update = {
      $set: {
        userId,
        token,
        platform: "android",
        deviceId,
        lastUsed: new Date(),
      },
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    let doc;
    try {
      doc = await DeviceToken.findOneAndUpdate(filter, update, options);
    } catch (err) {
      if (err && err.code === 11000) {
        // Unique-index race: another concurrent request landed first. Treat it
        // as already-registered for this user.
        return res.status(200).json({ success: true });
      }
      throw err;
    }

    // Now make sure a duplicate for the same user+device doesn't accumulate.
    if (deviceId) {
      await DeviceToken.deleteMany({
        userId,
        deviceId,
        _id: { $ne: doc?._id },
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error registering device token:", error);
    res.status(500).json({ message: "Failed to register device token" });
  }
};

/**
 * DELETE /api/notifications/device-token/:token
 * Removes a token belonging to the current user (used on logout).
 */
export const removeDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const token = decodeURIComponent((req.params?.token || "").trim());
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    // Only ever delete this user's own token.
    const result = await DeviceToken.deleteOne({ token, userId });
    res.status(200).json({ success: true, removed: result.deletedCount > 0 });
  } catch (error) {
    console.error("Error removing device token:", error);
    res.status(500).json({ message: "Failed to remove device token" });
  }
};

/**
 * GET /api/notifications/device-tokens
 * Lists the current user's registered devices (their own tokens).
 */
export const listDeviceTokens = async (req, res) => {
  try {
    const userId = req.user._id;
    const tokens = await DeviceToken.find({ userId })
      .select("token platform deviceId lastUsed createdAt")
      .sort({ lastUsed: -1 })
      .lean();
    res.status(200).json(tokens);
  } catch (error) {
    console.error("Error listing device tokens:", error);
    res.status(500).json({ message: "Failed to list device tokens" });
  }
};

// ── Mute / notification preference toggles ─────────────────────────────────────

/**
 * PUT /api/notifications/mute/:conversationType/:id
 * body: { muted: boolean }
 * conversationType: "chat" | "group"
 * id: the other user's id (chat) or the group id (group).
 */
export const setConversationMute = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationType, id } = req.params;
    const muted = Boolean(req.body?.muted);

    if (!["chat", "group"].includes(conversationType)) {
      return res.status(400).json({ message: "Invalid conversation type" });
    }
    if (!id) return res.status(400).json({ message: "Missing conversation id" });

    const key = conversationType === "chat" ? "mutedChats" : "mutedGroups";
    await User.updateOne({ _id: userId }, { $set: { [`${key}.${id}`]: muted } });

    res.status(200).json({ success: true, [conversationType]: id, muted });
  } catch (error) {
    console.error("Error setting conversation mute:", error);
    res.status(500).json({ message: "Failed to update mute" });
  }
};

/**
 * PUT /api/notifications/preferences
 * body: { pushEnabled: boolean }
 */
export const setNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const pushEnabled = Boolean(req.body?.pushEnabled);

    await User.updateOne(
      { _id: userId },
      { $set: { "notificationPrefs.pushEnabled": pushEnabled } }
    );

    res.status(200).json({ success: true, pushEnabled });
  } catch (error) {
    console.error("Error setting notification preferences:", error);
    res.status(500).json({ message: "Failed to update notification preferences" });
  }
};
