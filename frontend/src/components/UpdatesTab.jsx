import StatusRow from "./StatusRow";
import { useGroupStore } from "../store/useGroupStore";
import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Star, Pin, MoreVertical, Clock, Archive, ShieldCheck } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import { RowSkeleton } from "./skeletons/Skeleton";
import { useSkeletonGate } from "../hooks/useSkeletonGate";
import { haptic } from "../lib/haptics";

const previewForAttachment = (attachment) => {
  if (!attachment) return "📎 Attachment";
  if (attachment.kind === "video") return "🎬 Video";
  if (attachment.kind === "image") return "🖼️ Photo";
  return `📄 ${attachment.name || "Document"}`;
};

const UpdatesTab = () => {
  const {
    groups,
    isGroupsLoading,
    setSelectedGroup,
    setGroupPreview,
    latestGroupMessages,
    unreadGroupCounts,
    mentionedGroups,
  } = useGroupStore();
  const authUser = useAuthStore((s) => s.authUser);
  const navigate = useNavigate();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  // The three-dot menu closes on outside tap, like the one in a chat header.
  useEffect(() => {
    if (!moreMenuOpen) return;
    const onDown = (e) => {
      if (!moreMenuRef.current?.contains(e.target)) setMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreMenuOpen]);

  // isGroupsLoading starts false and only flips once getGroups() runs from an
  // effect, so keying a skeleton on it alone flashed "No groups joined yet" for
  // a frame before the groups arrived.
  const groupsPending = useSkeletonGate(isGroupsLoading);
  const showGroupsSkeleton = groupsPending || (isGroupsLoading && groups.length === 0);

  const asIds = (arr) => new Set((arr || []).map((x) => String(x?._id || x)));
  const favoriteGroupIds = asIds(authUser?.favoriteGroups);
  const pinnedGroupIds = asIds(authUser?.pinnedGroups);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-base-content">Updates</h2>
          <p className="text-xs text-base-content/50 mt-0.5">Statuses and groups</p>
        </div>
        <div
          ref={moreMenuRef}
          className={`dropdown dropdown-bottom dropdown-end ${moreMenuOpen ? "dropdown-open" : ""}`}
        >
          <div
            role="button"
            tabIndex={0}
            className="p-2 hover:bg-base-300 rounded-full transition-colors hover:text-primary cursor-pointer"
            title="More"
            aria-label="More status options"
            onClick={() => setMoreMenuOpen((o) => !o)}
          >
            <MoreVertical size={18} />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-box w-52 text-xs text-base-content mt-1"
          >
            <li>
              <button
                onClick={() => {
                  haptic("tap");
                  setMoreMenuOpen(false);
                  navigate("/status/scheduled");
                }}
                className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2"
              >
                <Clock size={14} />
                Scheduled statuses
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  haptic("tap");
                  setMoreMenuOpen(false);
                  navigate("/status/archived");
                }}
                className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2"
              >
                <Archive size={14} />
                Archived statuses
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  haptic("tap");
                  setMoreMenuOpen(false);
                  navigate("/status/privacy");
                }}
                className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2"
              >
                <ShieldCheck size={14} />
                Status privacy
              </button>
            </li>
          </ul>
        </div>
      </div>

      <StatusRow />

      {/* Groups header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-base-content">Groups</h3>
      </div>

      {showGroupsSkeleton ? (
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-base-content/40">No groups joined yet</p>
        </div>
      ) : (
        <div className="pb-4">
          {groups.map((group) => {
            const latestMsg = latestGroupMessages[group._id];
            const unread = unreadGroupCounts[group._id] || 0;
            const mentioned = Boolean(mentionedGroups?.[group._id]);
            return (
                <button
                  key={group._id}
                  onClick={() => {
                    useChannelStore.getState().closeChannel();
                    setSelectedGroup(group);
                  }}
                  className="w-full py-3.5 px-4 flex items-center gap-3 hover:bg-base-200/60 transition-colors group select-none"
                >
                  <div
                    className="relative flex-shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupPreview(group);
                    }}
                  >
                  {group.groupPic ? (
                    <img
                      src={group.groupPic}
                      alt={group.name}
                      className="object-cover rounded-full size-12"
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded-full size-12 bg-secondary/10 border border-secondary/20 text-secondary">
                      <Users className="size-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base-content truncate flex items-center gap-1.5">
                      {group.name}
                      {favoriteGroupIds.has(group._id) && (
                        <Star className="size-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                      {pinnedGroupIds.has(group._id) && (
                        <Pin className="size-3 t-dim rotate-45 flex-shrink-0" />
                      )}
                      <span className="text-[10px] leading-none bg-base-300 px-1.5 py-1 rounded t-dim font-normal">
                        {group.members?.length || 0}
                      </span>
                    </span>
                    {latestMsg && (
                      <span className="text-xs leading-none t-dim">
                        {formatMessageTime(latestMsg.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-0.5">
                    <div className="text-sm text-base-content/60 truncate pr-2 flex-1 text-left">
                      {latestMsg ? (
                        <span>
                          <strong className="font-medium text-base-content/80">
                            {latestMsg.isAnonymous ? "Anonymous" : latestMsg.senderId?.fullName?.split(" ")[0]}:
                          </strong>{" "}
                          {latestMsg.isDeletedForEveryone
                            ? "This message was deleted"
                            : latestMsg.poll ? `📊 ${latestMsg.poll.question}`
                            : latestMsg.voice ? "🎤 Voice message"
                            : latestMsg.image ? "📷 Image"
                            : latestMsg.contact?.name ? `👤 ${latestMsg.contact.name}`
                            : latestMsg.attachments?.length ? previewForAttachment(latestMsg.attachments[0])
                            : latestMsg.text}
                        </span>
                      ) : (
                        <span className="text-base-content/40 italic">Group created</span>
                      )}
                    </div>
                    {mentioned && (
                      <span
                        title="You were mentioned"
                        className="flex items-center justify-center size-5 text-[11px] font-bold text-primary-content bg-primary rounded-full flex-shrink-0"
                      >
                        @
                      </span>
                    )}
                    {unread > 0 && (
                      <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] leading-none font-bold rounded-full flex-shrink-0 ${
                        mentioned ? "badge-mention" : "bg-primary text-white"
                      }`}>
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UpdatesTab;
