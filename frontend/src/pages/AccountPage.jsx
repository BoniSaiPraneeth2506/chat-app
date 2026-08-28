import { useState } from "react";
import {
  ArrowLeft,
  User,
  MonitorSmartphone,
  LogOut,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";

// A row inside the card container: no border of its own — the card's dividers
// separate rows, and a subtle hover is the only affordance (WhatsApp style).
const AccRow = ({ icon: Icon, title, subtitle, onClick, danger, trailing }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-base-200/70 text-left"
  >
    <div className="flex items-center gap-4 min-w-0">
      <div className={`grid rounded-xl place-items-center size-11 shrink-0 ${danger ? "bg-error/10" : "bg-primary/10"}`}>
        <Icon size={20} className={danger ? "text-error" : "text-primary"} />
      </div>
      <div className="min-w-0">
        <span className={`block text-sm font-medium truncate ${danger ? "text-error" : ""}`}>{title}</span>
        {subtitle && <span className="block text-xs opacity-60 truncate">{subtitle}</span>}
      </div>
    </div>
    {trailing !== undefined ? trailing : <ChevronRight size={18} className="opacity-40 shrink-0" />}
  </button>
);

const AccountPage = () => {
  const navigate = useNavigate();
  const { authUser, logOut, deleteAccount } = useAuthStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    logOut();
  };

  return (
    <div className="container min-h-screen max-w-2xl px-3 pt-20 pb-12 mx-auto"
         style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back to settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Account</h1>
              <p className="text-xs opacity-60">Manage your profile, devices and session</p>
            </div>
          </div>
        </div>

        {/* Profile card */}
        <button
          onClick={() => navigate("/profile")}
          className="w-full flex items-center gap-4 p-3 rounded-2xl transition-colors hover:bg-base-200/50"
          style={{ backgroundColor: "var(--color-base-200)/40" }}
        >
          <img
            src={authUser?.profilePic || "/avatar.png"}
            alt=""
            className="size-14 rounded-full object-cover"
          />
          <div className="min-w-0 text-left">
            <span className="block text-base font-semibold truncate">{authUser?.fullName}</span>
            <span className="block text-xs opacity-60 truncate">{authUser?.email}</span>
          </div>
          <ChevronRight size={20} className="opacity-40 ml-auto shrink-0" />
        </button>

        {/* Preferences */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-2">
            Preferences
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            <AccRow
              icon={ShieldCheck}
              title="Preferences"
              subtitle="Set your account preferences"
              onClick={() => navigate("/settings")}
            />
          </div>
        </div>

        {/* Sign in & security */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-2">
            Sign in & security
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            <AccRow
              icon={MonitorSmartphone}
              title="Linked Devices"
              subtitle="Manage devices signed in to your account"
              onClick={() => navigate("/linked-devices")}
            />
          </div>
        </div>

        {/* Sign out & delete */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-2">
            Session
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            <AccRow
              icon={LogOut}
              title="Log out"
              subtitle="Sign out of this device"
              onClick={() => setShowLogoutConfirm(true)}
              danger
            />
            <AccRow
              icon={AlertTriangle}
              title="Delete account"
              subtitle="Permanently remove your account and data"
              onClick={() => setDeleteDraft("")}
              danger
            />
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteDraft !== null && (
        <div
          onClick={() => !isDeleting && setDeleteDraft(null)}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm p-6 bg-base-100 rounded-2xl shadow-2xl text-left">
            <h3 className="text-lg font-semibold text-error">Delete your account?</h3>
            <p className="mt-2 mb-1 text-sm text-base-content/60">
              This cannot be undone. Your profile, the messages you sent and their photos are
              permanently removed, and you leave every group.
            </p>
            <p className="mb-5 text-xs text-base-content/40">
              Messages other people sent you stay in their own chat history.
            </p>
            <input
              autoFocus
              type="password"
              value={deleteDraft}
              onChange={(e) => setDeleteDraft(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-12 px-1 text-[15px] bg-transparent border-0 border-b border-base-content/15 rounded-none text-base-content placeholder:text-base-content/30 outline-none transition-colors focus:border-error focus:ring-0"
            />
            <p className="mt-2 text-[11px] text-base-content/35">
              Signed in with Google and never set a password? Type DELETE instead.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteDraft(null)}
                className="h-10 px-4 rounded-xl bg-base-300/70 hover:bg-base-300 text-[13px] font-medium text-base-content transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || !deleteDraft.trim()}
                onClick={async () => {
                  setIsDeleting(true);
                  const ok = await deleteAccount({ password: deleteDraft, confirm: deleteDraft });
                  setIsDeleting(false);
                  if (ok) {
                    setDeleteDraft(null);
                    navigate("/login", { replace: true });
                  }
                }}
                className="h-10 px-5 rounded-xl bg-error text-error-content text-[13px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-40"
              >
                {isDeleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-base-100 border border-base-300 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-left mx-4">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <LogOut className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-base-content">Confirm Logout</h3>
            </div>
            <p className="text-sm text-base-content/75 mb-6">
              Are you sure you want to log out of your session? You will need to sign in again to access your messages.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg bg-base-200 hover:bg-base-300 text-base-content text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Yes, Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;
