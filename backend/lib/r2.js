// Cloudflare R2 client.
//
// R2 speaks the S3 API, so this is the standard AWS SDK pointed at a
// Cloudflare endpoint. It is used only for large chat attachments (video and
// documents) — images, avatars, banners and voice notes stay on Cloudinary,
// which handles them well and already works.
//
// Everything here is written so the app runs unchanged when R2 is not
// configured: the client is created lazily and `isR2Configured()` lets callers
// fail with a clear message instead of the process crashing at import time.
import { S3Client } from "@aws-sdk/client-s3";

const REQUIRED_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];

/** True only when every credential needed to talk to R2 is present. */
export const isR2Configured = () =>
  REQUIRED_VARS.every((name) => Boolean(process.env[name]));

export const missingR2Vars = () =>
  REQUIRED_VARS.filter((name) => !process.env[name]);

export const R2_BUCKET = () => process.env.R2_BUCKET;

/**
 * Public base URL for reads. A custom domain is strongly preferred over the
 * built-in r2.dev address, which is rate-limited and not meant for production.
 * Attachments must never be served from the API's own origin — a user-uploaded
 * .html or .svg there would run with access to the session cookie.
 */
export const R2_PUBLIC_URL = () =>
  String(process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

let client = null;

/**
 * The shared S3 client, created on first use. Returns null when R2 is not
 * configured so callers can degrade rather than throw.
 */
export const getR2 = () => {
  if (!isR2Configured()) return null;
  if (client) return client;

  client = new S3Client({
    // "auto" is the only region R2 accepts.
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
};
