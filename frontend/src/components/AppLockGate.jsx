import { useEffect, useRef, useState } from "react";
import {
  Fingerprint, Loader, LockKeyhole, Eye, EyeOff, HelpCircle, X, Loader as LoaderSpinner,
} from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import useAppLockStore, { appLockEnabled } from "../store/useAppLockStore";
import {
  isBiometryAvailable,
  verifyBiometry,
  hasStoredAppLockSecret,
  readAppLockSecret,
} from "../lib/biometrics";
import LockPasswordPrompt from "./LockPasswordPrompt";
import { haptic } from "../lib/haptics";
import { setScreenSecure } from "../lib/secureScreen";

// AppLockGate — the launch gate the app lock drops in front of the whole app.
//
// Stays mounted from the App root for the life of the session; it only does
// something the moment the app lock is on AND this launch has not unlocked yet.
// A fresh launch always starts locked (the "unlocked" flag is session-only in
// the store, never persisted), so turning the app lock on anything means the
// next cold start sits behind this screen.
//
// Unlock has two routes, exactly like the chat lock:
//   * fingerprint / face — shown when the phone offers it AND the user stored a
//     secret for it; the stored PIN is released by the phone's own scanner
//   * PIN fallback — the PIN you chose, always available
// plus the security-question recovery you set when enabling (no chat is a black
// hole, and no phone gets permanently locked out).
//
// The gate also flips FLAG_SECURE on under it so the chat list underneath can
// never be captured in a screenshot while the app is locked.

export default function AppLockGate() {
  const { authUser } = useAuthStore();
  const lock = useAppLockStore();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [bioState, setBioState] = useState({ available: false });
  const [bioBusy, setBioBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const inputRef = useRef(null);

  const enabled = appLockEnabled();
  const bioCan = bioState.available && Boolean(authUser?._id) && hasStoredAppLockSecret(authUser?._id);

  useEffect(() => {
    if (!enabled) return;
    setScreenSecure(true);
    isBiometryAvailable().then(setBioState);
    inputRef.current?.focus?.();
    return () => setScreenSecure(false);
  }, [enabled]);

  if (!enabled || lock.isUnlocked) return null;

  const finishUnlock = (ok) => {
    if (!ok) return;
    haptic("success");
    setScreenSecure(false);
    setPin("");
  };

  const useFingerprint = async () => {
    if (!bioCan || bioBusy || bioState.bioStored === false) return;
    setBioBusy(true);
    try {
      const ok = await verifyBiometry("Unlock the app");
      if (ok) finishUnlock(lock.unlockWithSecret(readAppLockSecret(authUser?._id)));
    } catch {
      /* fingerprint cancelled/failed - fall back to PIN */
    } finally {
      setBioBusy(false);
    }
  };

  const handlePrompt = async (answer) => {
    const ok = await lock.recoverWithAnswer(answer);
    if (ok) finishUnlock(true);
  };

  const submitPin = (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    const ok = lock.unlock(pin);
    if (ok) finishUnlock(true);
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-base-100">
      <div className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-base-content">
          <LockKeyhole size={15} className="text-primary" />
          <span>Chatty</span>
        </span>
        {lock.hint && <span className="text-[11px] t-dim">{lock.hint}</span>}
        <button
          type="button"
          onClick={() => lock.relock()}
          className="grid size-9 rounded-full place-items-center hover:bg-base-200 transition-colors"
          aria-label="Lock now"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16 text-center">
        <span className="grid rounded-full size-20 place-items-center bg-primary/15 text-primary">
          <Fingerprint size={30} />
        </span>
        <h1 className="mt-6 text-[21px] font-semibold text-base-content">Chatty is locked</h1>
        <p className="mt-1.5 text-[13.5px] t-muted">
          {bioCan ? "Use your fingerprint or the PIN you set." : "Enter the PIN you set."}
        </p>

        {bioCan && (
          <button
            type="button"
            onClick={useFingerprint}
            disabled={bioBusy}
            className="flex items-center justify-center w-full h-12 gap-2 mt-8 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {bioBusy ? <LoaderSpinner size={15} className="animate-spin" /> : <Fingerprint size={17} />}
            Unlock with fingerprint
          </button>
        )}

        <div className="my-5 text-[11px] uppercase tracking-[0.16em] t-dim">or use your PIN</div>

        <form onSubmit={submitPin} className="w-full max-w-[17rem]">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Your PIN"
              inputMode="numeric"
              autoComplete="off"
              className="field-focus w-full h-12 px-4 pr-11 text-[17px] tracking-[0.35em] text-center rounded-2xl bg-base-200 border-0 text-base-content ph-dim"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
              className="absolute right-3 top-1/2 -translate-y-1/2 t-dim hover:text-base-content"
            >
              {showPin ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>

          {lock.error && <p className="mt-2 text-[12.5px] text-error">{lock.error}</p>}

          <button
            type="submit"
            disabled={!pin.trim() || lock.isBusy}
            className="flex items-center justify-center w-full h-12 gap-2 mt-4 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {lock.isBusy && <LoaderSpinner size={15} className="animate-spin" />}
            Unlock
          </button>
        </form>

        {lock.hint && (
          <button
            type="button"
            onClick={() => setRecovering(true)}
            className="flex items-center justify-center w-full gap-1.5 mt-6 text-[12.5px] t-dim hover:text-base-content transition-colors"
          >
            <HelpCircle size={13} />
            Forgot PIN?
          </button>
        )}
      </div>

      {recovering && (
        <LockPasswordPrompt
          title="Recover your app lock"
          description="Answer the security question you set with the app lock to reset the PIN."
          confirmLabel="Reset PIN"
          error={lock.error || ""}
          isBusy={lock.isBusy}
          onConfirm={handlePrompt}
          onCancel={() => setRecovering(false)}
        />
      )}
    </div>
  );
}
