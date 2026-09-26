import { useEffect, useState } from "react";
import { Fingerprint, Loader } from "lucide-react";
import toast from "react-hot-toast";
import useAuthStore from "../store/useAuthStore";
import useAppLockStore from "../store/useAppLockStore";
import {
  isBiometryAvailable,
  hasStoredAppLockSecret,
  clearAppLockSecret,
  storeAppLockSecret,
  verifyBiometry,
} from "../lib/biometrics";
import { haptic } from "../lib/haptics";

const field =
  "field-focus w-full h-11 px-3.5 text-sm rounded-xl bg-base-200 border-0 text-base-content ph-dim";

// Fingerprint unlock for the app itself, surfaced straight on the Settings page
// beside the rest of the privacy controls.
//
// Turning this on sets up the app lock: a PIN (so a phone without a working
// sensor is never locked out) plus a security question as the way back in. The
// fingerprint is verified with a real scan and the app-lock PIN is then stored
// on the device, released only by that same fingerprint. From then on, opening
// the app from the phone menu asks for the fingerprint first.

const FingerprintLockRow = () => {
  const { authUser } = useAuthStore();
  const lock = useAppLockStore();
  const appOn = useAppLockStore((s) => s.on);

  const [bio, setBio] = useState({ available: false, loading: true });
  const [expanded, setExpanded] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [localError, setLocalError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isBiometryAvailable().then((result) => {
      if (!cancelled) setBio({ available: result?.available || false, loading: false });
    });
    return () => { cancelled = true; };
  }, []);

  const bioOn = appOn && Boolean(authUser?._id) && hasStoredAppLockSecret(authUser._id);

  const resetFields = () => {
    setPin("");
    setPin2("");
    setQuestion("");
    setAnswer("");
    setLocalError("");
  };

  const toggle = (wanted) => {
    if (wanted) {
      if (!bio.available) {
        haptic("error");
        toast.error(bio.loading ? "Checking this device…" : "Fingerprint isn't available on this device");
        return;
      }
      setLocalError("");
      setExpanded(true);
      return;
    }
    clearAppLockSecret(authUser?._id);
    lock.disable();
    setExpanded(false);
    resetFields();
    haptic("tap");
    toast.success("App lock turned off");
  };

  const onEnable = async (e) => {
    e.preventDefault();
    if (pin.length < 4) {
      setLocalError("PIN must be at least 4 digits");
      return;
    }
    if (pin !== pin2) {
      setLocalError("PINs do not match");
      return;
    }
    if (!question.trim() || !answer.trim()) {
      setLocalError("Security question and answer are required to get back in if you forget the PIN");
      return;
    }

    setSaving(true);
    const enabled = lock.enable({ pin, hint: "", question, answer });
    if (!enabled) {
      setSaving(false);
      return;
    }

    // The app-lock PIN is stored so the fingerprint has something to release; a
    // real scan proves the device owner is here to enable it.
    const ok = await verifyBiometry("Confirm to enable fingerprint unlock");
    if (!ok) {
      lock.disable();
      setSaving(false);
      setLocalError("Fingerprint not confirmed — try again");
      return;
    }

    storeAppLockSecret(authUser._id, pin);
    lock.setBioStored(true);
    setSaving(false);
    setExpanded(false);
    resetFields();
    haptic("success");
    toast.success("App lock is on — fingerprint opens the app");
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
                ? "Fingerprint opens the app"
                : bio.loading
                  ? "Checking this device…"
                  : bio.available
                    ? "Open the app from the phone menu with your fingerprint"
                    : "Not available on this device"}
            </span>
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm shrink-0"
          checked={bioOn || expanded}
          onChange={(e) => toggle(e.target.checked)}
        />
      </div>

      {expanded && (
        <form onSubmit={onEnable} className="p-3.5 space-y-2.5 rounded-xl s-chip">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN (at least 4 digits)"
            inputMode="numeric"
            autoComplete="new-password"
            className={field}
          />
          <input
            type="password"
            value={pin2}
            onChange={(e) => setPin2(e.target.value)}
            placeholder="Re-enter PIN"
            inputMode="numeric"
            autoComplete="new-password"
            className={field}
          />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Security question, e.g. My first school?"
            className={field}
          />
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
            className={field}
          />
          <p className="text-[10px] leading-relaxed t-dim">
            Opening the app will ask for your fingerprint. The PIN is the fallback when the
            sensor cannot read, and the question is how you get back in if you forget it.
          </p>
          {(localError || lock.error) && <p className="text-[11px] text-error">{localError || lock.error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setExpanded(false); resetFields(); }}
              className="flex-1 h-10 rounded-xl bg-base-200 text-[12.5px] font-semibold text-base-content"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center flex-1 h-10 gap-2 rounded-xl bg-primary text-primary-content text-[12.5px] font-semibold disabled:opacity-40"
            >
              {saving && <Loader size={13} className="animate-spin" />}
              Turn on
            </button>
          </div>
        </form>
      )}
    </>
  );
};

export default FingerprintLockRow;