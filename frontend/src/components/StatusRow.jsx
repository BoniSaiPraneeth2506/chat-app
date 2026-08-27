import { useEffect, useRef } from "react";
import { useStatusStore } from "../store/useStatusStore";
import useAuthStore from "../store/useAuthStore";
import { Plus } from "lucide-react";
import { haptic } from "../lib/haptics";

const StatusRow = () => {
  const {
    statusGroups,
    fetchStatuses,
    subscribeToStatusEvents,
    unsubscribeFromStatusEvents,
    openStatusGroup,
    setCreateOpen,
  } = useStatusStore();
  const authUser = useAuthStore((s) => s.authUser);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchStatuses();
    subscribeToStatusEvents();
    return () => unsubscribeFromStatusEvents();
  }, [fetchStatuses, subscribeToStatusEvents, unsubscribeFromStatusEvents]);

  if (!authUser) return null;

  const ownGroup = statusGroups.find((g) => g.isOwn);
  const otherGroups = statusGroups.filter((g) => !g.isOwn);

  const handleOwnStatusClick = () => {
    haptic("tap");
    if (ownGroup && ownGroup.statuses.length > 0) {
      openStatusGroup(ownGroup, 0);
    } else {
      setCreateOpen(true);
    }
  };

  const handleOtherStatusClick = (group) => {
    haptic("tap");
    openStatusGroup(group, 0);
  };

  const hasOwnStatus = ownGroup && ownGroup.statuses.length > 0;
  const ownAllViewed = hasOwnStatus
    ? ownGroup.statuses.every((s) =>
        s.viewers?.some((v) => (v.user?._id || v.user) === authUser._id)
      )
    : false;

  return (
    <div className="w-full border-b border-base-200">
      <div
        ref={scrollRef}
        className="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar"
      >
        {/* My Status */}
        <button
          onClick={handleOwnStatusClick}
          className="flex flex-col items-center gap-1 flex-shrink-0"
        >
          <div className="relative">
            <div
              className={`rounded-full p-[2.5px] ${
                hasOwnStatus && !ownAllViewed
                  ? "bg-primary"
                  : hasOwnStatus
                  ? "bg-base-300"
                  : "bg-base-300"
              }`}
            >
              <div className="rounded-full bg-base-100 p-[2px]">
                <img
                  src={authUser.profilePic || "/avatar.png"}
                  alt="My Status"
                  className="rounded-full size-12 object-cover"
                />
              </div>
            </div>
            {!hasOwnStatus && (
              <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-primary flex items-center justify-center border-2 border-base-100">
                <Plus size={10} className="text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <span className="text-[10px] t-dim max-w-[56px] truncate text-center">
            My Status
          </span>
        </button>

        {/* Other users' statuses */}
        {otherGroups.map((group) => {
          const hasUnseen = group.hasUnseen;
          return (
            <button
              key={group.user?._id}
              onClick={() => handleOtherStatusClick(group)}
              className="flex flex-col items-center gap-1 flex-shrink-0 group/status"
            >
              <div
                className={`rounded-full transition-all ${
                  hasUnseen
                    ? "p-[2.5px] bg-primary shadow-sm shadow-primary/20"
                    : "p-[2px] bg-base-content/25 opacity-80"
                }`}
              >
                <div className="rounded-full bg-base-100 p-[2px]">
                  <img
                    src={group.user?.profilePic || "/avatar.png"}
                    alt={group.user?.fullName}
                    className="rounded-full size-12 object-cover transition-transform group-hover/status:scale-105"
                  />
                </div>
              </div>
              <span className={`text-[10px] max-w-[56px] truncate text-center ${hasUnseen ? "font-semibold text-base-content" : "t-dim"}`}>
                {group.user?.fullName?.split(" ")[0] || "User"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StatusRow;
