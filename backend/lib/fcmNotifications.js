import DeviceToken from "../models/deviceToken.model.js";
import User from "../models/user.model.js";
import { getMessagingService } from "./firebaseAdmin.js";
import { isUserViewingConversation } from "./socket.js";

// ── Android push notifications (FCM) ──────────────────────────────────────────
//
// Socket.IO remains the realtime transport. Push is the *fallback* layer that
// reaches a recipient's Android device when the socket cannot — the app is
// backgrounded, the process was killed, or the device is on a filtered
// connection. Every notification carries a structured `data` payload
// ({ type, conversationId, messageId, senderId }) so the app can route a tap
// to the exact conversation, and a `notification` block for the system drawer.
//
// The service is intentionally safe to call when Firebase is unconfigured: it
// resolves to a no-op. It also never throws into the message-send path — a push
// that fails must not block the message that was already saved and broadcast
// over the socket.

// Android notification channels must be created client-side by the app before
// a notification is shown (the plugin creates them on first run). We reference
// the channel id in the payload so the delivered notification lands in the
// right channel and thus follows the user's channel settings (sound, importance).
const CHANNEL_BY_TYPE = {
  chat_message: "messages",
  group_message: "groups",
  mention: "mentions",
  reply: "messages",
  missed_call: "calls",
  message_request: "requests",
  status: "status",
  reaction: "messages",
};

/** A message preview stripped to something sane for a notification body. */
function preview(text) {
  if (typeof text !== "string") return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 120 ? cleaned.slice(0, 120) + "…" : cleaned;
}

function describeContent(message = {}) {
  const c = message;
  // Text always wins: a card may carry text alongside media/contact, and the
  // user wants to read what was sent, not a type label.
  const text = preview(c.text);
  if (text) return text;
  if (c.image) return "📷 Photo";
  if (Array.isArray(c.images) && c.images.length) return "📷 Photo";
  if (c.voice) return "🎤 Voice message";
  if (Array.isArray(c.attachments) && c.attachments.length) {
    const kinds = c.attachments.map((a) => a?.kind).filter(Boolean);
    return kinds.includes("video") ? "📹 Video" : "📎 Attachment";
  }
  if (c.contact?.name) return `📇 ${c.contact.name}`;
  if (c.contact) return "📇 Contact";
  if (c.poll && c.poll.question) return "📊 Poll";
  return "New message";
}

/**
 * Whether the `sender` is muted/blocked from pushing to `recipient`.
 * Returns true when push should be suppressed for this conversation.
 */
async function shouldSuppressForRecipient({ recipient, senderId, type, conversationId }) {
  // Global push opt-out.
  if (recipient?.notificationPrefs?.pushEnabled === false) return true;

  // Blocking cuts both ways; a blocked sender never triggers a push.
  const blocked = recipient?.blockedUsers || [];
  if (blocked.some((id) => String(id) === String(senderId))) return true;

  // The sending side already runs a block check, but re-verifying the recipient
  // didn't newly block the sender keeps this branch self-contained.

  // Per-conversation mute. Mentions in groups still get through — that is the
  // point of a mention. Non-mention group messages respect the group mute.
  if (type === "mention") return false;
  if (type === "group_message") {
    if (recipient?.mutedGroups?.get && recipient.mutedGroups.get(String(conversationId))) {
      return true;
    }
  } else if (recipient?.mutedChats?.get && recipient.mutedChats.get(String(conversationId))) {
    return true;
  }
  return false;
}

/**
 * Send the recipient one push notification per registered device.
 *
 * `conversationId` is the DM partner id (for chat_message) or the group id.
 * The notification is suppressed when any of the recipient's connected devices
 * is already showing this conversation, since that device is displaying the
 * message live over the socket.
 */
export async function sendPushNotification({
  recipient,
  senderName,
  type,
  conversationId,
  messageId,
  senderId,
  messageContent,
  silent = false,
}) {
  const messaging = getMessagingService();
  if (!messaging) return; // Firebase not configured — nothing to do.

  if (!recipient?._id) return;

  // A connected device already on this exact screen needs no notification.
  if (isUserViewingConversation(recipient._id, conversationId)) return;

  const suppressed = await shouldSuppressForRecipient({
    recipient,
    senderId,
    type,
    conversationId,
  });
  if (suppressed) return;

  const tokens = await DeviceToken.find({ userId: recipient._id })
    .select("token")
    .lean();
  if (!tokens.length) return;

  const tokenList = tokens.map((t) => t.token);

  // Titles/bodies by notification type.
  let title = senderName || "ChatApp";
  let body = describeContent(messageContent);
  if (type === "group_message") {
    title = conversationId ? `${senderName || "Someone"}` : senderName || "ChatApp";
    body = (messageContent?.text ? preview(messageContent.text) : describeContent(messageContent)) || "New message in group";
  } else if (type === "mention") {
    title = conversationId ? `${senderName || "Someone"}` : senderName || "ChatApp";
    body = `@mentioned you: ${preview(messageContent?.text) || "New message"}`;
  } else if (type === "reply") {
    body = `Replied: ${preview(messageContent?.text) || "New message"}`;
  } else if (type === "missed_call") {
    title = senderName || "ChatApp";
    body = "Missed call";
  } else if (type === "message_request") {
    title = senderName || "ChatApp";
    body = "Sent you a message request";
  } else if (type === "status") {
    title = senderName || "ChatApp";
    body = "posted a status update";
  } else if (type === "reaction") {
    body = "Reacted to your message";
  }

  const channelId = CHANNEL_BY_TYPE[type] || "messages";

  const message = {
    notification: silent
      ? undefined
      : {
          title,
          body,
        },
    data: {
      type: type || "chat_message",
      conversationId: String(conversationId || ""),
      messageId: String(messageId || ""),
      senderId: String(senderId || ""),
      channelId,
      title: String(title),
      body: String(body),
      silent: silent ? "true" : "false",
      click_action: "OPEN_CONVERSATION",
    },
    tokens: tokenList,
    android: {
      priority: "high",
      notification: silent
        ? { channelId }
        : {
            channelId,
            clickAction: "OPEN_CONVERSATION",
          },
    },
  };

  try {
    // sendEachForMulticast delivers to every token and reports per-token
    // failures, which is what lets us prune tokens FCM no longer accepts.
    const response = await messaging.sendEachForMulticast(message);
    await pruneInvalidTokens(recipient._id, tokens, response.responses);
  } catch (err) {
    console.error("[push] sendEachForMulticast failed:", err.message);
  }
}

/** Remove tokens FCM rejects so we don't keep targetting dead devices. */
async function pruneInvalidTokens(userId, tokens, responses) {
  if (!Array.isArray(responses)) return;
  const deadTokens = [];
  responses.forEach((resp, i) => {
    const tok = tokens[i];
    if (!tok) return;
    if (resp.error) {
      const code = resp.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        deadTokens.push(tok._id);
      }
    }
  });
  if (deadTokens.length) {
    try {
      await DeviceToken.deleteMany({ _id: { $in: deadTokens } });
      console.log(`[push] pruned ${deadTokens.length} revoked token(s) for user ${userId}`);
    } catch (err) {
      console.error("[push] failed to prune tokens:", err.message);
    }
  }
}

/**
 * Convenience wrapper used by the DM send path: loads the recipient and calls
 * sendPushNotification. Best-effort — never blocks message delivery.
 */
export async function pushDmNotification({ recipientUser, sender, message, type }) {
  if (!recipientUser?._id) return;
  const conversationId = recipientUser._id;
  try {
    await sendPushNotification({
      recipient: recipientUser,
      senderName: sender?.fullName || "ChatApp",
      type,
      conversationId,
      messageId: message?._id,
      senderId: String(sender?._id || ""),
      messageContent: message,
    });
  } catch (err) {
    console.error("[push] pushDmNotification error:", err.message);
  }
}

/**
 * Convenience wrapper for group sends. Iterates members (excluding the sender)
 * and pushes to each. Members who were @mentioned get a `mention` notification,
 * everyone else a `group_message` one. Best-effort.
 */
export async function pushGroupNotification({ group, sender, senderName, message, mentions = [] }) {
  if (!group?.members?.length) return;

  const memberIds = group.members
    .map((m) => (m.user?._id || m.user)?.toString())
    .filter((id) => id && id !== String(sender?._id || ""));

  if (!memberIds.length) return;

  const mentionIds = new Set(
    (Array.isArray(mentions) ? mentions : []).map((m) => String(m))
  );

  const recipients = await User.find({ _id: { $in: memberIds } });

  // Push in parallel, each call handles its own mute/online/viewing checks.
  await Promise.all(
    recipients.map((recipient) =>
      sendPushNotification({
        recipient,
        senderName: senderName || sender?.fullName || "ChatApp",
        type: mentionIds.has(String(recipient._id)) ? "mention" : "group_message",
        conversationId: String(group._id),
        messageId: message?._id,
        senderId: String(sender?._id || ""),
        messageContent: message,
      }).catch((err) => {
        console.error("[push] group push error:", err.message);
      })
    )
  );
}

export default { sendPushNotification, pushDmNotification, pushGroupNotification };
