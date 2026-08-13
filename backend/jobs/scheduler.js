import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

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

export default { startScheduler, stopScheduler };
