// Rules and helpers for R2-backed chat attachments (video + documents).
//
// Kept separate from r2.js so "what is allowed" stays independent of "how we
// talk to the bucket", and so the limits can be read by any controller without
// pulling in the S3 client.
import crypto from "crypto";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2, R2_BUCKET, R2_PUBLIC_URL } from "./r2.js";

const mb = (n) => n * 1_000_000;

/**
 * Size caps default low on purpose: R2's free tier includes 10 GB of storage,
 * and a 100 MB video cap would exhaust that in about a hundred clips. Both are
 * env-overridable so the ceiling can be raised without a code change once the
 * account is on a paid plan.
 */
const envMb = (name, fallbackMb) => {
  const parsed = Number(process.env[name]);
  return mb(Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMb);
};

export const ATTACHMENT_RULES = {
  video: {
    get maxBytes() {
      return envMb("R2_MAX_VIDEO_MB", 50);
    },
    types: ["video/mp4", "video/webm", "video/quicktime"],
    label: "Video",
  },
  document: {
    get maxBytes() {
      return envMb("R2_MAX_DOC_MB", 10);
    },
    types: [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
    ],
    label: "Document",
  },
};

/** Most attachments a single message may carry. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/**
 * Validates a client's declared upload before any URL is signed. Nothing here
 * can be trusted after the fact — the size is re-checked against the stored
 * object in verifyAttachment() — but rejecting early avoids handing out a URL
 * for a file we would refuse anyway.
 */
export const validateUploadRequest = ({ kind, mime, size }) => {
  const rule = ATTACHMENT_RULES[kind];
  if (!rule) return { valid: false, reason: "Unsupported attachment type" };

  if (typeof mime !== "string" || !rule.types.includes(mime)) {
    return { valid: false, reason: `That ${rule.label.toLowerCase()} format isn't supported` };
  }

  if (!Number.isInteger(size) || size <= 0) {
    return { valid: false, reason: "Invalid file size" };
  }
  if (size > rule.maxBytes) {
    return {
      valid: false,
      reason: `${rule.label}s must be under ${Math.round(rule.maxBytes / 1_000_000)} MB`,
    };
  }
  return { valid: true };
};

/**
 * Builds the object key. The server owns this entirely — a client-supplied
 * path could overwrite another user's object or escape their namespace. The
 * original filename is kept only as display metadata on the message.
 */
export const buildObjectKey = ({ kind, userId, fileName }) => {
  const name = String(fileName || "");
  // Only treat text after a dot as an extension — a file called "README"
  // should not end up stored as ".readme".
  const rawExt = name.includes(".") ? name.split(".").pop() : "";
  const ext =
    rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return `${kind}/${userId}/${crypto.randomUUID()}.${ext}`;
};

/**
 * Strips path separators and non-printable characters out of a filename kept
 * for display. Spaces and punctuation are preserved on purpose — this is a
 * label shown to the user, not a path, so "Q3 report-final.pdf" stays intact.
 */
export const safeDisplayName = (fileName) =>
  Array.from(String(fileName || "file"))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/[/\\]/g, "_")
    .trim()
    .slice(0, 120) || "file";

export const publicUrlForKey = (key) => `${R2_PUBLIC_URL()}/${key}`;

/**
 * Confirms an attachment the client claims to have uploaded really exists,
 * and matches what was authorized. Without this a client could reference an
 * arbitrary key — or a message could point at an object that never landed
 * because the upload failed halfway.
 */
export const verifyAttachment = async ({ key, kind, size, mime }) => {
  const r2 = getR2();
  if (!r2) return { valid: false, reason: "File storage is not configured" };

  const rule = ATTACHMENT_RULES[kind];
  if (!rule) return { valid: false, reason: "Unsupported attachment type" };

  // The key layout is `<kind>/<userId>/<uuid>.<ext>`; anything else was not
  // produced by buildObjectKey and should not be trusted.
  if (typeof key !== "string" || !key.startsWith(`${kind}/`)) {
    return { valid: false, reason: "Invalid attachment reference" };
  }

  try {
    const head = await r2.send(
      new HeadObjectCommand({ Bucket: R2_BUCKET(), Key: key })
    );

    if (head.ContentLength > rule.maxBytes) {
      return { valid: false, reason: "Uploaded file exceeds the size limit" };
    }
    if (Number.isInteger(size) && head.ContentLength !== size) {
      return { valid: false, reason: "Uploaded file does not match the declared size" };
    }
    if (mime && head.ContentType && head.ContentType !== mime) {
      return { valid: false, reason: "Uploaded file does not match the declared type" };
    }
    return { valid: true, size: head.ContentLength, mime: head.ContentType || mime };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return { valid: false, reason: "Upload not found — please try again" };
    }
    console.error("Error verifying attachment:", err.message);
    return { valid: false, reason: "Could not verify the upload" };
  }
};
