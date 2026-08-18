import { useEffect, useRef, useState } from "react";
import {
  X, Lock, LockOpen, ArrowLeft, Fingerprint, HelpCircle, Users, Eye, EyeOff, Loader,
} from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useChatLockStore } from "../store/useChatLockStore";
import {
  isBiometryAvailable, verifyBiometry, hasStoredLockSecret, readLockSecret, storeLockSecret,
} from "../lib/biometrics";
import { useNicknames, displayNameOf } from "../lib/contacts";
import { haptic } from "../lib/haptics";

// The locked chats screen.
//
// A full-screen surface rather than a sheet: it is a chat list, and a list of
// conversations pinned to the bottom of a small panel behaves nothing like the
// one it stands in for. The header is fixed, the list scrolls under it from the
// top, and Back returns to the app.
//
// Reached by double-tapping the Chatty wordmark, which is deliberately unlabelled
// — a visible "locked chats" control announces that some exist.

const LockedChatsModal = () => {
  const { authUser } = useAuthStore();
  const { setSelectedUser } = useChatStore();
  const { setSelectedGroup } = useGroupStore();
  const nicknames = useNicknames();
  const {
    isModalOpen, view, isBusy, error, lockedUsers, lockedGroups,
    closeModal, setView, unlock, recover, releaseChat,
  } = useChatLockStore();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [biometry, setBiometry] = useState({ available: false });
  const [rowMenu, setRowMenu] = useState(null); // { id, type, name }
  const inputRef = useRef(null);
  const pressTimer = useRef(null);

  const enabled = Boolean(authUser?.chatLock?.enabled);
  const question = authUser?.chatLock?.securityQuestion || "";
  const canUseBiometry = biometry.available && hasStoredLockSecret(authUser?._id);

  useEffect(() => {
    if (!isModalOpen) return;
    setPassword("");
    setAnswer("");
    setNewPassword("");
    setRowMenu(null);
    isBiometryAvailable().then(setBiometry);
  }, [isModalOpen]);

  // The password field takes focus so the keyboard is up and ready. Biometry is
  // no longer offered automatically: prompting for a fingerprint the moment the
  // screen opens takes over the display before the user has chosen how to get in,
  // so it now happens only when the fingerprint button is tapped.
  useEffect(() => {
    if (!isModalOpen || view !== "locked") return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isModalOpen, view]);

  if (!isModalOpen) return null;

  const finishUnlock = (ok, secret) => {
    if (!ok) {
      haptic("reject");
      return;
    }
    haptic("success");
    // Stored only after the server accepted it, so a typo can never be saved as
    // the secret and then fail silently on every future attempt.
    if (secret && biometry.available && !hasStoredLockSecret(authUser?._id)) {
      storeLockSecret(authUser._id, secret);
    }
    setPassword("");
  };

  const submitPassword = async (e) => {
    e?.preventDefault?.();
    if (!password.trim()) return;
    finishUnlock(await unlock(password), password);
  };

  const useFingerprint = async () => {
    if (!(await verifyBiometry())) return;
    const secret = readLockSecret(authUser?._id);
    if (!secret) {
      // Nothing stored yet: the password has to be entered once so there is
      // something for the fingerprint to release next time.
      inputRef.current?.focus();
      return;
    }
    finishUnlock(await unlock(secret));
  };

  const submitRecovery = async (e) => {
    e?.preventDefault?.();
    if (!answer.trim() || !newPassword.trim()) return;
    await recover({ securityAnswer: answer, newPassword });
  };

  const openChat = (item, isGroup) => {
    haptic("tap");
    if (isGroup) {
      setSelectedUser(null);
      setSelectedGroup(item);
    } else {
      setSelectedGroup(null);
      setSelectedUser(item);
    }
    closeModal();
  };

  // Long-press, or right-click on a computer, offers to release the chat. No
  // password is asked for: getting to this screen already required it, and
  // asking again per chat would make releasing several a chore.
  const startPress = (target) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      haptic("longPress");
      setRowMenu(target);
    }, 550);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  const release = async () => {
    const target = rowMenu;
    setRowMenu(null);
    await releaseChat(target.id, target.type);
  };

  const total = lockedUsers.length + lockedGroups.length;

  const row = (key, { avatar, fallback, title, subtitle, time, unread, onOpen, press }) => (
    <button
      key={key}
      type="button"
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        setRowMenu(press);
      }}
      onTouchStart={() => startPress(press)}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onTouchCancel={cancelPress}
      className="flex items-center w-full gap-3 px-4 min-h-[72px] text-left s-row select-none"
    >
      {avatar ? (
        <img src={avatar} alt="" className="object-cover rounded-full size-12 shrink-0" />
      ) : (
        <span className="grid rounded-full size-12 place-items-center bg-base-300 text-base-content shrink-0">
          {fallback}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium truncate text-base-content">{title}</span>
          {time && <span className="text-xs leading-none t-dim shrink-0">{time}</span>}
        </span>
        <span className="flex items-center justify-between gap-2 mt-1">
          <span className="flex items-center gap-1 text-sm truncate t-dim">
            <Lock size={10} className="shrink-0" />
            {subtitle}
          </span>
          {unread > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] leading-none font-bold text-white bg-primary rounded-full shrink-0">
              {unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-base-100 cg-fade">
      {/* Fixed header. The accent wash marks this out as its own place in the app
          rather than another settings panel. */}
      <div className="relative shrink-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 160% at 50% 0%, var(--color-primary) 0%, transparent 74%)",
            opacity: 0.14,
          }}
        />
        <div className="relative flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button
            type="button"
            onClick={() => (view === "recover" ? setView("locked") : closeModal())}
            className="p-2 rounded-full t-dim hover:text-base-content hover:bg-base-200 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold text-base-content">
              <Lock size={15} className="text-primary" />
              Locked chats
            </h2>
            {view === "open" && (
              <p className="text-[12px] t-dim">
                {total} {total === 1 ? "conversation" : "conversations"} · long-press to unlock
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-full t-dim hover:text-base-content hover:bg-base-200 transition-colors"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      {/* Body fills the rest of the screen */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!enabled && (
          <div className="px-8 pt-16 text-center">
            <div className="grid mx-auto rounded-3xl size-16 place-items-center s-tile">
              <Lock size={26} className="text-primary" />
            </div>
            <h3 className="mt-5 text-[18px] font-semibold text-base-content">Chat lock is off</h3>
            <p className="mt-2 text-[14px] leading-relaxed t-muted">
              Turn it on in Settings to keep chosen conversations behind a password.
              They stay hidden from your chat list until you unlock them.
            </p>
          </div>
        )}

        {enabled && view === "locked" && (
          <form onSubmit={submitPassword} className="max-w-sm px-6 pt-10 mx-auto">
            <div className="grid mx-auto rounded-3xl size-16 place-items-center s-tile">
              <Lock size={26} className="text-primary" />
            </div>
            <h3 className="mt-5 text-[18px] font-semibold text-center text-base-content">
              Enter your password
            </h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-center t-muted">
              These conversations stay hidden until you unlock them.
            </p>

            <div className="relative mt-6">
              <input
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Lock password"
                autoComplete="off"
                className="field-focus w-full h-12 px-4 pr-11 text-[15px] rounded-2xl bg-base-200 border-0 text-base-content ph-dim"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute p-1 -translate-y-1/2 rounded-full right-3 top-1/2 t-dim hover:text-base-content"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}

            <button
              type="submit"
              disabled={isBusy || !password.trim()}
              className="flex items-center justify-center w-full h-12 gap-2 mt-4 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {isBusy && <Loader size={15} className="animate-spin" />}
              Unlock
            </button>

            {biometry.available && (
              <button
                type="button"
                onClick={useFingerprint}
                className="flex items-center justify-center w-full h-11 gap-2 mt-2.5 rounded-2xl s-chip text-[14px] font-semibold text-base-content active:scale-[0.98] transition-transform"
              >
                <Fingerprint size={17} className="text-primary" />
                {canUseBiometry ? "Use fingerprint" : "Set up fingerprint"}
              </button>
            )}

            {question && (
              <button
                type="button"
                onClick={() => setView("recover")}
                className="flex items-center justify-center w-full gap-1.5 mt-6 text-[12.5px] t-dim hover:text-base-content transition-colors"
              >
                <HelpCircle size={13} />
                Forgot password?
              </button>
            )}
          </form>
        )}

        {enabled && view === "recover" && (
          <form onSubmit={submitRecovery} className="max-w-sm px-6 pt-10 mx-auto">
            <p className="text-[11px] uppercase tracking-wider font-bold t-faint">Security question</p>
            <p className="mt-1 text-[16px] font-medium text-base-content">{question}</p>

            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer"
              autoComplete="off"
              className="field-focus w-full h-12 px-4 mt-5 text-[15px] rounded-2xl bg-base-200 border-0 text-base-content ph-dim"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New lock password"
              autoComplete="new-password"
              className="field-focus w-full h-12 px-4 mt-2.5 text-[15px] rounded-2xl bg-base-200 border-0 text-base-content ph-dim"
            />

            {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}

            <button
              type="submit"
              disabled={isBusy || !answer.trim() || !newPassword.trim()}
              className="flex items-center justify-center w-full h-12 gap-2 mt-4 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold disabled:opacity-40"
            >
              {isBusy && <Loader size={15} className="animate-spin" />}
              Reset password
            </button>
            <p className="mt-3 text-[11.5px] leading-relaxed text-center t-dim">
              Answers ignore capitals and extra spaces.
            </p>
          </form>
        )}

        {enabled && view === "open" && (
          <div className="pb-6">
            {total === 0 ? (
              <p className="px-8 py-16 text-[14px] leading-relaxed text-center t-dim">
                No chats are locked yet. Long-press a chat in your list, or right-click
                it on a computer, and choose Lock.
              </p>
            ) : (
              <>
                {lockedUsers.map((user) =>
                  row(user._id, {
                    avatar: user.profilePic || "/avatar.png",
                    title: displayNameOf(user, nicknames),
                    subtitle: "Locked chat",
                    time: "",
                    unread: user.unreadCount || 0,
                    onOpen: () => openChat(user, false),
                    press: { id: user._id, type: "user", name: displayNameOf(user, nicknames) },
                  })
                )}
                {lockedGroups.map((group) =>
                  row(group._id, {
                    avatar: group.groupPic || "",
                    fallback: <Users size={19} />,
                    title: group.name,
                    subtitle: `${group.memberCount || 0} members`,
                    unread: 0,
                    onOpen: () => openChat(group, true),
                    press: { id: group._id, type: "group", name: group.name },
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Release confirmation */}
      {rowMenu && (
        <div
          className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm cg-fade"
          onClick={(e) => e.target === e.currentTarget && setRowMenu(null)}
        >
          <div className="bg-base-100 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl cg-sheet sm:cg-dialog overflow-hidden">
            <div className="flex items-start gap-3 px-5 pt-5">
              <span className="grid rounded-2xl size-10 place-items-center s-tile shrink-0">
                <LockOpen size={17} className="text-primary" />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-[15px] font-semibold text-base-content">Unlock this chat?</h3>
                <p className="mt-1 text-[13px] leading-relaxed t-muted">
                  {rowMenu.name} moves back to your normal chat list and stops being
                  hidden.
                </p>
              </div>
            </div>
            <div className="flex gap-2 px-5 pt-4 pb-5">
              <button
                type="button"
                onClick={() => setRowMenu(null)}
                className="flex-1 h-11 rounded-2xl s-chip text-[14px] font-semibold text-base-content"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={release}
                className="flex-1 h-11 rounded-2xl bg-primary text-primary-content text-[14px] font-semibold active:scale-[0.98] transition-transform"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockedChatsModal;
