/**
 * Transactional email markup.
 *
 * Written as tables with inline styles, which is not a stylistic choice: Outlook
 * and several webmail clients strip <style> blocks and do not support flexbox or
 * grid, so anything laid out the way the app is would collapse into a single
 * column of unstyled text. Width is capped at 600px for the same reason.
 *
 * The palette matches the app's launcher icon — navy with white — rather than the
 * user's chosen in-app theme, because an email cannot read CSS variables and the
 * brand should be constant in an inbox.
 *
 * Every message carries a plain-text alternative. Some clients show it, spam
 * filters weigh its absence, and it is what a screen reader reads first.
 */

const NAVY = "#0a2463";
const NAVY_DARK = "#071a4a";
const INK = "#1a1d29";
const MUTED = "#5b6072";
const HAIRLINE = "#e6e8ef";
const CANVAS = "#f4f5f9";

/** Escapes user-controlled text: names and message snippets end up in this HTML. */
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const button = (url, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${NAVY}" style="border-radius:10px;">
        <a href="${esc(url)}"
           style="display:inline-block;padding:14px 34px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                  font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;

/** One statistic. Rendered as a table cell so it survives clients without flexbox. */
const statCell = (value, label) => `
  <td align="center" width="33%" style="padding:14px 6px;">
    <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:${NAVY};line-height:1;">
      ${esc(value)}
    </div>
    <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.06em;
                text-transform:uppercase;color:${MUTED};padding-top:6px;">
      ${esc(label)}
    </div>
  </td>`;

const conversationRow = (item, isLast) => `
  <tr>
    <td style="padding:12px 0;${isLast ? "" : `border-bottom:1px solid ${HAIRLINE};`}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${INK};">
            ${esc(item.name)}
            ${item.isGroup ? `<span style="font-size:11px;font-weight:500;color:${MUTED};"> &middot; group</span>` : ""}
          </td>
          <td align="right" style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:${NAVY};white-space:nowrap;">
            ${esc(String(item.count))} new
          </td>
        </tr>
        ${
          item.preview
            ? `<tr><td colspan="2" style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};padding-top:4px;">
                 ${esc(item.preview)}
               </td></tr>`
            : ""
        }
      </table>
    </td>
  </tr>`;

const shell = ({ preheader, heading, intro, bodyHtml, ctaUrl, ctaLabel, footnote }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <!-- Preheader: the grey line an inbox shows next to the subject. Hidden in the
       body itself, or it would repeat as the first visible sentence. -->
  <div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">

          <!-- Brand bar. A text wordmark rather than an image: remote images are
               blocked by default in most clients, so a logo would often be a gap. -->
          <tr>
            <td style="background:${NAVY};padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-.01em;">
                    Chatty
                  </td>
                  <td align="right" style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#b9c2e0;letter-spacing:.06em;text-transform:uppercase;">
                    ${esc(preheader.length > 34 ? "Summary" : preheader)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px 8px;">
              <h1 style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:${INK};">
                ${esc(heading)}
              </h1>
              <p style="margin:10px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${MUTED};">
                ${esc(intro)}
              </p>
            </td>
          </tr>

          <tr><td style="padding:8px 28px 0;">${bodyHtml}</td></tr>

          <tr><td style="padding:26px 28px 6px;">${button(ctaUrl, ctaLabel)}</td></tr>

          <tr>
            <td style="padding:14px 28px 30px;">
              <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
                ${esc(footnote)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${NAVY_DARK};padding:18px 28px;">
              <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9aa6cc;text-align:center;">
                Sent by Chatty because this address has an account.<br>
                <a href="${esc(ctaUrl)}" style="color:#ffffff;text-decoration:underline;">Open Chatty</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Weekly summary: what happened while they were away.
 *
 * The numbers are read from the database at send time, so the mail describes the
 * account rather than a template. With nothing waiting it says so plainly instead
 * of inventing activity.
 */
export const weeklyDigestEmail = ({ name, appUrl, unreadTotal, conversations, mentions, missedCalls, sinceDays }) => {
  const firstName = String(name || "there").trim().split(/\s+/)[0];
  const hasActivity = unreadTotal > 0 || mentions > 0 || missedCalls > 0;

  const statsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${CANVAS};border-radius:12px;">
      <tr>
        ${statCell(unreadTotal, "unread")}
        ${statCell(conversations.length, conversations.length === 1 ? "chat" : "chats")}
        ${statCell(mentions, "mentions")}
      </tr>
    </table>`;

  const listHtml = conversations.length
    ? `
    <p style="margin:22px 0 4px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;
              letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:${MUTED};">
      Waiting for you
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${conversations.map((c, i) => conversationRow(c, i === conversations.length - 1)).join("")}
    </table>`
    : "";

  const missedHtml = missedCalls
    ? `<p style="margin:18px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:${INK};">
         You also missed ${esc(plural(missedCalls, "call", "calls"))}.
       </p>`
    : "";

  const heading = hasActivity
    ? `You have ${plural(unreadTotal, "message", "messages")} waiting`
    : "Your week on Chatty";

  const intro = hasActivity
    ? `Here is what came in while you were away${sinceDays ? ` over the last ${plural(sinceDays, "day", "days")}` : ""}.`
    : "Nothing is waiting for you right now — your chats are all caught up.";

  const text = [
    `Hi ${firstName},`,
    "",
    hasActivity
      ? `You have ${plural(unreadTotal, "unread message", "unread messages")} across ${plural(conversations.length, "chat", "chats")}.`
      : "You are all caught up — nothing is waiting.",
    mentions ? `Mentions: ${mentions}` : "",
    missedCalls ? `Missed calls: ${missedCalls}` : "",
    "",
    ...conversations.map((c) => `- ${c.name}${c.isGroup ? " (group)" : ""}: ${c.count} new${c.preview ? ` — ${c.preview}` : ""}`),
    "",
    `Open Chatty: ${appUrl}`,
    "",
    "You are receiving this weekly summary because this address has a Chatty account.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: hasActivity
      ? `${unreadTotal} unread on Chatty${mentions ? ` · ${mentions} mention${mentions === 1 ? "" : "s"}` : ""}`
      : "Your weekly Chatty summary",
    text,
    html: shell({
      preheader: hasActivity
        ? `${plural(unreadTotal, "message", "messages")} waiting across ${plural(conversations.length, "chat", "chats")}`
        : "You are all caught up",
      heading,
      intro: `Hi ${firstName} — ${intro}`,
      bodyHtml: statsHtml + listHtml + missedHtml,
      ctaUrl: appUrl,
      ctaLabel: hasActivity ? "Read your messages" : "Open Chatty",
      footnote: "This is your weekly summary. It arrives once a week, never more often.",
    }),
  };
};

/**
 * Inactivity nudge.
 *
 * Deliberately quieter than the digest: one number, one sentence, one button. A
 * nudge that arrives looking like a newsletter gets treated like one.
 */
export const inactivityNudgeEmail = ({ name, appUrl, unreadTotal, conversations, sinceDays }) => {
  const firstName = String(name || "there").trim().split(/\s+/)[0];
  const who = conversations.slice(0, 2).map((c) => c.name);
  const whoLine = who.length
    ? `${who.join(" and ")}${conversations.length > who.length ? " and others" : ""} messaged you.`
    : "Your chats are waiting.";

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${CANVAS};border-radius:12px;">
      <tr>
        <td align="center" style="padding:22px 18px;">
          <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:34px;font-weight:700;color:${NAVY};line-height:1;">
            ${esc(String(unreadTotal))}
          </div>
          <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.06em;
                      text-transform:uppercase;color:${MUTED};padding-top:8px;">
            unread ${unreadTotal === 1 ? "message" : "messages"}
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:18px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};">
      ${esc(whoLine)}
    </p>`;

  const text = [
    `Hi ${firstName},`,
    "",
    `It has been ${plural(sinceDays, "day", "days")} since you last opened Chatty, and you have ${plural(unreadTotal, "unread message", "unread messages")}.`,
    whoLine,
    "",
    `Sign in: ${appUrl}`,
  ].join("\n");

  return {
    subject: `${firstName}, you have ${plural(unreadTotal, "message", "messages")} waiting`,
    text,
    html: shell({
      preheader: `${plural(unreadTotal, "unread message", "unread messages")} since you were last here`,
      heading: `You have ${plural(unreadTotal, "message", "messages")} waiting`,
      intro: `Hi ${firstName} — it has been ${plural(sinceDays, "day", "days")} since you last signed in.`,
      bodyHtml,
      ctaUrl: appUrl,
      ctaLabel: "Sign in to Chatty",
      footnote: "We only send this when messages are actually waiting for you.",
    }),
  };
};
