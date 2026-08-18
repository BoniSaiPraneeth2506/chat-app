import { useEffect, useState } from "react";
import { Lock, Fingerprint, Loader, ShieldCheck } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatLockStore } from "../store/useChatLockStore";
import {
  isBiometryAvailable, hasStoredLockSecret, clearLockSecret, storeLockSecret, verifyBiometry,
} from "../lib/biometrics";
import { haptic } from "../lib/haptics";

// Chat lock controls for the settings screen.
//
// Kept as its own component rather than more markup inside SettingsPage: it holds
// three separate forms and its own state, and folding that into a page that is
// otherwise a list of toggles would bury it.
//
// The security question is required when turning the lock on, not offered
// afterwards, because the moment it is needed is the moment the user cannot get
// in to add one.

const field =
  "field-focus w-full h-11 px-3.5 text-sm rounded-xl bg-base-200 border-0 text-base-content ph-dim";

const ChatLockSettings = () => {
  const { authUser } = useAuthStore();
  const { setup, changePassword, disable, isBusy, error } = useChatLockStore();

  const enabled = Boolean(authUser?.chatLock?.enabled);
  const lockedCount =
    (authUser?.lockedChats?.length || 0) + (authUser?.lockedGroups?.length || 0);

  const [mode, setMode] = useState(null); // null | "setup" | "change" | "disable"
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [biometry, setBiometry] = useState({ available: false });
  const [bioOn, setBioOn] = useState(false);

  useEffect(() => {
    isBiometryAvailable().then(setBiometry);
    setBioOn(hasStoredLockSecret(authUser?._id));
  }, [authUser?._id]);

  const reset = () => {
    setMode(null);
    setPassword("");
    setQuestion("");
    setAnswer("");
    setCurrentPassword("");
  };

  const onSetup = async (e) => {
    e.preventDefault();
    const ok = await setup({ password, securityQuestion: question, securityAnswer: answer });
    if (ok) {
      haptic("success");
      reset();
    }
  };

  const onChange = async (e) => {
    e.preventDefault();
    const ok = await changePassword({ currentPassword, newPassword: password });
    if (ok) {
      haptic("success");
      // A stored secret for biometric unlock is now the old password, so it has
      // to be replaced or the fingerprint would silently stop working.
      if (hasStoredLockSecret(authUser?._id)) storeLockSecret(authUser._id, password);
      reset();
    }
  };

  const onDisable = async (e) => {
    e.preventDefault();
    const ok = await disable(currentPassword);
    if (ok) {
      clearLockSecret(authUser?._id);
      setBioOn(false);
      reset();
    }
  };

  const toggleBiometric = async (wanted) => {
    if (!wanted) {
      clearLockSecret(authUser._id);
      setBioOn(false);
      return;
    }
    // Enabling needs the password once, because a fingerprint cannot produce one —
    // it only releases what is already stored on the device.
    const typed = window.prompt("Enter your chat lock password to enable fingerprint unlock");
    if (!typed?.trim()) return;
    if (!(await verifyBiometry("Confirm to enable fingerprint unlock"))) return;
    const ok = await useChatLockStore.getState().unlock(typed);
    if (!ok) return;
    storeLockSecret(authUser._id, typed);
    setBioOn(true);
    haptic("success");
  };

  return (
    <div className="space-y-2.5">
      <div
        className="flex items-center justify-between p-3.5 rounded-xl border"
        style={{ borderColor: "var(--color-base-300)" }}
      >
        <div className="space-y-0.5 min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Lock size={12} className="text-primary" />
            Locked Chats
          </span>
          <p className="text-[10px] opacity-70">
            {enabled
              ? `On · ${lockedCount} ${lockedCount === 1 ? "chat" : "chats"} hidden from your list`
              : "Hide chosen chats behind a separate password"}
          </p>
        </div>
        {enabled ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-primary shrink-0">
            <ShieldCheck size={12} />
            Active
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setMode(mode === "setup" ? null : "setup")}
            className="px-3 h-8 rounded-lg bg-primary text-primary-content text-[11px] font-semibold active:scale-95 transition-transform shrink-0"
          >
            {mode === "setup" ? "Cancel" : "Turn on"}
          </button>
        )}
      </div>

      {/* Turning it on */}
      {!enabled && mode === "setup" && (
        <form onSubmit={onSetup} className="p-3.5 space-y-2.5 rounded-xl s-chip">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Lock password (at least 4 characters)"
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
            The question is how you get back in if you forget the password, so it is
            required now. Answers ignore capitals and extra spaces.
          </p>
          {error && <p className="text-[11px] text-error">{error}</p>}
          <button
            type="submit"
            disabled={isBusy || !password.trim() || !question.trim() || !answer.trim()}
            className="flex items-center justify-center w-full h-10 gap-2 rounded-xl bg-primary text-primary-content text-[12.5px] font-semibold disabled:opacity-40"
          >
            {isBusy && <Loader size={13} className="animate-spin" />}
            Turn on chat lock
          </button>
        </form>
      )}

      {/* Managing it */}
      {enabled && (
        <>
          {biometry.available && (
            <div
              className="flex items-center justify-between p-3.5 rounded-xl border"
              style={{ borderColor: "var(--color-base-300)" }}
            >
              <div className="space-y-0.5 min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Fingerprint size={12} className="text-primary" />
                  Unlock with fingerprint
                </span>
                <p className="text-[10px] opacity-70">
                  Stores the lock password on this device, released by your fingerprint
                </p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm shrink-0"
                checked={bioOn}
                onChange={(e) => toggleBiometric(e.target.checked)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === "change" ? null : "change")}
              className="flex-1 h-9 rounded-lg s-chip text-[11.5px] font-semibold text-base-content"
            >
              Change password
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "disable" ? null : "disable")}
              className="flex-1 h-9 rounded-lg s-chip text-[11.5px] font-semibold text-error"
            >
              Turn off
            </button>
          </div>

          {mode === "change" && (
            <form onSubmit={onChange} className="p-3.5 space-y-2.5 rounded-xl s-chip">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current lock password"
                autoComplete="current-password"
                className={field}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New lock password"
                autoComplete="new-password"
                className={field}
              />
              {error && <p className="text-[11px] text-error">{error}</p>}
              <button
                type="submit"
                disabled={isBusy || !currentPassword.trim() || !password.trim()}
                className="w-full h-10 rounded-xl bg-primary text-primary-content text-[12.5px] font-semibold disabled:opacity-40"
              >
                Save new password
              </button>
            </form>
          )}

          {mode === "disable" && (
            <form onSubmit={onDisable} className="p-3.5 space-y-2.5 rounded-xl s-chip">
              <p className="text-[11px] leading-relaxed t-muted">
                Every locked chat returns to your normal list. Nothing is deleted.
              </p>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Lock password"
                autoComplete="current-password"
                className={field}
              />
              {error && <p className="text-[11px] text-error">{error}</p>}
              <button
                type="submit"
                disabled={isBusy || !currentPassword.trim()}
                className="w-full h-10 rounded-xl bg-error text-error-content text-[12.5px] font-semibold disabled:opacity-40"
              >
                Turn off chat lock
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default ChatLockSettings;
