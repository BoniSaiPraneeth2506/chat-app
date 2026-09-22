import LiveLocation from "../models/liveLocation.model.js";
import { registerLiveShare, unregisterLiveShare, relayLiveLocationStopped } from "../lib/socket.js";

// Returns the active live-location share between the caller and `:sharerId`,
// if one exists and hasn't expired. Lets a recipient that just opened (or
// reconnected) a chat recover the sharer's latest point instead of relying
// only on socket frames it may have missed.
export const getActiveShare = async (req, res) => {
  try {
    const { sharerId } = req.params;
    const myId = req.user._id;

    const share = await LiveLocation.findOne({
      sharerId,
      recipientId: myId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .select("-__v")
      .lean();

    if (!share) {
      return res.status(404).json({ message: "No active live location" });
    }

    res.status(200).json(share);
  } catch (err) {
    console.error("Error in getActiveShare:", err.message);
    res.status(500).json({ message: "Failed to load live location" });
  }
};

// Stops an active live share that the caller started. Used when the sharer
// taps "Stop sharing" in the live map modal.
export const stopShare = async (req, res) => {
  try {
    const { messageId } = req.body;
    const myId = req.user._id;
    if (!messageId) {
      return res.status(400).json({ message: "messageId is required" });
    }

    const updated = await LiveLocation.findOneAndUpdate(
      { _id: messageId, sharerId: myId, isActive: true },
      { $set: { isActive: false } },
      { new: true }
    ).lean();

    if (updated) {
      unregisterLiveShare(updated._id);
      relayLiveLocationStopped(updated._id);
      // Also notify the sharer's own other devices.
      res.status(200).json({ message: "Live location stopped" });
    } else {
      res.status(404).json({ message: "Active share not found" });
    }
  } catch (err) {
    console.error("Error in stopShare:", err.message);
    res.status(500).json({ message: "Failed to stop live location" });
  }
};