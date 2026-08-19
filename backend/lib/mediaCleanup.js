// Frees Cloudinary storage when the messages that own it go away.
//
// Nothing ever called `cloudinary.uploader.destroy`, so every image, voice
// note and multi-image attachment stayed in the account forever — including
// assets whose messages had been deleted for everyone, cleared from a chat by
// both sides, or silently removed by the disappearing-message TTL.
import cloudinary from "./cloudinary.js";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getStorage, storageBucket } from "./storage.js";

/**
 * Recovers the public_id from a Cloudinary delivery URL.
 *
 * Format: https://res.cloudinary.com/<cloud>/<type>/upload/v<version>/<public_id>.<ext>
 * The public_id may contain slashes (folders), so everything after the version
 * segment is kept and only the extension is dropped.
 */
export const publicIdFromUrl = (url) => {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com")) return null;
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/").filter(Boolean);
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    let rest = parts.slice(uploadIndex + 1);
    // Drop the version segment (v1234567890) when present.
    if (rest[0] && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
    if (rest.length === 0) return null;

    const joined = rest.join("/");
    const lastDot = joined.lastIndexOf(".");
    return lastDot > 0 ? joined.slice(0, lastDot) : joined;
  } catch {
    return null;
  }
};

/**
 * Voice notes are uploaded with `resource_type: "video"`, so deleting them as
 * images silently no-ops. The delivery URL records which type was used.
 */
export const resourceTypeFromUrl = (url) => (url.includes("/video/upload/") ? "video" : "image");

/** Every Cloudinary asset a message owns. */
export const assetUrlsOf = (message) => {
  if (!message) return [];
  return [message.image, message.voice, ...(message.images || [])].filter(
    (u) => typeof u === "string" && u.includes("res.cloudinary.com")
  );
};

/**
 * Best-effort destroy. Storage cleanup must never fail a user's delete
 * request, so every error is logged and swallowed — a leaked asset is a
 * smaller problem than a delete that appears not to work.
 */
export const destroyAssets = async (urls) => {
  const unique = [...new Set((urls || []).filter(Boolean))];
  if (unique.length === 0) return { destroyed: 0, failed: 0 };

  let destroyed = 0;
  let failed = 0;

  await Promise.all(
    unique.map(async (url) => {
      const publicId = publicIdFromUrl(url);
      if (!publicId) {
        failed += 1;
        return;
      }
      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceTypeFromUrl(url),
          invalidate: true,
        });
        destroyed += 1;
      } catch (err) {
        failed += 1;
        console.error("Cloudinary destroy failed for", publicId, err.message);
      }
    })
  );

  return { destroyed, failed };
};

/** Convenience: free everything one message owns. */
/**
 * The bucket keys a message owns.
 *
 * Separate from assetUrlsOf because these are not URLs and not Cloudinary: a
 * private bucket has no address to parse, so the key stored on the attachment is
 * the only handle to the object.
 */
export const attachmentKeysOf = (message) =>
  (message?.attachments || [])
    .map((att) => att?.key)
    .filter((key) => typeof key === "string" && key.length > 0);

/**
 * Best-effort delete of bucket objects, same contract as destroyAssets: a
 * failure here is logged and swallowed, because a leaked object is a smaller
 * problem than a delete that appears not to work.
 *
 * Batched — DeleteObjects takes up to a thousand keys per call, which is well
 * past anything a single delete produces here.
 */
export const destroyObjects = async (keys) => {
  const unique = [...new Set((keys || []).filter(Boolean))];
  if (unique.length === 0) return { destroyed: 0, failed: 0 };

  const s3 = getStorage();
  if (!s3) {
    // Storage is not configured, so there is nothing this process can reach.
    // Not an error: it means these keys were written by a deployment that had
    // credentials and this one does not.
    return { destroyed: 0, failed: unique.length };
  }

  try {
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: storageBucket(),
        Delete: { Objects: unique.map((Key) => ({ Key })), Quiet: true },
      })
    );
    const failed = result.Errors?.length || 0;
    if (failed > 0) {
      console.error("Some bucket objects could not be deleted:", result.Errors?.[0]?.Message);
    }
    return { destroyed: unique.length - failed, failed };
  } catch (err) {
    console.error("Error deleting bucket objects:", err.message);
    return { destroyed: 0, failed: unique.length };
  }
};

/** Everything one message owns, wherever it lives. */
export const destroyMessageAssets = async (message) => {
  const [cloud, bucket] = await Promise.all([
    destroyAssets(assetUrlsOf(message)),
    destroyObjects(attachmentKeysOf(message)),
  ]);
  return {
    destroyed: cloud.destroyed + bucket.destroyed,
    failed: cloud.failed + bucket.failed,
  };
};
