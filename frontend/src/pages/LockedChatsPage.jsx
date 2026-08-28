import { ArrowLeft, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ChatLockSettings from "../components/ChatLockSettings";
import useAuthStore from "../store/useAuthStore";

const LockedChatsPage = () => {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.authUser);
  const count = (authUser?.lockedChats?.length || 0) + (authUser?.lockedGroups?.length || 0);

  return (
    <div className="container min-h-screen max-w-3xl px-4 pt-20 pb-12 mx-auto"
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
              <Lock size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Locked Chats</h1>
              <p className="text-xs opacity-60">
                {count > 0 ? `${count} ${count === 1 ? "chat" : "chats"} hidden` : "Hide chosen chats behind a password"}
              </p>
            </div>
          </div>
        </div>

        <ChatLockSettings />
      </div>
    </div>
  );
};

export default LockedChatsPage;
