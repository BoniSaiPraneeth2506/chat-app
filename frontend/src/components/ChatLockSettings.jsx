import { useEffect, useState } from "react";
import { Fingerprint, Loader, ChevronRight, MousePointerClick } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatLockStore } from "../store/useChatLockStore";
import LockPasswordPrompt from "./LockPasswordPrompt";
import {
  isBiometryAvailable, hasStoredLockSecret, clearLockSecret, storeLockSecret, verifyBiometry,
} from "../lib/biometrics";
import { haptic } from "../lib/haptics";

// Chat lock controls, styled to sit beside the other privacy toggles.
//
// Both switches are real toggles rather than buttons, because that is what every
// other row in this section is and a lone "Turn on" button read as a different
// kind of control. Turning either one off is what needs confirming, so the
// password is asked for then — not as a precondition for touching the switch.

const field =
  "field-focus w-full h-11 px-3.5 text-sm rounded-xl bg-base-200 border-0 text-base-content ph-dim";

const row = "flex items-center justify-between gap-3 p-3.5 rounded-xl border";
const rowStyle = { borderColor: "var(--color-base-300)" };

const ChatLockSettings = () => {
  const { authUser } = useAuthStore();
  const { setup, changePassword, disable, isBusy, error } = useChatLockStore();

  const enabled = Boolean(authUser?.chatLock?.enabled);
  const lockedCount =
    (authUser?.lockedChats?.length || 0) + (authUser?.lockedGroups?.length || 0);

  const [expanded, setExpanded] = useState(false); // the setup form
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [changing, setChanging] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [prompt, setPrompt] = useState(null); // { kind, title, description, confirmLabel }
  const [biometry, setBiometry] = useState({ available: false });
  const [bioOn, setBioOn] = useState(false);

  useEffect(() => {
    isBiometryAvailable().then(setBiometry);
    setBioOn(hasStoredLockSecret(authUser?._id));
  }, [authUser?._id]);

  const resetSetup = () => {
    setExpanded(false);
    setPassword("");
    setQuestion("");
    setAnswer("");
  };

  const onSetup = async (e) => {
    e.preventDefault();
    const ok = await setup({ password, securityQuestion: question, securityAnswer: answer });
    if (ok) {
      haptic("success");
      resetSetup();
    }
  };

  const onChange = async (e) => {
    e.preventDefault();
    setPrompt({
      kind: "change",
      title: "Confirm your current password",
      description: "Then your new password will be saved.",
      confirmLabel: "Change",
    });
  };

  const handlePrompt = async (typed) => {
    if (prompt.kind === "change") {
      const ok = await changePassword({ currentPassword: typed, newPassword });
      if (!ok) return;
      // A stored secret for fingerprint unlock is the old password now, so it has
      // to be rewritten or the fingerprint would quietly stop working.
      if (hasStoredLockSecret(authUser?._id)) storeLockSecret(authUser._id, newPassword);
      setChanging(false);
      setNewPassword("");
      setPrompt(null);
      haptic("success");
      return;
    }

    if (prompt.kind === "disable") {
      const ok = await disable(typed);
      if (!ok) return;
      clearLockSecret(authUser?._id);
      setBioOn(false);
      setPrompt(null);
      return;
    }

    if (prompt.kind === "biometric") {
      // The password is stored so a fingerprint has something to release; it is
      // verified against the server first so a typo cannot be saved as the secret.
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
    }
  };

  const toggleLock = (wanted) => {
    if (wanted) {
      setExpanded(true);
      return;
    }
    setPrompt({
      kind: "disable",
      title: "Turn off chat lock",
      description: "Every locked chat returns to your normal list. Nothing is deleted.",
      confirmLabel: "Turn off",
    });
  };

  const toggleBiometric = (wanted) => {
    if (!wanted) {
      clearLockSecret(authUser._id);
      setBioOn(false);
      return;
    }
    setPrompt({
      kind: "biometric",
      title: "Enable fingerprint unlock",
      description:
        "Your lock password is kept on this device and released by your fingerprint. Turning this off erases it.",
      confirmLabel: "Enable",
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2.5 p-3 rounded-xl s-chip">
        <MousePointerClick size={14} className="mt-px text-primary shrink-0" />
        <p className="text-[11px] leading-relaxed t-muted">
          <span className="font-semibold text-base-content">Double-tap the Chatty logo</span> in
          the top bar to open your locked chats. There is no other entry point, so nothing on the
          home screen hints that they exist.
        </p>
      </div>

      {/* Main switch */}
      <div className={row} style={rowStyle}>
        <div className="space-y-0.5 min-w-0">
          <span className="text-xs font-semibold">Locked Chats</span>
          <p className="text-[10px] opacity-70">
            {enabled
              ? `${lockedCount} ${lockedCount === 1 ? "chat" : "chats"} hidden · double-tap the Chatty logo to open`
              : "Hide chosen chats behind a separate password"}
          </p>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm shrink-0"
          checked={enabled || expanded}
          onChange={(e) => toggleLock(e.target.checked)}
        />
      </div>

      {/* Setup, inline under the switch it belongs to */}
      {!enabled && expanded && (
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetSetup}
              className="flex-1 h-10 rounded-xl bg-base-200 text-[12.5px] font-semibold text-base-content"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy || !password.trim() || !question.trim() || !answer.trim()}
              className="flex items-center justify-center flex-1 h-10 gap-2 rounded-xl bg-primary text-primary-content text-[12.5px] font-semibold disabled:opacity-40"
            >
              {isBusy && <Loader size={13} className="animate-spin" />}
              Turn on
            </button>
          </div>
        </form>
      )}

      {enabled && (
        <>
          {biometry.available && (
            <div className={row} style={rowStyle}>
              <div className="space-y-0.5 min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Fingerprint size={12} className="text-primary" />
                  Unlock with fingerprint
                </span>
                <p className="text-[10px] opacity-70">
                  Keeps the lock password on this device, released by your fingerprint
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

          <button
            type="button"
            onClick={() => setChanging((v) => !v)}
            className={`${row} w-full text-left s-row`}
            style={rowStyle}
          >
            <span className="space-y-0.5 min-w-0">
              <span className="block text-xs font-semibold">Change lock password</span>
              <span className="block text-[10px] opacity-70">
                You will confirm the current one
              </span>
            </span>
            <ChevronRight
              size={15}
              className={`t-dim shrink-0 transition-transform ${changing ? "rotate-90" : ""}`}
            />
          </button>

          {changing && (
            <form onSubmit={onChange} className="p-3.5 space-y-2.5 rounded-xl s-chip">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New lock password"
                autoComplete="new-password"
                className={field}
              />
              <button
                type="submit"
                disabled={!newPassword.trim()}
                className="w-full h-10 rounded-xl bg-primary text-primary-content text-[12.5px] font-semibold disabled:opacity-40"
              >
                Continue
              </button>
            </form>
          )}
        </>
      )}

      {prompt && (
        <LockPasswordPrompt
          title={prompt.title}
          description={prompt.description}
          confirmLabel={prompt.confirmLabel}
          error={error}
          isBusy={isBusy}
          onSubmit={handlePrompt}
          onCancel={() => setPrompt(null)}
        />
      )}
    </div>
  );
};

export default ChatLockSettings;
