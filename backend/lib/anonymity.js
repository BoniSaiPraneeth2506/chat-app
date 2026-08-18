/**
 * Anonymous group questions.
 *
 * senderId is always recorded on the message — anonymity is a presentation rule,
 * not an absence of accountability — so every path that returns a message to a
 * client has to strip it. Keeping that in one place is the point: a single
 * forgotten read path is enough to unmask someone permanently.
 *
 * `viewerId` only ever sets a flag about the viewer's *own* message. That tells
 * them nothing they did not already know, and it is what lets their own
 * anonymous question still read as theirs.
 */
export const hideAnonymousAuthor = (message, viewerId) => {
  if (!message) return message;
  const plain = typeof message.toObject === "function" ? message.toObject() : { ...message };
  if (!plain.isAnonymous) return plain;

  const authorId = (plain.senderId?._id || plain.senderId)?.toString();
  return {
    ...plain,
    senderId: { _id: null, fullName: "Anonymous", profilePic: "" },
    anonymousIsMine: Boolean(viewerId) && authorId === viewerId.toString(),
  };
};
