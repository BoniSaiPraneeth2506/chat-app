import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../store/useAuthStore";
import { useChatLockStore } from "../store/useChatLockStore";
import LockPasswordPrompt from "./LockPasswordPrompt";
import {
  isBiometryAvailable,
  hasStoredLockSecret,
  clearLockSecret,
  storeLockSecret,
  verifyBiometry,
} from "../lib/biometrics";
import { haptic } from "../lib/haptics";

// Fingerprint unlock toggle, surfaced straight on the Settings page so phone
// owners can find it beside the rest of the privacy controls. It reads the same
// device secret the Locked Chats page uses, so the state always agrees.
//
// Enabling needs the lock to be on (the fingerprint unlocks *that* password) and
// a real scan: the user types the lock password once, it is verified against the
// server, and the fingerprint then releases it from this device.

const FingerprintLockRow = () => {
  const { authUser } = useAuthStore();
  const navigate = useNavigate();
  const { isBusy, error } = useChatLockStore();

  const lockEnabled = Boolean(authUser?.chatLock?.enabled);
  const [bio, setBio] = useState({ available: false, loading: true });
  const [bioOn, setBioOn] = useState(hasStoredLockSecret(authUser?._id));
  const [prompt, setPrompt] = useState(null); // { kind: "enable" }

  useEffect(() => {
    let cancelled = false;
    isBiometryAvailable().then((result) => {
      if (!cancelled) setBio({ available: result?.available || false, loading: false });
    });
    setBioOn(hasStoredLockSecret(authUser?._id));
    return () => { cancelled = true; };
  }, [authUser?._id]);

  const canUse = !bio.loading && bio.available;

  const toggle = async (wanted) => {
    if (!wanted) {
      clearLockSecret(authUser?._id);
      setBioOn(false);
      haptic("tap");
      return;
    }
    if (!bio.available) {
      haptic("error");
      toast.error(bio.loading ? "Checking this device…" : "Fingerprint isn't available on this device");
      return;
    }
    if (!lockEnabled) {
      haptic("error");
      toast("Turn on Locked Chats first", { icon: "🔒" });
      navigate("/settings/locked-chats");
      return;
    }
    setPrompt({ kind: "enable" });
  };

  const handlePrompt = async (typed) => {
    // Verify the password against the server, then ask for the fingerprint and
    // store the password locally so the fingerprint can release it later.
    const ok = await useChatLockStore.getState().unlock(typed);
    if (!ok) return;
    if (!(await verifyBiometry("Confirm to enable fingerprint unlock"))) {
      setPrompt(null);
      return;
    }
    storeLockSecret(authUser._id, typed);
    setBioOn(true);
    setPrompt(null);
    haptic("success");
  };

  return (
    <>
      <div className="w-full flex items-center justify-between gap-4 px-2 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="grid rounded-xl place-items-center size-11 shrink-0 bg-primary/10">
            <Fingerprint size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-medium truncate">Unlock with Fingerprint</span>
            <span className="block text-xs opacity-60 truncate">
              {bioOn
                ? "Fingerprint unlocks your locked chats"
                : bio.loading
                  ? "Checking this device…"
                  : bio.available
                    ? "Open locked chats with your fingerprint"
                    : "Not available on this device"}
            </span>
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm shrink-0"
          checked={bioOn}
          disabled={!canUse && !bioOn}
          onChange={(e) => toggle(e.target.checked)}
        />
      </div>

      {prompt && (
        <LockPasswordPrompt
          title="Enable fingerprint unlock"
          description="Your lock password is kept on this device and released by your fingerprint."
          confirmLabel="Enable"
          error={error}
          isBusy={isBusy}
          onSubmit={handlePrompt}
          onCancel={() => setPrompt(null)}
        />
      )}
    </>
  );
};

export default FingerprintLockRow;