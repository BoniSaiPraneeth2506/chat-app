import { useEffect, useRef, useState } from "react";
import {
  X, Lock, ArrowLeft, Fingerprint, HelpCircle, Users, Eye, EyeOff, Loader,
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

// The locked-chats screen: password or fingerprint, then the list.
//
// Opened by double-tapping the Chatty wordmark, which is deliberately not a
// visible button — a control labelled "locked chats" announces that there are
// some. Anyone who does not know the gesture sees an ordinary header.

const LockedChatsModal = () => {
  const { authUser } = useAuthStore();
  const { setSelectedUser } = useChatStore();
  const { setSelectedGroup } = useGroupStore();
  const nicknames = useNicknames();
  const {
    isModalOpen, view, isBusy, error, lockedUsers, lockedGroups,
    closeModal, setView, unlock, recover,
  } = useChatLockStore();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [biometry, setBiometry] = useState({ available: false });
  const inputRef = useRef(null);
  const triedBiometry = useRef(false);

  const enabled = Boolean(authUser?.chatLock?.enabled);
  const question = authUser?.chatLock?.securityQuestion || "";
  const canUseBiometry = biometry.available && hasStoredLockSecret(authUser?._id);

  useEffect(() => {
    if (!isModalOpen) return;
    setPassword("");
    setAnswer("");
    setNewPassword("");
    triedBiometry.current = false;
    isBiometryAvailable().then(setBiometry);
  }, [isModalOpen]);

  // Offer the fingerprint straight away when it is set up — being asked to type a
  // password you have already opted out of typing is friction with no purpose.
  useEffect(() => {
    if (!isModalOpen || view !== "locked" || triedBiometry.current) return;
    if (!canUseBiometry) {
      inputRef.current?.focus();
      return;
    }
    triedBiometry.current = true;
    (async () => {
      if (await verifyBiometry()) {
        const secret = readLockSecret(authUser?._id);
        if (secret) {
          haptic("success");
          await unlock(secret);
          return;
        }
      }
      inputRef.current?.focus();
    })();
  }, [isModalOpen, view, canUseBiometry, authUser?._id, unlock]);

  if (!isModalOpen) return null;

  const submitPassword = async (e) => {
    e?.preventDefault?.();
    if (!password.trim()) return;
    const ok = await unlock(password);
    if (ok) {
      haptic("success");
      // Offered only after a correct password, so enabling it cannot store a
      // wrong secret that then fails silently every time.
      if (biometry.available && !hasStoredLockSecret(authUser?._id)) {
        storeLockSecret(authUser._id, password);
      }
      setPassword("");
    } else {
      haptic("reject");
    }
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

  const total = lockedUsers.length + lockedGroups.length;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm cg-fade"
      onClick={(e) => e.target === e.currentTarget && closeModal()}
    >
      <div className="relative bg-base-100 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] cg-sheet sm:cg-dialog overflow-hidden">

        {/* Accent header. The lock is a distinct place in the app, so it gets a
            surface of its own rather than looking like another settings panel. */}
        <div
          className="absolute inset-x-0 top-0 h-28 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 0%, var(--color-primary) 0%, transparent 72%)",
            opacity: 0.14,
          }}
        />

        {/* Header */}
        <div className="relative flex items-center gap-2 px-4 py-3.5">
          {view !== "locked" && (
            <button
              type="button"
              onClick={() => setView("locked")}
              className="p-1.5 rounded-full t-dim hover:text-base-content hover:bg-base-200 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <h3 className="flex items-center flex-1 gap-2 font-semibold text-base-content text-[15px]">
            <Lock size={15} className="text-primary" />
            Locked chats
          </h3>
          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 rounded-full t-dim hover:text-base-content hover:bg-base-200 transition-colors"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Not set up yet */}
        {!enabled && (
          <div className="px-6 pt-2 pb-8 text-center">
            <div className="grid mx-auto rounded-3xl size-16 place-items-center s-tile">
              <Lock size={26} className="text-primary" />
            </div>
            <h4 className="mt-4 text-[17px] font-semibold text-base-content">Chat lock is off</h4>
            <p className="mt-2 text-[14px] leading-relaxed t-muted">
              Turn it on in Settings to keep chosen conversations behind a password.
              They are hidden from the chat list until you unlock them.
            </p>
          </div>
        )}

        {/* Password */}
        {enabled && view === "locked" && (
          <form onSubmit={submitPassword} className="relative px-6 pt-1 pb-7">
            <div className="grid mx-auto rounded-3xl size-16 place-items-center s-tile">
              <Lock size={26} className="text-primary" />
            </div>
            <h4 className="mt-4 text-[17px] font-semibold text-center text-base-content">
              Enter your password
            </h4>
            <p className="mt-1 text-[13.5px] leading-relaxed text-center t-muted">
              These chats stay hidden from your list until you unlock them.
            </p>

            <div className="relative mt-5">
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
                className="absolute -translate-y-1/2 right-3 top-1/2 p-1 rounded-full t-dim hover:text-base-content"
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
                onClick={async () => {
                  if (!(await verifyBiometry())) return;
                  const secret = readLockSecret(authUser?._id);
                  if (!secret) {
                    // Nothing stored yet: the password has to be entered once so
                    // there is something for biometry to release next time.
                    inputRef.current?.focus();
                    return;
                  }
                  await unlock(secret);
                }}
                className="flex items-center justify-center w-full gap-2 mt-3 text-[13.5px] font-medium text-primary"
              >
                <Fingerprint size={16} />
                {canUseBiometry ? "Use fingerprint" : "Enable fingerprint after unlocking once"}
              </button>
            )}

            {question && (
              <button
                type="button"
                onClick={() => setView("recover")}
                className="flex items-center justify-center w-full gap-1.5 mt-4 text-[12.5px] t-dim hover:text-base-content transition-colors"
              >
                <HelpCircle size={13} />
                Forgot password?
              </button>
            )}
          </form>
        )}

        {/* Recovery */}
        {enabled && view === "recover" && (
          <form onSubmit={submitRecovery} className="px-6 pt-2 pb-7">
            <p className="text-[11px] uppercase tracking-wider font-bold t-faint">Security question</p>
            <p className="mt-1 text-[15px] font-medium text-base-content">{question}</p>

            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer"
              autoComplete="off"
              className="field-focus w-full h-12 px-4 mt-4 text-[15px] rounded-2xl bg-base-200 border-0 text-base-content ph-dim"
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
              className="flex items-center justify-center w-full h-12 gap-2 mt-4 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {isBusy && <Loader size={15} className="animate-spin" />}
              Reset password
            </button>
            <p className="mt-3 text-[11.5px] leading-relaxed text-center t-dim">
              Answers ignore capitals and extra spaces.
            </p>
          </form>
        )}

        {/* The list */}
        {enabled && view === "open" && (
          <div className="pb-4 overflow-y-auto">
            {total === 0 ? (
              <p className="px-6 py-10 text-[14px] text-center t-dim">
                No chats are locked yet. Long-press a chat, or right-click it on a
                computer, and choose Lock.
              </p>
            ) : (
              <>
                {lockedUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => openChat(user, false)}
                    className="flex items-center w-full gap-3 px-5 py-3 text-left s-row"
                  >
                    <img
                      src={user.profilePic || "/avatar.png"}
                      alt=""
                      className="object-cover rounded-full size-11 shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium truncate text-base-content">
                        {displayNameOf(user, nicknames)}
                      </span>
                      <span className="flex items-center gap-1 text-[12.5px] t-dim">
                        <Lock size={10} />
                        Locked chat
                      </span>
                    </span>
                    {user.unreadCount > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] leading-none font-bold text-white bg-primary rounded-full">
                        {user.unreadCount}
                      </span>
                    )}
                  </button>
                ))}

                {lockedGroups.map((group) => (
                  <button
                    key={group._id}
                    type="button"
                    onClick={() => openChat(group, true)}
                    className="flex items-center w-full gap-3 px-5 py-3 text-left s-row"
                  >
                    {group.groupPic ? (
                      <img src={group.groupPic} alt="" className="object-cover rounded-full size-11 shrink-0" />
                    ) : (
                      <span className="grid rounded-full size-11 place-items-center bg-base-300 text-base-content shrink-0">
                        <Users size={18} />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium truncate text-base-content">{group.name}</span>
                      <span className="block text-[12.5px] t-dim">
                        {group.memberCount || 0} members · Locked group
                      </span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LockedChatsModal;
