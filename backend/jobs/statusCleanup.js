import Status from "../models/status.model.js";
import { destroyObjects } from "../lib/mediaCleanup.js";

const CLEANUP_INTERVAL_MS = 30_000;
const CLEANUP_BATCH = 50;

let cleanupInterval = null;

export function startStatusCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(async () => {
    try {
      const now = new Date();

      const expired = await Status.find({
        expiresAt: { $lte: now },
        cleanupStatus: { $ne: "cleaned" },
      })
        .select("media.key cleanupStatus")
        .limit(CLEANUP_BATCH);

      if (expired.length === 0) return;

      for (const status of expired) {
        if (status.cleanupStatus === "active") {
          status.cleanupStatus = "pending";
          await status.save();
        }
      }

      const keys = expired
        .map((s) => s.media?.key)
        .filter((k) => typeof k === "string" && k.length > 0);

      if (keys.length > 0) {
        const result = await destroyObjects(keys);
        if (result.failed > 0) {
          console.error(
            `[StatusCleanup] ${result.failed}/${keys.length} B2 deletions failed — will retry`
          );
        }
      }

      const idsToDelete = expired.map((s) => s._id);
      await Status.deleteMany({ _id: { $in: idsToDelete } });

      if (expired.length > 0) {
        console.log(
          `[StatusCleanup] cleaned ${expired.length} expired status(es)`
        );
      }
    } catch (err) {
      console.error("[StatusCleanup] error:", err.message);
    }
  }, CLEANUP_INTERVAL_MS);
}

export function stopStatusCleanup() {
  if (cleanupInterval) clearInterval(cleanupInterval);
  cleanupInterval = null;
}

export default { startStatusCleanup, stopStatusCleanup };
