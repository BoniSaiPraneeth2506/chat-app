import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { assetUrlsOf, destroyAssets } from "../lib/mediaCleanup.js";

// Simple scheduler that polls for due scheduled messages every 10 seconds.
// For production consider a job queue (BullMQ/Redis) instead.

const POLL_INTERVAL_MS = parseInt(process.env.SCHEDULE_POLL_INTERVAL_MS || "10000", 10);

let schedulerInterval = null;

export function startScheduler() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      const due = await Message.find({ scheduledStatus: "scheduled", scheduledAt: { $lte: now } }).limit(50);
      if (!due || due.length === 0) return;

      for (const msg of due) {
        try {
          // mark queued to avoid double processing
          msg.scheduledStatus = "queued";
          await msg.save();

          // deliver the message: for 1-on-1 use newMessage emit, for groups use newGroupMessage
          if (msg.groupId) {
            msg.scheduledStatus = "sent";
            await msg.save();
            io.to(`group_${msg.groupId.toString()}`).emit("newGroupMessage", msg);
          } else if (msg.receiverId) {
            msg.scheduledStatus = "sent";
            await msg.save();
            const receiverSocketId = getReceiverSocketId(msg.receiverId.toString());
            if (receiverSocketId) {
              io.to(receiverSocketId).emit("newMessage", msg);
            }
          }
        } catch (err) {
          console.error("Error delivering scheduled message", err);
          try {
            msg.scheduledStatus = "failed";
            await msg.save();
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, POLL_INTERVAL_MS);
}

export function stopScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = null;
}

// ── Disappearing-message media purge ─────────────────────────────────────────
//
// The `deleteAt` TTL index removes expired messages, but a TTL deletion fires
// no application hook — the document vanishes and its Cloudinary uploads are
// stranded with nothing left pointing at them. This sweep deletes expired
// messages ourselves, freeing their media first.
//
// It races Mongo's TTL monitor, which runs about once a minute; sweeping more
// often than that means we normally win. Anything the TTL reaches first is
// only a leaked asset, never a correctness problem.
const PURGE_INTERVAL_MS = parseInt(process.env.MEDIA_PURGE_INTERVAL_MS || "20000", 10);
const PURGE_BATCH = 200;

let purgeInterval = null;

export function startMediaPurge() {
  if (purgeInterval) return;
  purgeInterval = setInterval(async () => {
    try {
      const expired = await Message.find({ deleteAt: { $lte: new Date() } })
        .select("image images voice")
        .limit(PURGE_BATCH);

      if (expired.length === 0) return;

      const urls = expired.flatMap(assetUrlsOf);
      if (urls.length > 0) {
        const { destroyed, failed } = await destroyAssets(urls);
        console.log(`[MediaPurge] freed ${destroyed} asset(s), ${failed} failed`);
      }

      await Message.deleteMany({ _id: { $in: expired.map((m) => m._id) } });
    } catch (err) {
      console.error("Media purge error:", err.message);
    }
  }, PURGE_INTERVAL_MS);
}

export function stopMediaPurge() {
  if (purgeInterval) clearInterval(purgeInterval);
  purgeInterval = null;
}

export default { startScheduler, stopScheduler, startMediaPurge, stopMediaPurge };
