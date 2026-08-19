/**
 * Object storage for large chat attachments.
 *
 * One S3-compatible provider, resolved from the environment. Backblaze B2 is
 * preferred; the older Cloudflare R2 configuration still works if that is what a
 * deployment has, so switching is a matter of which variables are set rather than
 * a code change.
 *
 * Images, avatars, banners and voice notes are untouched by this — they stay on
 * Cloudinary, which handles them well and already works. Only video, large
 * images and documents come here, because those are the ones that cannot go
 * through Express as base64 without holding the whole file in memory and hitting
 * the 10 MB body limit.
 *
 * Nothing here throws at import time. The client is built on first use and
 * `isStorageConfigured()` lets callers refuse politely instead of the process
 * dying because a variable is missing.
 */
import { S3Client } from "@aws-sdk/client-s3";

const B2_VARS = ["B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET", "B2_ENDPOINT"];
const R2_VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];

const allSet = (names) => names.every((name) => Boolean(process.env[name]));

/** "b2", "r2", or null when neither is configured. */
export const storageProvider = () => {
  if (allSet(B2_VARS)) return "b2";
  if (allSet(R2_VARS)) return "r2";
  return null;
};

export const isStorageConfigured = () => storageProvider() !== null;

/** Which variables are missing, for a log line that actually says what to fix. */
export const missingStorageVars = () => {
  if (storageProvider()) return [];
  const missingB2 = B2_VARS.filter((name) => !process.env[name]);
  const missingR2 = R2_VARS.filter((name) => !process.env[name]);
  // Report whichever is closer to complete, so a half-filled B2 config is not
  // buried under a list of R2 variables nobody intends to set.
  return missingB2.length <= missingR2.length ? missingB2 : missingR2;
};

export const storageBucket = () =>
  storageProvider() === "b2" ? process.env.B2_BUCKET : process.env.R2_BUCKET;

let client = null;
let builtFor = null;

/** The shared client, created on first use. Null when nothing is configured. */
export const getStorage = () => {
  const provider = storageProvider();
  if (!provider) return null;
  if (client && builtFor === provider) return client;

  const common = {
    // This SDK signs a CRC32 checksum header into PutObject by default. A browser
    // uploading to a presigned URL never sends that header, so the signature does
    // not match and every upload to a non-AWS S3 service fails with a 403 that
    // says nothing useful. Required-only restores the behaviour these services
    // expect.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };

  if (provider === "b2") {
    const endpoint = String(process.env.B2_ENDPOINT).replace(/\/+$/, "");
    client = new S3Client({
      ...common,
      // B2 checks the region against the endpoint it was given, and the endpoint
      // carries it: s3.us-east-005.backblazeb2.com -> us-east-005. Derived rather
      // than required separately so the two cannot drift apart.
      region: process.env.B2_REGION || regionFromEndpoint(endpoint) || "us-east-005",
      endpoint,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
    });
  } else {
    client = new S3Client({
      ...common,
      // "auto" is the only region R2 accepts.
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  builtFor = provider;
  return client;
};

/** "https://s3.us-east-005.backblazeb2.com" -> "us-east-005" */
const regionFromEndpoint = (endpoint) => {
  const match = /^https?:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com/i.exec(endpoint);
  return match ? match[1] : null;
};

/**
 * A permanently readable base URL, if the bucket happens to be public.
 *
 * Left in for the R2 deployment that had one. A private bucket — which is what
 * B2 is set up as here — has no such address, and reads go through a signed URL
 * from the API instead. Attachments are deliberately never served from the API's
 * own origin: a user-uploaded .html or .svg there would run with access to the
 * session cookie.
 */
export const publicBaseUrl = () =>
  String(process.env.R2_PUBLIC_URL || process.env.B2_PUBLIC_URL || "").replace(/\/+$/, "");
