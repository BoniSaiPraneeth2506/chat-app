import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";

// Phone biometrics for the chat lock.
//
// A fingerprint cannot hand back a password — it only proves the person at the
// device is the owner. So opting in stores the lock password on the device and
// biometry gates access to it.
//
// That tradeoff is worth stating plainly: with biometric unlock enabled, the lock
// password sits in the browser's storage for this account, protected by the
// device rather than by the password itself. Anyone able to read that storage
// (an unlocked, rooted, or debug-enabled phone) can read it. It is off unless the
// user turns it on, and turning it off erases the stored copy.
//
// The alternative — a device-bound token from the server — would still be a
// secret at rest on the same device, so it trades the same risk with more moving
// parts.

const keyFor = (userId) => `chatLockBio:${userId}`;

export const isBiometryAvailable = async () => {
  if (Capacitor.getPlatform() !== "android") return { available: false, reason: "not a device" };
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      available: Boolean(result?.isAvailable),
      type: result?.biometryType,
      reason: result?.isAvailable ? "" : "no biometry enrolled",
    };
  } catch (err) {
    return { available: false, reason: err?.message || "unavailable" };
  }
};

/**
 * Prompts for a fingerprint or face.
 *
 * The device PIN is allowed as a fallback: refusing it would strand anyone whose
 * sensor fails to read, and the PIN is the same credential the phone already
 * trusts to unlock itself.
 */
export const verifyBiometry = async (reason = "Unlock your locked chats") => {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      androidTitle: "Locked chats",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    // Cancelled, failed, or locked out. The caller falls back to the password,
    // so there is nothing useful to report here.
    return false;
  }
};

export const hasStoredLockSecret = (userId) => {
  if (!userId) return false;
  try {
    return Boolean(localStorage.getItem(keyFor(userId)));
  } catch {
    return false;
  }
};

export const storeLockSecret = (userId, password) => {
  if (!userId || !password) return;
  try {
    localStorage.setItem(keyFor(userId), password);
  } catch {
    // Storage unavailable (private mode, quota). Biometric unlock simply stays
    // unavailable; the password still works.
  }
};

export const readLockSecret = (userId) => {
  if (!userId) return "";
  try {
    return localStorage.getItem(keyFor(userId)) || "";
  } catch {
    return "";
  }
};

export const clearLockSecret = (userId) => {
  if (!userId) return;
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // Nothing to do.
  }
};
