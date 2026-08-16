import { useEffect, useState, useCallback } from "react";
import { ShieldOff, UserCheck } from "lucide-react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useNicknames, displayNameOf } from "../lib/contacts";

// Same surface language as the profile and linked-devices screens: borderless
// panels one step lighter than the page, separated by spacing.
const cardClass = "rounded-2xl bg-base-200";
const sectionLabel = "text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1";

const RowSkeleton = () => (
  <div className={`${cardClass} flex items-center gap-4 p-4`}>
    <div className="rounded-full size-11 bg-base-300 animate-pulse flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 rounded-full bg-base-300 animate-pulse w-2/5" />
      <div className="h-3 rounded-full bg-base-300 animate-pulse w-3/5" />
    </div>
  </div>
);

const BlockedUsersPage = () => {
  const { authUser } = useAuthStore();
  const { toggleBlockUser } = useChatStore();
  const nicknames = useNicknames();

  const [blocked, setBlocked] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  // The list has to come from the server: blockedUsers on authUser is only an
  // array of ids, and a blocked contact may have no chat history at all, so
  // the sidebar list can't be relied on to resolve their names.
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get("/messages/blocked");
      setBlocked(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load blocked users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser) load();
  }, [authUser, load]);

  const handleUnblock = async (user) => {
    setPendingId(user._id);
    // Optimistic: the row leaves immediately, and is restored if the call
    // fails so the screen never disagrees with the server.
    setBlocked((prev) => prev.filter((u) => u._id !== user._id));
    try {
      await toggleBlockUser(user._id);
    } catch {
      setBlocked((prev) => [...prev, user]);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-14">
      <div className="max-w-2xl px-4 mx-auto space-y-5">

        <div className={`${cardClass} px-6 py-7 flex flex-col items-center text-center`}>
          <div className="grid rounded-full size-14 place-items-center bg-error/10">
            <ShieldOff size={26} className="text-error" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-base-content">Blocked contacts</h1>
          <p className="mt-1 text-sm text-base-content/50 max-w-sm">
            {blocked.length === 0
              ? "You haven't blocked anyone."
              : `${blocked.length} blocked. They can't message or call you, and you won't see their messages.`}
          </p>
        </div>

        <div className="space-y-2">
          <span className={sectionLabel}>{isLoading ? "Loading" : "Blocked"}</span>

          {isLoading ? (
            <div className="space-y-2.5">
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : blocked.length === 0 ? (
            <div className={`${cardClass} px-6 py-10 text-center`}>
              <p className="text-[15px] text-base-content/60">Nobody is blocked</p>
              <p className="mt-1 text-xs text-base-content/35">
                Block someone from the chat menu and they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {blocked.map((user) => (
                <div key={user._id} className={`${cardClass} flex items-center gap-4 p-4`}>
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt=""
                    className="object-cover rounded-full size-11 flex-shrink-0 grayscale"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-base-content truncate">
                      {displayNameOf(user, nicknames)}
                    </p>
                    <p className="text-xs text-base-content/45 truncate">
                      {user.bio?.trim() || user.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnblock(user)}
                    disabled={pendingId === user._id}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-base-300/70 hover:bg-primary/15 hover:text-primary text-[13px] font-medium text-base-content/70 active:scale-[0.97] transition-all flex-shrink-0 disabled:opacity-40"
                  >
                    <UserCheck size={15} />
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockedUsersPage;
