import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import { destroyObjects } from "../lib/mediaCleanup.js";
import { statusMediaKeys } from "../lib/statusMedia.js";

const CLEANUP_INTERVAL_MS = 30_000;
const CLEANUP_BATCH = 50;

// How many sweeps a status's media gets before the deletion is abandoned. Six
// half-minute sweeps is three minutes of retrying, which covers a bucket
// restart or a credential blip without letting one bad key stall the queue.
const MAX_DELETE_ATTEMPTS = 6;

let cleanupInterval = null;

/**
 * The owners who asked for expired statuses to be kept.
 *
 * Collected once per sweep so a batch of fifty statuses belonging to three
 * people costs three lookups rather than fifty.
 */
const ownersKeepingArchive = async (statuses) => {
  const ownerIds = [
    ...new Set(
      statuses
        .map((s) => (s.user?._id || s.user)?.toString())
        .filter(Boolean)
    ),
  ];
  if (ownerIds.length === 0) return new Set();

  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("statusSettings")
    .lean();

  return new Set(
    owners
      .filter((o) => o.statusSettings?.keepArchived)
      .map((o) => o._id.toString())
  );
};

export function startStatusCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(async () => {
    try {
      const now = new Date();

      const expired = await Status.find({
        expiresAt: { $lte: now },
        cleanupStatus: { $ne: "cleaned" },
        isArchived: false,
      })
        .select(
          "user media mediaItems voice music text link cleanupStatus cleanupAttempts"
        )
        .limit(CLEANUP_BATCH);

      if (expired.length === 0) return;

      // A status whose owner turned archiving on is marked and left alone —
      // media included, because an archive nobody can open is not an archive.
      // The rows stay owner-only: no read path outside the owner's own archive
      // endpoint returns an isArchived status.
      const keep = await ownersKeepingArchive(expired);
      const toArchive = expired.filter(
        (s) => keep.has((s.user?._id || s.user)?.toString())
      );
      if (toArchive.length > 0) {
        await Status.updateMany(
          { _id: { $in: toArchive.map((s) => s._id) } },
          { $set: { isArchived: true, cleanupStatus: "cleaned" } }
        );
        console.log(`[StatusCleanup] archived ${toArchive.length} expired status(es)`);
      }

      const toDelete = expired.filter(
        (s) => !keep.has((s.user?._id || s.user)?.toString())
      );
      if (toDelete.length === 0) return;

      // Marked pending before the delete rather than after, so a crash in the
      // middle of the bucket call leaves a row that the next sweep picks up
      // again instead of one that looks untouched.
      await Status.updateMany(
        {
          _id: { $in: toDelete.map((s) => s._id) },
          cleanupStatus: "active",
        },
        { $set: { cleanupStatus: "pending" } }
      );

      // Every media slot a status can hold, not just its primary photo — a text
      // status's background or a voice clip is just as much the owner's file.
      const keys = [...new Set(toDelete.flatMap((s) => statusMediaKeys(s)))].filter(
        (k) => typeof k === "string" && k.length > 0
      );

      let deletionFailed = false;
      if (keys.length > 0) {
        const result = await destroyObjects(keys);
        deletionFailed = result.failed > 0;
        if (deletionFailed) {
          console.error(
            `[StatusCleanup] ${result.failed}/${keys.length} B2 deletions failed — will retry`
          );
        }
      }

      // The row is only dropped once its bytes are gone. Deleting the document
      // after a failed delete would turn a transient network or auth blip into
      // a permanently orphaned object in the bucket with nothing left pointing
      // at it, which is exactly the state nobody can ever clean up.
      //
      // Retrying is bounded, though: a key that fails MAX_DELETE_ATTEMPTS times
      // is abandoned with a log line. An orphan in the bucket is a far smaller
      // problem than a sweep that stops draining.
      const exhausted = toDelete.filter((s) => (s.cleanupAttempts || 0) + 1 >= MAX_DELETE_ATTEMPTS);
      const retryable = toDelete.filter((s) => !exhausted.includes(s));

      if (deletionFailed && exhausted.length > 0) {
        console.error(
          `[StatusCleanup] giving up on media for ${exhausted.length} status(es) after ` +
            `${MAX_DELETE_ATTEMPTS} attempts — objects may remain in the bucket`
        );
      }

      if (retryable.length > 0) {
        await Status.updateMany(
          { _id: { $in: retryable.map((s) => s._id) } },
          { $inc: { cleanupAttempts: 1 }, $set: { cleanupStatus: "pending" } }
        );
      }

      const deletable = deletionFailed ? exhausted : toDelete;
      if (deletable.length > 0) {
        await Status.deleteMany({ _id: { $in: deletable.map((s) => s._id) } });
        console.log(`[StatusCleanup] cleaned ${deletable.length} expired status(es)`);
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
