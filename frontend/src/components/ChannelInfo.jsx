import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import {
  ArrowLeft, Megaphone, Users, Lock, Globe, Link as LinkIcon,
  Pencil, Trash2, BellOff, Bell, X,
} from "lucide-react";
import toast from "react-hot-toast";
import CreateChannelModal from "./CreateChannelModal";

const ChannelInfo = () => {
  const {
    selectedChannel,
    closeChannelInfo,
    closeChannel,
    openEditChannel,
    muteChannel,
    unfollowChannel,
    generateInvite,
    deleteChannel,
  } = useChannelStore();
  const authUser = useAuthStore((s) => s.authUser);

  const channel = selectedChannel;
  const myId = String(authUser?._id);
  const isOwner = Boolean(channel) && String(channel.owner?._id || channel.owner) === myId;
  const canManage = Boolean(channel) && (isOwner || channel.isAdmin);

  const copyInvite = async () => {
    let code = channel.inviteCode;
    if (!code) code = await generateInvite(channel._id);
    if (!code) return;
    const link = `${window.location.origin}/join-channel/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast(link);
    }
  };

  if (!channel) {
    return (
      <div className="h-full flex flex-col min-h-0 min-w-0 bg-base-100">
        <div className="px-3 py-2.5 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={closeChannelInfo}
            className="p-1.5 -ml-1 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-base-content">Channel info</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-base-content/40">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 bg-base-100">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={closeChannelInfo}
          className="p-1.5 -ml-1 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-semibold text-base-content">Channel info</h2>
        <button
          onClick={closeChannelInfo}
          className="ml-auto p-1.5 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Identity */}
        <div className="flex flex-col items-center pt-6 pb-5 px-6 text-center">
          {channel.avatar ? (
            <img
              src={channel.avatar}
              alt={channel.name}
              className="size-20 rounded-full object-cover mb-3"
            />
          ) : (
            <div className="size-20 rounded-full bg-secondary/10 border border-secondary/20 text-secondary flex items-center justify-center mb-3">
              <Megaphone size={30} />
            </div>
          )}
          <h2 className="text-lg font-bold text-base-content">{channel.name}</h2>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-base-content/50">
            <span className="flex items-center gap-1">
              <Users size={12} /> {channel.followerCount || 0} followers
            </span>
            {channel.category && <span>· {channel.category}</span>}
            <span className="flex items-center gap-0.5">
              · {channel.privacy === "private" ? <Lock size={11} /> : <Globe size={11} />}
              {channel.privacy === "private" ? "Private" : "Public"}
            </span>
          </div>
        </div>

        {/* Description */}
        {channel.description && (
          <div className="mx-4 mb-4 rounded-2xl bg-base-200/60 p-4">
            <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1.5">
              About
            </div>
            <p className="text-sm text-base-content/80 whitespace-pre-wrap break-words">
              {channel.description}
            </p>
          </div>
        )}

        {/* Owner */}
        <div className="mx-4 rounded-2xl bg-base-200/60 p-4">
          <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
            Created by
          </div>
          <div className="flex items-center gap-3">
            {channel.owner?.profilePic ? (
              <img
                src={channel.owner.profilePic}
                alt=""
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <div className="size-10 rounded-full bg-base-300 flex items-center justify-center text-base-content/60">
                <Megaphone size={18} />
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-base-content">
                {channel.owner?.fullName || "Unknown"}
              </div>
              {isOwner && (
                <div className="text-xs text-primary font-medium">You</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 mx-4 divide-y divide-base-content/8 rounded-2xl bg-base-200/60 overflow-hidden">
          {canManage && (
            <button
              onClick={() => {
                openEditChannel(channel);
                closeChannelInfo();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-base-content hover:bg-base-200/70 transition-colors text-left"
            >
              <Pencil size={17} className="text-base-content/60" />
              Edit channel
            </button>
          )}

          <button
            onClick={async () => {
              await muteChannel(channel._id, !channel.isMuted);
              toast.success(channel.isMuted ? "Notifications on" : "Notifications muted");
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-base-content hover:bg-base-200/70 transition-colors text-left"
          >
            {channel.isMuted ? (
              <Bell size={17} className="text-base-content/60" />
            ) : (
              <BellOff size={17} className="text-base-content/60" />
            )}
            {channel.isMuted ? "Unmute notifications" : "Mute notifications"}
          </button>

          {canManage && (
            <button
              onClick={copyInvite}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-base-content hover:bg-base-200/70 transition-colors text-left"
            >
              <LinkIcon size={17} className="text-base-content/60" />
              Copy invite link
            </button>
          )}

          {!isOwner && (
            <button
              onClick={async () => {
                await unfollowChannel(channel._id);
                closeChannelInfo();
                closeChannel();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-error hover:bg-base-200/70 transition-colors text-left"
            >
              <Users size={17} />
              Unfollow
            </button>
          )}

          {isOwner && (
            <button
              onClick={async () => {
                if (window.confirm(`Delete "${channel.name}" and all its posts?`)) {
                  await deleteChannel(channel._id);
                  toast.success("Channel deleted");
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-error hover:bg-base-200/70 transition-colors text-left"
            >
              <Trash2 size={17} />
              Delete channel
            </button>
          )}
        </div>
      </div>

      <CreateChannelModal />
    </div>
  );
};

export default ChannelInfo;
