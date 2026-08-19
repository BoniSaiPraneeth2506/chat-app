import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { hideAnonymousAuthor } from "../lib/anonymity.js";
import { assetUrlsOf, destroyAssets, attachmentKeysOf, destroyObjects } from "../lib/mediaCleanup.js";

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
            // Group sends cannot be scheduled today, but this path would deliver
            // one if they ever are — and an unsanitised emit here would unmask
            // an anonymous question to the whole room.
            io.to(`group_${msg.groupId.toString()}`).emit("newGroupMessage", hideAnonymousAuthor(msg));
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
// A TTL deletion fires no application hook — the document just vanishes, and its
// Cloudinary uploads are stranded with nothing left pointing at them. So expired
// messages are deleted here instead, media first.
//
// This used to race Mongo's TTL monitor and lose sometimes. The index now carries
// a grace period (see the model), which puts this sweep firmly ahead of it: the
// TTL is only the backstop for a sweep that is not running.
const PURGE_INTERVAL_MS = parseInt(process.env.MEDIA_PURGE_INTERVAL_MS || "20000", 10);
const PURGE_BATCH = 200;

let purgeInterval = null;

export function startMediaPurge() {
  if (purgeInterval) return;
  purgeInterval = setInterval(async () => {
    try {
      const expired = await Message.find({ deleteAt: { $lte: new Date() } })
        .select("image images voice attachments")
        .limit(PURGE_BATCH);

      if (expired.length === 0) return;

      const urls = expired.flatMap(assetUrlsOf);
      const keys = expired.flatMap(attachmentKeysOf);
      if (urls.length > 0 || keys.length > 0) {
        const [cloud, bucket] = await Promise.all([
          destroyAssets(urls),
          destroyObjects(keys),
        ]);
        const destroyed = cloud.destroyed + bucket.destroyed;
        const failed = cloud.failed + bucket.failed;
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
