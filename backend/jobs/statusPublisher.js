// Publishing statuses that were scheduled for later.
//
// A scheduled status is written to the database with statusState "scheduled",
// which every read path already excludes — so it cannot leak early through the
// list, a direct fetch, or a media URL. This job is the only thing that flips
// it to "active", which is why scheduling is a server concern rather than a
// timer on the author's phone.
import Status from "../models/status.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { signStatusMedia } from "../lib/statusMedia.js";
import { resolveAuthorizedViewerIds, getBlockedIds } from "../lib/statusPrivacy.js";

const PUBLISH_INTERVAL_MS = 15_000;
const PUBLISH_BATCH = 50;

let publishInterval = null;

const payloadFor = (status) => ({
  _id: status._id,
  type: status.type,
  user: {
    _id: status.user._id,
    fullName: status.user.fullName,
    profilePic: status.user.profilePic,
  },
  media: status.media || null,
  mediaItems: status.mediaItems || [],
  caption: status.caption || "",
  text: status.text,
  voice: status.voice,
  music: status.music,
  poll: status.poll,
  question: status.question,
  link: status.link,
  location: status.location,
  countdown: status.countdown,
  createdAt: status.createdAt,
  expiresAt: status.expiresAt,
});

export function startStatusPublisher() {
  if (publishInterval) return;
  publishInterval = setInterval(async () => {
    try {
      const now = new Date();

      const due = await Status.find({
        statusState: "scheduled",
        scheduledFor: { $lte: now },
        expiresAt: { $gt: now },
      })
        .populate("user", "fullName profilePic")
        .limit(PUBLISH_BATCH)
        .lean();

      if (due.length === 0) return;

      for (const status of due) {
        // The 24h window starts when the status actually goes out, not when it
        // was composed — a post scheduled for tomorrow should live a full day.
        const published = await Status.findByIdAndUpdate(
          status._id,
          {
            $set: {
              statusState: "active",
              createdAt: now,
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          { new: true }
        )
          .populate("user", "fullName profilePic")
          .lean();

        if (!published) continue;

        await signStatusMedia(published);

        const viewerIds = await resolveAuthorizedViewerIds(published);
        const blocked = await getBlockedIds((published.user?._id || published.user).toString());
        const payload = payloadFor(published);

        for (const viewerId of viewerIds) {
          if (blocked.includes(viewerId)) continue;
          const socketId = getReceiverSocketId(viewerId);
          if (socketId) io.to(socketId).emit("status:new", payload);
        }

        console.log(`[StatusPublisher] published ${published._id}`);
      }
    } catch (err) {
      console.error("[StatusPublisher] error:", err.message);
    }
  }, PUBLISH_INTERVAL_MS);
}

export function stopStatusPublisher() {
  if (publishInterval) clearInterval(publishInterval);
  publishInterval = null;
}

export default { startStatusPublisher, stopStatusPublisher };
