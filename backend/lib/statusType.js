// Working out what kind of status a stored document is.
//
// The `type` field is the answer for every status created since the 2.0 rewrite,
// and it is an enum with a default, so nothing new can arrive without one. It is
// absent, though, on documents written before that rewrite — those have a `media`
// slot and nothing else, because "a photo" was the only kind of status that
// existed.
//
// Without this, an old status is not rendered as a photo. The client switches on
// `type`, finds `undefined`, and draws its empty fallback: the viewer's header
// appears with the name on it and no picture underneath, which reads as a status
// that loaded but came back blank.
//
// So the type is derived from what the document actually holds when the field is
// missing, rather than being trusted to be present. Inference is a fallback
// only — a document with a real `type` is never second-guessed, so this cannot
// reclassify a status someone deliberately posted as, say, a poll.
import Status from "../models/status.model.js";

/** A document's own `type`, or the one its fields imply. */
export const resolveStatusType = (status) => {
  const declared = typeof status?.type === "string" ? status.type : "";
  if (declared) return declared;

  // Ordered most-specific first. A status can carry media *and* a typed payload
  // (a poll about a photo, a countdown with a background), so the payload is
  // checked before the media, which is the vaguer of the two signals.
  if (status?.poll?.options?.length) return "poll";
  if (status?.question) return "question";
  if (status?.countdown?.targetAt) return "countdown";
  if (status?.music?.key) return "music";
  if (status?.voice?.key) return "voice";
  if (status?.location) return "location";
  if (status?.link?.url) return "link";
  if (status?.text?.content) return "text";
  if (Array.isArray(status?.mediaItems) && status.mediaItems.length > 1) return "layout";
  if (status?.media?.type === "video") return "video";
  if (status?.media?.type === "image" || status?.media?.key) return "image";

  return "image";
};

/**
 * Fills in a missing `type` on one document or a list of them, in place.
 *
 * In place, because these are lean objects that are about to be serialised
 * straight into a response, and copying every status to add one field would be
 * work for no benefit.
 */
export const withResolvedStatusType = (statusOrList) => {
  if (Array.isArray(statusOrList)) {
    for (const status of statusOrList) withResolvedStatusType(status);
    return statusOrList;
  }
  if (statusOrList && typeof statusOrList === "object") {
    if (!statusOrList.type) statusOrList.type = resolveStatusType(statusOrList);
  }
  return statusOrList;
};

/**
 * One-time repair for documents written before `type` existed.
 *
 * Optional and idempotent — safe to run against a database that has already been
 * fixed, and it only writes documents that are actually missing the field. Not
 * called automatically at boot, so importing this module has no side effects.
 *
 * The type is decided per document by the same inference the read path uses, so
 * a legacy video is not mislabelled as a photo.
 */
export const backfillMissingStatusTypes = async () => {
  const missing = await Status.find({
    $or: [{ type: { $exists: false } }, { type: "" }],
  })
    .select("type media mediaItems text voice music poll question countdown location link")
    .lean();

  let modified = 0;
  for (const doc of missing) {
    const type = resolveStatusType(doc);
    if (!type) continue;
    const res = await Status.updateOne({ _id: doc._id }, { $set: { type } });
    modified += res.modifiedCount || 0;
  }
  return modified;
};
