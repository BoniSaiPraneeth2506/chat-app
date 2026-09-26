// Signing the media a status points at.
//
// A status can hold bytes in several places — the primary media, the extra
// items of a layout, a voice clip, a music track, a text status's background
// photo, a link preview image — and each one has its own key and content type.
// Signing them in one place means a new media slot cannot be added without also
// being signed, which is the failure mode where the row loads and then renders
// a permanent spinner.
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorage, storageBucket, isStorageConfigured } from "./storage.js";

export const STATUS_MEDIA_URL_TTL_SECONDS = 3600; // 1 hour

const sign = async (key, contentType) => {
  if (!key || !isStorageConfigured()) return "";
  try {
    return await getSignedUrl(
      getStorage(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: key,
        ResponseContentType: contentType || undefined,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: STATUS_MEDIA_URL_TTL_SECONDS }
    );
  } catch {
    // A single missing object must not fail the whole list. The slot keeps its
    // key, so the client can ask for it again once the URL TTL is refreshed.
    return "";
  }
};

/**
 * Fills in every transient `url` on a status, in place, and returns it.
 *
 * Safe on both a Mongoose document and a plain lean object: the slots are
 * sub-documents either way, and an absent one is simply skipped.
 */
export const signStatusMedia = async (status) => {
  if (!status || !isStorageConfigured()) return status;

  try {
    const jobs = [];

    if (status.media?.key) {
      jobs.push(
        sign(status.media.key, status.media.contentType).then((url) => {
          status.media.url = url;
        })
      );
    }

    if (Array.isArray(status.mediaItems)) {
      for (const item of status.mediaItems) {
        if (!item?.key) continue;
        jobs.push(
          sign(item.key, item.contentType).then((url) => {
            item.url = url;
          })
        );
      }
    }

    if (status.voice?.key) {
      jobs.push(
        sign(status.voice.key, status.voice.contentType).then((url) => {
          status.voice.url = url;
        })
      );
      if (status.voice.backgroundKey) {
        jobs.push(
          sign(status.voice.backgroundKey, status.voice.backgroundContentType).then((url) => {
            status.voice.backgroundUrl = url;
          })
        );
      }
    }

    if (status.music?.key) {
      jobs.push(
        sign(status.music.key, status.music.contentType).then((url) => {
          status.music.url = url;
        })
      );
      if (status.music.albumArtKey) {
        jobs.push(
          sign(status.music.albumArtKey, "image/jpeg").then((url) => {
            status.music.albumArtUrl = url;
          })
        );
      }
    }

    if (status.text?.mediaKey) {
      jobs.push(
        sign(status.text.mediaKey, status.text.mediaContentType).then((url) => {
          status.text.mediaUrl = url;
        })
      );
    }

    if (status.link?.imageKey) {
      jobs.push(
        sign(status.link.imageKey, status.link.imageContentType).then((url) => {
          status.link.imageUrl = url;
        })
      );
    }

    await Promise.all(jobs);
  } catch {
    // Signing is best-effort by design; see the catch inside sign().
  }

  return status;
};

/** Signs a batch concurrently, reusing one signer's client. */
export const signMany = (statuses) =>
  Promise.all((statuses || []).map((s) => signStatusMedia(s)));

/** Every object key a status owns, for the cleanup sweep. */
export const statusMediaKeys = (status) => {
  if (!status) return [];
  const keys = [];
  if (status.media?.key) keys.push(status.media.key);
  for (const item of status.mediaItems || []) if (item?.key) keys.push(item.key);
  if (status.voice?.key) keys.push(status.voice.key);
  if (status.voice?.backgroundKey) keys.push(status.voice.backgroundKey);
  if (status.music?.key) keys.push(status.music.key);
  if (status.music?.albumArtKey) keys.push(status.music.albumArtKey);
  if (status.text?.mediaKey) keys.push(status.text.mediaKey);
  if (status.link?.imageKey) keys.push(status.link.imageKey);
  return keys;
};
