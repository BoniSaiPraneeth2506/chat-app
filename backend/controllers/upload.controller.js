// Issues short-lived presigned URLs so clients upload attachment bytes straight
// to the bucket, and short-lived signed URLs so they can read them back.
//
// The server never receives the file. That is the whole point: the existing
// base64-through-Express path caps out at the 10 MB JSON body limit and holds
// the entire file in memory, which does not survive video-sized uploads on a
// small instance. Here the API only authorizes the upload and later verifies
// the result (see verifyAttachment, used by sendMessage).
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mongoose from "mongoose";
import {
  getStorage,
  storageBucket,
  isStorageConfigured,
  missingStorageVars,
  storageProvider,
} from "../lib/storage.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import {
  ATTACHMENT_RULES,
  validateUploadRequest,
  buildObjectKey,
  publicUrlForKey,
  safeDisplayName,
} from "../lib/attachments.js";

// Long enough for a slow phone to start the upload, short enough that a leaked
// URL is not a lasting grant. R2 caps presigned URLs at 7 days regardless.
const SIGNED_URL_TTL_SECONDS = 600;

/** Reports what the client may upload, so the UI can enforce the same caps. */
export const getUploadLimits = (req, res) => {
  const kinds = {};
  for (const [kind, rule] of Object.entries(ATTACHMENT_RULES)) {
    kinds[kind] = { maxBytes: rule.maxBytes, types: rule.types, label: rule.label };
  }
  res.status(200).json({
    enabled: isStorageConfigured(),
    provider: storageProvider(),
    ...kinds,
  });
};

export const signUpload = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      console.warn(
        "Upload requested but object storage is not configured. Missing:",
        missingStorageVars().join(", ")
      );
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
      getStorage(),
      new PutObjectCommand({
        Bucket: storageBucket(),
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

// A read URL lives only as long as it takes to start playing or downloading.
// Shorter than the upload window on purpose: an upload is one slow request, a
// read is instant, and this is the URL that ends up in a browser's history.
const READ_URL_TTL_SECONDS = 300;

/**
 * Hands back a temporary URL for one attachment on one message.
 *
 * The bucket is private, so this is the only way to read anything in it — which
 * makes this the place where access is decided. Being able to name a key is not
 * enough: the caller has to be part of the conversation the message belongs to,
 * and the key has to be one of that message's own attachments. Without the second
 * check, any participant of any chat could read any object in the bucket by
 * pairing a key they had seen with a message they were allowed to see.
 */
export const getAttachmentUrl = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ message: "File sharing is not available right now" });
    }

    const { messageId, key } = req.query || {};
    if (!mongoose.Types.ObjectId.isValid(String(messageId || ""))) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const userId = req.user._id;
    const message = await Message.findById(messageId).select(
      "senderId receiverId groupId attachments deletedFor isDeletedForEveryone deleteAt"
    );
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Withdrawn, cleared by this user, or expired: all of these mean the message
    // is gone as far as they are concerned, and so is anything attached to it.
    if (message.isDeletedForEveryone) {
      return res.status(404).json({ message: "That file is no longer available" });
    }
    if ((message.deletedFor || []).some((id) => String(id) === String(userId))) {
      return res.status(404).json({ message: "That file is no longer available" });
    }
    if (message.deleteAt && new Date(message.deleteAt).getTime() <= Date.now()) {
      return res.status(404).json({ message: "That file is no longer available" });
    }

    const attachment = (message.attachments || []).find((att) => att.key === key);
    if (!attachment) {
      return res.status(404).json({ message: "That file is no longer available" });
    }

    // Participation.
    let allowed = false;
    if (message.groupId) {
      const group = await Group.findById(message.groupId).select("members.user");
      allowed = Boolean(
        group?.members?.some((member) => String(member.user) === String(userId))
      );
    } else {
      allowed =
        String(message.senderId) === String(userId) ||
        String(message.receiverId) === String(userId);
    }
    if (!allowed) {
      // Deliberately the same answer as a missing file: telling someone the object
      // exists but is not theirs is more than they need to know.
      return res.status(404).json({ message: "That file is no longer available" });
    }

    const url = await getSignedUrl(
      getStorage(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: attachment.key,
        // Sent back with the object so a browser opens a PDF or video inline and
        // saves everything else under its original name rather than the uuid the
        // key is built from.
        ResponseContentType: attachment.mime || undefined,
        ResponseContentDisposition:
          attachment.kind === "document" && attachment.mime !== "application/pdf"
            ? `attachment; filename="${safeDisplayName(attachment.name).replace(/"/g, "")}"`
            : "inline",
      }),
      { expiresIn: READ_URL_TTL_SECONDS }
    );

    res.status(200).json({ url, expiresIn: READ_URL_TTL_SECONDS });
  } catch (error) {
    console.error("Error in getAttachmentUrl:", error.message);
    res.status(500).json({ message: "Could not open that file" });
  }
};
