import admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

// ── Firebase Admin SDK (server-side only) ─────────────────────────────────────
//
// Credentials are read from environment variables so the private key never
// lives in the repo, the Android APK, or any client code. On Render the three
// variables below are set as secret env vars; locally they live in backend/.env.
//
// The SDK is initialised lazily and is a safe no-op when the variables are
// missing — the whole chat app (sockets, B2, cloudinary) still works normally,
// it just won't send push notifications. This makes the feature additive: an
// unconfigured deployment degrades to today's behaviour instead of crashing.
//
// Accepts either:
//   • FIREBASE_SERVICE_ACCOUNT_B64 — full base64-encoded service-account JSON
//     (recommended for Render secrets, avoids multi-line PEM mangling), or
//   • FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
//     (private key delivered with literal \n intact).

let messaging = null;
let initError = null;

function loadCredentials() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
      const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8");
      return JSON.parse(raw);
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) return null;

    privateKey = privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, "");

    return {
      type: "service_account",
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
  } catch (err) {
    initError = err;
    return null;
  }
}

function ensureAdmin() {
  if (messaging) return messaging;
  if (initError) return null;

  const credentials = loadCredentials();
  if (!credentials) return null;

  try {
    const appCount = admin.apps ? admin.apps.length : admin.getApps().length;
    if (appCount === 0) {
      // firebase-admin v14 exposes `cert` directly on the default export;
      // v12/v13 used `admin.credential.cert`. Support both.
      const certFn = admin.cert || (admin.credential && admin.credential.cert);
      if (typeof certFn !== "function") {
        throw new Error("firebase-admin credential factory unavailable");
      }
      admin.initializeApp({ credential: certFn(credentials) });
    }
    // firebase-admin v14 moved the messaging service to a named modular export.
    messaging = (typeof getMessaging === "function")
      ? getMessaging()
      : admin.messaging();
  } catch (err) {
    // Never take the process down over a misconfigured push channel.
    initError = err;
    console.error("[firebase] failed to initialise Admin SDK:", err.message);
    messaging = null;
  }
  return messaging;
}

/** True when Firebase Admin is configured (push will actually send). */
export function isFirebaseConfigured() {
  return ensureAdmin() !== null;
}

export function getMessagingService() {
  return ensureAdmin();
}

export default { getMessagingService, isFirebaseConfigured };
