import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useState, useEffect, useRef } from "react";
import { MessageSquare, Settings, User, Laptop, ShieldOff, UserPlus, Info } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatLockStore } from "../store/useChatLockStore";
import { haptic } from "../lib/haptics";

const Navbar = () => {
  const { authUser, savedAccounts, switchAccount, forgetSavedAccount, refreshSavedAccounts } = useAuthStore();
  const [isSwitching, setIsSwitching] = useState(false);
  const lastWordmarkTap = useRef(0);
  const forgetTimer = useRef(null);

  // Removing a saved account is rare and irreversible on this device, so it lives
  // behind a press-and-hold (or right-click) rather than a permanent button.
  const cancelForgetPress = () => {
    if (forgetTimer.current) {
      clearTimeout(forgetTimer.current);
      forgetTimer.current = null;
    }
  };

  const askForget = (acc) => {
    if (window.confirm(`Remove ${acc.fullName || acc.email} from this device? You can sign in again any time.`)) {
      forgetSavedAccount(acc._id);
    }
  };
  const openLockedChats = useChatLockStore((s) => s.openModal);

  // The list is written to localStorage by the auth store, so re-read it
  // whenever the signed-in user changes (login, switch, logout).
  useEffect(() => { refreshSavedAccounts(); }, [authUser?._id, refreshSavedAccounts]);
  const { selectedUser } = useChatStore();
  const { selectedGroup } = useGroupStore();

  return (
    <header
      className={`fixed top-0 z-40 w-full bg-base-100 backdrop-blur-lg bg-base-100/80
        ${selectedUser || selectedGroup ? "hidden lg:block" : "block"}
      `}
    >
      <div className="container h-16 px-4 mx-auto">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-8">
            {/* Double-tap the logo to open the locked chats. The handler sits on
                the link that wraps both the icon and the wordmark, so either half
                responds. Deliberately an unlabelled gesture: a visible control
                reading "locked chats" announces that some exist. A single tap
                still follows the link, so the header behaves exactly as before. */}
            <Link
              to="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-all select-none"
              onClick={(e) => {
                const now = Date.now();
                // Signed out there is nothing to unlock, and the sign-in and
                // create-account screens carry this same header — so a stray
                // double tap there used to raise the locked-chats screen over the
                // form.
                if (authUser && now - lastWordmarkTap.current < 400) {
                  e.preventDefault();
                  lastWordmarkTap.current = 0;
                  haptic("longPress");
                  openLockedChats();
                  return;
                }
                lastWordmarkTap.current = now;
              }}
            >
              <div className="flex items-center justify-center rounded-lg size-9 bg-primary/10">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold">Chatty</h1>
            </Link>
          </div>

          {authUser && (
            <div className="dropdown dropdown-bottom dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="flex items-center justify-center rounded-full overflow-hidden size-9 border border-base-300 hover:opacity-80 transition-opacity cursor-pointer"
                title={authUser.fullName}
              >
                {authUser.profilePic ? (
                  <img src={authUser.profilePic} alt={authUser.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-primary/10 text-primary">
                    <User size={18} />
                  </div>
                )}
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-2xl w-52 max-w-[calc(100vw-1.5rem)] overflow-hidden text-sm text-base-content mt-1 space-y-1"
              >
                <li>
                  <Link to="/profile" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <User size={16} />
                    Profile
                  </Link>
                </li>
                <li>
                  <Link to="/settings" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <Settings size={16} />
                    Settings
                  </Link>
                </li>
                <li>
                  <Link to="/blocked" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <ShieldOff size={16} />
                    Blocked
                  </Link>
                </li>
                <li>
                  <Link to="/linked-devices" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <Laptop size={16} />
                    Linked Devices
                  </Link>
                </li>
                <li>
                  <Link to="/about" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <Info size={16} />
                    About
                  </Link>
                </li>

                {/* Account switcher — only the accounts already signed in on
                    this device. Switching reuses their stored session instead
                    of asking for a password again. */}
                <li className="menu-title text-[10px] uppercase tracking-wider text-base-content/40 font-bold px-3 pt-2 pb-1 select-none">
                  Accounts
                </li>
                {[...savedAccounts]
                  .sort((a, b) => (a._id === authUser._id ? -1 : b._id === authUser._id ? 1 : 0))
                  .map((acc) => {
                  const isActive = acc._id === authUser._id;
                  return (
                    <li key={acc._id}>
                      <div
                        onContextMenu={(e) => {
                          if (isActive) return;
                          e.preventDefault();
                          askForget(acc);
                        }}
                        onTouchStart={() => {
                          if (isActive) return;
                          forgetTimer.current = setTimeout(() => {
                            forgetTimer.current = null;
                            haptic("longPress");
                            askForget(acc);
                          }, 500);
                        }}
                        onTouchEnd={cancelForgetPress}
                        onTouchMove={cancelForgetPress}
                        onTouchCancel={cancelForgetPress}
                        className={`flex items-center min-w-0 gap-2 rounded-xl px-3 py-2 transition-colors ${
                          isActive ? "bg-primary/10" : "hover:bg-base-200"
                        }`}
                      >
                        <img
                          src={acc.profilePic || "/avatar.png"}
                          alt=""
                          className={`object-cover rounded-full size-6 flex-shrink-0 ${
                            isActive ? "ring-2 ring-primary" : ""
                          }`}
                        />
                        <button
                          type="button"
                          disabled={isActive || isSwitching}
                          onClick={async () => {
                            document.activeElement.blur();
                            setIsSwitching(true);
                            const ok = await switchAccount(acc._id);
                            setIsSwitching(false);
                            if (ok) toast.success(`Switched to ${acc.fullName}`);
                          }}
                          className="flex-1 min-w-0 text-left disabled:cursor-default"
                        >
                          <span className="block text-xs font-medium truncate">{acc.fullName}</span>
                          <span className="block text-[10px] text-base-content/45 truncate">{acc.email}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
                <li>
                  <Link
                    to="/login?add=1"
                    onClick={() => document.activeElement.blur()}
                    className="flex items-center gap-2 rounded-xl text-primary"
                  >
                    <UserPlus size={16} />
                    Add another account
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default Navbar;
