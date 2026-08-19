import axiosInstance from "./axios";

/**
 * Uploading a large file.
 *
 * Three steps, and the middle one deliberately does not go through our API: the
 * server authorises the upload, the browser sends the bytes straight to the
 * bucket, and only then is the message sent. Routing a video through Express as
 * base64 would hold the whole thing in memory and hit the 10 MB body limit long
 * before it finished.
 */

/** Which bucket-backed kind this file belongs to, or null if it is not allowed. */
export const kindFor = (file, limits) => {
  if (!file || !limits?.enabled) return null;
  for (const kind of ["video", "image", "document"]) {
    if (limits[kind]?.types?.includes(file.type)) return kind;
  }
  return null;
};

export const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)} MB`;
};

/** Reads the caps from the server so the UI refuses the same files it would. */
export const fetchUploadLimits = async () => {
  try {
    const res = await axiosInstance.get("/uploads/limits");
    return res.data;
  } catch {
    return { enabled: false };
  }
};

/**
 * Checks a file against the server's rules before anything is signed.
 *
 * The same check runs on the server, and again against the stored object after
 * the upload — this one exists so a file that was never going to be accepted
 * fails instantly instead of after a long upload.
 */
export const validateFile = (file, limits) => {
  if (!limits?.enabled) {
    return { valid: false, reason: "File sharing is not available right now" };
  }
  const kind = kindFor(file, limits);
  if (!kind) {
    return { valid: false, reason: "That file type is not supported" };
  }
  const rule = limits[kind];
  if (file.size > rule.maxBytes) {
    return {
      valid: false,
      reason: `${rule.label || "File"}s must be under ${formatBytes(rule.maxBytes)}`,
    };
  }
  if (file.size === 0) {
    return { valid: false, reason: "That file is empty" };
  }
  return { valid: true, kind };
};

/**
 * Sends the bytes to the bucket.
 *
 * XMLHttpRequest rather than fetch: it reports upload progress, which fetch still
 * cannot do. The returned abort function lets the composer cancel a large upload
 * that is no longer wanted.
 */
const putToBucket = ({ uploadUrl, file, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    // Must match what was signed, or the bucket rejects the signature.
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        // The bucket's own error body is XML and says little a person can use.
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Upload failed — check your connection and try again"));
    xhr.onabort = () => reject(new Error("aborted"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });

/**
 * Authorises, uploads, and returns the metadata the message should carry.
 *
 * Nothing is sent to the conversation until this resolves — a bubble pointing at
 * a file that failed halfway is worse than no bubble.
 */
export const uploadAttachment = async ({ file, kind, onProgress, signal }) => {
  const sign = await axiosInstance.post("/uploads/sign", {
    kind,
    mime: file.type,
    size: file.size,
    fileName: file.name,
  });

  const { uploadUrl, key } = sign.data || {};
  if (!uploadUrl || !key) throw new Error("Could not prepare the upload");

  await putToBucket({ uploadUrl, file, onProgress, signal });

  return {
    kind,
    key,
    name: file.name,
    mime: file.type,
    size: file.size,
  };
};

/**
 * A temporary URL for reading one attachment.
 *
 * The bucket is private, so there is no lasting address to store — this is asked
 * for at the moment the file is opened, and the server checks the caller belongs
 * to the conversation before signing it.
 */
export const fetchAttachmentUrl = async (messageId, key) => {
  const res = await axiosInstance.get("/uploads/url", { params: { messageId, key } });
  return res.data?.url || "";
};

/**
 * Object URLs that are still valid in this session.
 *
 * A sending bubble renders the file straight off the disk, which is instant and
 * saves downloading back what was just uploaded. That local URL survives onto the
 * confirmed message and therefore into the offline cache — where it is worthless,
 * because a blob: URL dies with the page that made it. Membership of this set is
 * how a bubble tells "my own file, right now" from "a stale handle from a previous
 * session".
 */
const liveObjectUrls = new Set();

export const createLocalUrl = (file) => {
  if (!file) return "";
  const url = URL.createObjectURL(file);
  liveObjectUrls.add(url);
  return url;
};

export const isLiveObjectUrl = (url) => Boolean(url) && liveObjectUrls.has(url);

export const releaseLocalUrl = (url) => {
  if (!url || !liveObjectUrls.has(url)) return;
  liveObjectUrls.delete(url);
  URL.revokeObjectURL(url);
};

/**
 * A still frame from a video, for the bubble to show before it plays.
 *
 * Nothing else can produce one: the bucket stores bytes and does no transcoding,
 * so without this a video arrives with nothing to display and the bubble is a
 * black rectangle — for the recipient always, and for the sender as soon as the
 * page reloads and the local file is gone.
 *
 * Kept small deliberately. It travels as a data URL on the message, so it is the
 * one place bytes do land in the database, and 320px of JPEG at moderate quality
 * is a legible thumbnail in about twenty kilobytes.
 */
export const captureVideoPoster = (file) =>
  new Promise((resolve) => {
    if (!file || !file.type.startsWith("video/")) {
      resolve("");
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (poster) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(poster);
    };

    // A frame that never arrives must not hold the send back.
    const timer = setTimeout(() => finish(""), 4000);

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";

    video.onloadeddata = () => {
      // Not frame zero: the first frame of a phone recording is often black.
      video.currentTime = Math.min(0.2, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      try {
        const scale = Math.min(1, 320 / (video.videoWidth || 320));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 180) * scale));
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        clearTimeout(timer);
        finish(canvas.toDataURL("image/jpeg", 0.6));
      } catch {
        clearTimeout(timer);
        finish("");
      }
    };

    video.onerror = () => {
      clearTimeout(timer);
      finish("");
    };

    video.src = url;
  });
