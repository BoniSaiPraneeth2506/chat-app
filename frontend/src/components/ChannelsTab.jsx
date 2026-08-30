import { useEffect, useState } from "react";
import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import { Search, Plus, Megaphone, Users, BellOff, TrendingUp, Flame } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import ChannelFeed from "./ChannelFeed";
import CreateChannelModal from "./CreateChannelModal";
import ExploreChannels from "./ExploreChannels";
import toast from "react-hot-toast";

const previewOf = (post) => {
  if (!post) return null;
  if (post.text) return post.text;
  if (post.hasMedia) {
    return post.mediaType === "video" ? "🎬 Video" : "🖼️ Photo";
  }
  return null;
};

const ChannelsTab = () => {
  const {
    channels,
    isLoadingChannels,
    exploreList,
    fetchMyChannels,
    fetchExplore,
    followChannel,
    channelsView,
    isChannelFeedOpen,
    openChannel,
    openExplore,
    setCreateModalOpen,
    subscribeToChannelEvents,
    unsubscribeFromChannelEvents,
  } = useChannelStore();
  const authUser = useAuthStore((s) => s.authUser);

  useEffect(() => {
    fetchMyChannels();
    fetchExplore();
    subscribeToChannelEvents();
    return () => unsubscribeFromChannelEvents();
  }, [fetchMyChannels, fetchExplore, subscribeToChannelEvents, unsubscribeFromChannelEvents]);

  // Recommended = public, most-followed channels the user is not already
  // following/owning. Sorted by followerCount (the explore endpoint already
  // returns them most-followed first).
  const joinedIds = new Set((channels || []).map((c) => String(c._id)));
  const recommended = (exploreList || [])
    .filter((c) => !joinedIds.has(String(c._id)))
    .filter((c) => {
      if (c.owner && String(c.owner._id || c.owner) === String(authUser?._id)) return false;
      return true;
    })
    .slice(0, 5);

  const handleFollow = async (channel) => {
    const ok = await followChannel(channel._id);
    if (ok) {
      toast.success(`Following ${channel.name}`);
    } else {
      toast.error("Could not follow this channel");
    }
  };

  const renderChannelRow = (channel, { showFollow = false } = {}) => {
    const isOwn = channel.isOwner;
    const preview = isOwn ? "Your channel" : previewOf(channel.latestPost);
    const time = channel.latestPost
      ? channel.latestPost.createdAt
      : channel.updatedAt || channel.createdAt;
    return (
      <div
        key={channel._id}
        role="button"
        tabIndex={0}
        onClick={() => openChannel(channel._id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openChannel(channel._id);
          }
        }}
        className="flex items-center gap-3 py-3 px-4 hover:bg-base-200/60 transition-colors group cursor-pointer select-none"
      >
        <div className="relative flex-shrink-0">
          {channel.avatar ? (
            <img
              src={channel.avatar}
              alt={channel.name}
              className="object-cover rounded-full size-12"
            />
          ) : (
            <div className="flex items-center justify-center rounded-full size-12 bg-secondary/10 border border-secondary/20 text-secondary">
              <Megaphone size={22} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base-content truncate flex items-center gap-1.5 text-[15px]">
              {channel.name}
              {channel.isMuted && (
                <BellOff className="size-3 text-base-content/35 flex-shrink-0" />
              )}
            </span>
            {!showFollow && time && (
              <span className="text-xs leading-none t-dim flex-shrink-0 ml-1">
                {formatMessageTime(time)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="text-sm text-base-content/60 truncate pr-2 flex-1">
              {showFollow ? (
                <span className="truncate">{channel.description || (channel.category || "Channel")}</span>
              ) : preview ? (
                <span className="truncate">{preview}</span>
              ) : (
                <span className="text-base-content/40 italic">No posts yet</span>
              )}
            </div>
            <span className="text-[10px] leading-none text-base-content/40 flex items-center gap-0.5 flex-shrink-0">
              <Users className="size-3" />
              {channel.followerCount || 0}
            </span>
          </div>
        </div>

        {showFollow && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFollow(channel);
            }}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 flex-shrink-0 bg-primary text-white"
          >
            Follow
          </button>
        )}
      </div>
    );
  };

  // Channels are always "mounted" beneath the current view, like the other tabs.
  if (isChannelFeedOpen) return <ChannelFeed />;

  if (channelsView === "explore") return <ExploreChannels />;

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0">
      {/* Header: Channels + search icon + create */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-semibold text-base-content">Channels</h2>
        <div className="flex items-center gap-1 -mr-2">
          <button
            onClick={openExplore}
            className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            title="Explore channels"
            aria-label="Explore channels"
          >
            <Search size={19} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors flex-shrink-0"
            title="Create channel"
            aria-label="Create channel"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Joined channels header */}
      <div className="px-4 pb-1 flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
          Joined channels
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {isLoadingChannels && channels.length === 0 ? (
          <div className="px-4 py-10 flex justify-center">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : channels.length === 0 ? (
          /* Empty state (still shows recommendations below) */
          <div className="px-6 pt-6 pb-2 flex flex-col items-center text-center">
            <div className="size-16 rounded-full bg-base-200 flex items-center justify-center mb-4">
              <Megaphone size={26} className="text-base-content/30" />
            </div>
            <h4 className="text-[15px] font-semibold text-base-content">Stay up to date</h4>
            <p className="text-xs text-base-content/45 mt-1 max-w-[240px]">
              When channels you follow post, they'll show up here. Explore channels or create your own.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[220px] mt-5 mb-4">
              <button
                onClick={openExplore}
                className="w-full h-11 rounded-2xl bg-primary text-primary-content font-semibold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} />
                Explore channels
              </button>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="w-full h-11 rounded-2xl bg-base-200/70 hover:bg-base-300 text-base-content font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Create a channel
              </button>
            </div>
          </div>
        ) : (
          channels.map((channel) => renderChannelRow(channel))
        )}

        {/* Recommended — most followed channels you don't follow yet */}
        {recommended.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-1 flex items-center gap-2">
              <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wide flex items-center gap-1.5">
                <Flame size={14} className="text-primary" />
                Recommended for you
              </h3>
            </div>
            <div className="pb-2">
              {recommended.map((channel) => renderChannelRow(channel, { showFollow: true }))}
            </div>
          </>
        )}
      </div>

      {/* Create modal lives inside the tab so it inherits the tab context. */}
      <CreateChannelModal />
    </div>
  );
};

export default ChannelsTab;
