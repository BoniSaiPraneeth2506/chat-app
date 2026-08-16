// Issues short-lived presigned URLs so clients upload attachment bytes
// straight to Cloudflare R2.
//
// The server never receives the file. That is the whole point: the existing
// base64-through-Express path caps out at the 10 MB JSON body limit and holds
// the entire file in memory, which does not survive video-sized uploads on a
// small instance. Here the API only authorizes the upload and later verifies
// the result (see verifyAttachment, used by sendMessage).
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2, R2_BUCKET, R2_PUBLIC_URL, isR2Configured, missingR2Vars } from "../lib/r2.js";
import {
  ATTACHMENT_RULES,
  validateUploadRequest,
  buildObjectKey,
  publicUrlForKey,
} from "../lib/attachments.js";

// Long enough for a slow phone to start the upload, short enough that a leaked
// URL is not a lasting grant. R2 caps presigned URLs at 7 days regardless.
const SIGNED_URL_TTL_SECONDS = 600;

/** Reports what the client may upload, so the UI can enforce the same caps. */
export const getUploadLimits = (req, res) => {
  res.status(200).json({
    enabled: isR2Configured() && Boolean(R2_PUBLIC_URL()),
    video: {
      maxBytes: ATTACHMENT_RULES.video.maxBytes,
      types: ATTACHMENT_RULES.video.types,
    },
    document: {
      maxBytes: ATTACHMENT_RULES.document.maxBytes,
      types: ATTACHMENT_RULES.document.types,
    },
  });
};

export const signUpload = async (req, res) => {
  try {
    if (!isR2Configured()) {
      console.warn("Upload requested but R2 is not configured. Missing:", missingR2Vars().join(", "));
      return res.status(503).json({ message: "File sharing is not available right now" });
    }
    if (!R2_PUBLIC_URL()) {
      console.warn("R2_PUBLIC_URL is not set — uploaded files would have no readable URL.");
      return res.status(503).json({ message: "File sharing is not available right now" });
    }

    const { kind, mime, size, fileName } = req.body || {};

    const validation = validateUploadRequest({ kind, mime, size });
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    const key = buildObjectKey({ kind, userId: req.user._id.toString(), fileName });

    // ContentType and ContentLength are part of what gets signed, so the
    // client cannot reuse this URL to store a different or larger object.
    const uploadUrl = await getSignedUrl(
      getR2(),
      new PutObjectCommand({
        Bucket: R2_BUCKET(),
        Key: key,
        ContentType: mime,
        ContentLength: size,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    );

    res.status(200).json({
      uploadUrl,
      key,
      publicUrl: publicUrlForKey(key),
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error("Error in signUpload:", error.message);
    res.status(500).json({ message: "Could not prepare the upload" });
  }
};
