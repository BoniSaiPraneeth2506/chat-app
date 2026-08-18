import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { runEmailDigest } from "../jobs/emailDigest.js";
import { getAppUrl } from "../lib/appUrl.js";
import { weeklyDigestEmail, inactivityNudgeEmail } from "../lib/emailTemplates.js";

/**
 * Manual control for the digest, so it can be inspected without waiting a week.
 *
 *   node scripts/digest.js --dry              what would go out, and to whom
 *   node scripts/digest.js --preview          write both emails to HTML files
 *   node scripts/digest.js --send-digest      send the weekly summary now
 *   node scripts/digest.js --send-nudge       send the inactivity nudge now
 *
 * --preview uses fixed sample numbers on purpose: it is for checking the layout
 * in a browser, and real data would change under it between runs.
 */

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

const connect = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  await mongoose.connect(uri);
};

const preview = () => {
  const appUrl = getAppUrl() || "https://example.onrender.com";
  const sample = {
    name: "Sai Praneeth",
    appUrl,
    unreadTotal: 14,
    mentions: 2,
    missedCalls: 1,
    sinceDays: 4,
    conversations: [
      { name: "Jyothika", isGroup: false, count: 6, preview: "Did you get the files I sent?" },
      { name: "Club", isGroup: true, count: 5, preview: "Voice message" },
      { name: "Bunny", isGroup: false, count: 3, preview: "Call me when you are free" },
    ],
  };

  const out = path.resolve("./.email-preview");
  fs.mkdirSync(out, { recursive: true });

  const digest = weeklyDigestEmail(sample);
  const nudge = inactivityNudgeEmail(sample);
  fs.writeFileSync(path.join(out, "digest.html"), digest.html);
  fs.writeFileSync(path.join(out, "nudge.html"), nudge.html);
  fs.writeFileSync(path.join(out, "digest.txt"), digest.text);
  fs.writeFileSync(path.join(out, "nudge.txt"), nudge.text);

  console.log(`app URL in links: ${appUrl}`);
  console.log(`digest subject:   ${digest.subject}`);
  console.log(`nudge subject:    ${nudge.subject}`);
  console.log(`written to:       ${out}`);
};

const main = async () => {
  if (has("--preview")) {
    preview();
    return;
  }

  await connect();
  try {
    const force = has("--send-digest") ? "digest" : has("--send-nudge") ? "nudge" : null;
    const outcomes = await runEmailDigest({ dryRun: has("--dry"), force });
    console.table(outcomes);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
