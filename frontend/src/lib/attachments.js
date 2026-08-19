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
