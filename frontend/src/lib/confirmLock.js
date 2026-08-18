import toast from "react-hot-toast";
import { verifyBiometry, isBiometryAvailable, readLockSecret, hasStoredLockSecret } from "./biometrics";

// Confirming identity before moving a chat into or out of the lock.
//
// Locking is a privacy action, so it should not be one stray tap away — someone
// with the phone open could otherwise hide a conversation, or worse, reveal one.
//
// Biometry is preferred when it is set up, because it is both stronger and
// quicker than typing. Where it is not, the lock password is asked for. The
// password is verified by the server through the unlock endpoint rather than
// compared here, so a client cannot talk itself into a yes.

/**
 * Returns true when the user has proved they may change the lock.
 *
 * `verifyPassword` is injected rather than imported so this helper stays free of
 * store dependencies and can be used from anywhere in the tree.
 */
export const confirmLockAccess = async ({ userId, verifyPassword }) => {
  const biometry = await isBiometryAvailable();

  if (biometry.available && hasStoredLockSecret(userId)) {
    if (await verifyBiometry("Confirm to change the lock on this chat")) return true;
    // Falling through to the password rather than failing: a sensor that will not
    // read should not make the feature unusable.
  }

  const stored = readLockSecret(userId);
  const typed = window.prompt(
    stored
      ? "Confirm your chat lock password"
      : "Enter your chat lock password to lock or unlock this chat"
  );
  if (typed === null) return false; // cancelled
  if (!typed.trim()) {
    toast.error("Password is required");
    return false;
  }

  const ok = await verifyPassword(typed);
  if (!ok) toast.error("Wrong password");
  return ok;
};
