// Clipboard write with a legacy fallback.
//
// `navigator.clipboard` needs a secure context. That holds in the browser over
// HTTPS and in the Capacitor WebView (its origin is https://localhost), but the
// call can still reject if the gesture isn't trusted, so the textarea +
// execCommand path stays as a fallback rather than being assumed dead.
//
// Extracted from ProfileQrCard, which had the only copy of this.

export const copyText = async (text) => {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission/security failure — fall through to the textarea path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

/**
 * Flatten selected chat messages into clipboard text.
 *
 * Mirrors WhatsApp: a single message copies just its body, while several are
 * prefixed with the sender so the transcript still reads correctly. Media-only
 * messages have no text to copy and are skipped rather than emitting a blank
 * line.
 */
export const messagesToClipboardText = (msgs, { authUserId, contactName } = {}) => {
  const withText = msgs.filter((m) => m?.text && !m.isDeletedForEveryone);
  if (withText.length === 0) return "";
  if (withText.length === 1) return withText[0].text;

  return withText
    .map((m) => {
      const senderId = m.senderId?._id || m.senderId;
      const who = senderId === authUserId ? "You" : m.senderId?.fullName || contactName || "Them";
      return `[${who}] ${m.text}`;
    })
    .join("\n");
};
