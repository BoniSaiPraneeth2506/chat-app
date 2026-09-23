import { useEffect, useState } from "react";
import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import { Search, Plus, Megaphone, Users, BellOff, TrendingUp, Flame, Sparkles, Check, Compass, Radio } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import { useIsDesktop } from "../hooks/useIsDesktop";
import ChannelFeed from "./ChannelFeed";
import CreateChannelModal from "./CreateChannelModal";
import ExploreChannels from "./ExploreChannels";
import ChannelInfo from "./ChannelInfo";
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
    isChannelInfoOpen,
    openChannel,
    openExplore,
    setCreateModalOpen,
    subscribeToChannelEvents,
    unsubscribeFromChannelEvents,
  } = useChannelStore();
  const authUser = useAuthStore((s) => s.authUser);
  const isDesktop = useIsDesktop();
  const [followingMap, setFollowingMap] = useState({});

  useEffect(() => {
    fetchMyChannels();
    fetchExplore();
    subscribeToChannelEvents();
    return () => unsubscribeFromChannelEvents();
  }, [fetchMyChannels, fetchExplore, subscribeToChannelEvents, unsubscribeFromChannelEvents]);

  // Recommended channels that the user is not following yet
  const joinedIds = new Set((channels || []).map((c) => String(c._id)));
  const recommended = (exploreList || [])
    .filter((c) => !joinedIds.has(String(c._id)))
    .filter((c) => {
      if (c.owner && String(c.owner._id || c.owner) === String(authUser?._id)) return false;
      return true;
    })
    .slice(0, 5);

  const handleFollow = async (channel) => {
    setFollowingMap((prev) => ({ ...prev, [channel._id]: true }));
    const ok = await followChannel(channel._id);
    if (ok) {
      toast.success(`Following ${channel.name}`);
    } else {
      toast.error("Could not follow this channel");
      setFollowingMap((prev) => ({ ...prev, [channel._id]: false }));
    }
  };

  const renderChannelRow = (channel, { showFollow = false } = {}) => {
    const isOwn = channel.isOwner;
    const preview = isOwn ? "Your broadcast channel" : previewOf(channel.latestPost);
    const time = channel.latestPost
      ? channel.latestPost.createdAt
      : channel.updatedAt || channel.createdAt;
    const isPendingFollow = Boolean(followingMap[channel._id]);

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
        className="mx-2 my-1 px-3 py-2.5 rounded-2xl flex items-center gap-3 bg-base-100 hover:bg-base-200/60 border border-base-300/40 hover:border-base-300 transition-all duration-200 group cursor-pointer select-none active:scale-[0.99]"
      >
        {/* Channel Avatar with subtle status border */}
        <div className="relative flex-shrink-0">
          {channel.avatar ? (
            <img
              src={channel.avatar}
              alt={channel.name}
              className="object-cover rounded-2xl size-12 ring-1 ring-base-300/60 group-hover:ring-primary/40 transition-all"
            />
          ) : (
            <div className="flex items-center justify-center rounded-2xl size-12 bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
              <Megaphone size={20} />
            </div>
          )}
          {channel.privacy === "private" && (
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-base-300 border border-base-100 flex items-center justify-center text-[9px] text-base-content/70">
              🔒
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-semibold text-base-content truncate flex items-center gap-1.5 text-[14.5px]">
              {channel.name}
              {channel.isMuted && (
                <BellOff className="size-3 text-base-content/40 flex-shrink-0" />
              )}
            </span>
            {!showFollow && time && (
              <span className="text-[11px] text-base-content/40 flex-shrink-0">
                {formatMessageTime(time)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="text-xs text-base-content/60 truncate flex-1">
              {showFollow ? (
                <span className="truncate">{channel.description || channel.category || "Community channel"}</span>
              ) : preview ? (
                <span className="truncate">{preview}</span>
              ) : (
                <span className="text-base-content/35 italic">No posts yet</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-base-200/90 text-[10px] font-medium text-base-content/60 border border-base-300/50">
                <Users size={10} className="text-primary" />
                {channel.followerCount || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Follow CTA */}
        {showFollow && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFollow(channel);
            }}
            disabled={isPendingFollow}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 flex-shrink-0 bg-primary text-primary-content hover:opacity-90 shadow-sm flex items-center gap-1"
          >
            {isPendingFollow ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                <span>Following</span>
              </>
            ) : (
              <>
                <Plus size={13} strokeWidth={2.5} />
                <span>Follow</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  // Full-screen on mobile when viewing a feed or info
  if (!isDesktop && isChannelFeedOpen) return <ChannelFeed />;
  if (!isDesktop && isChannelInfoOpen) return <ChannelInfo />;
  if (channelsView === "explore") return <ExploreChannels />;

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 bg-base-100">
      {/* Header: Preserves exact positions of Channels, Search icon, and + icon */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between flex-shrink-0 border-b border-base-300/40">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Radio size={17} />
          </div>
          <h2 className="text-base font-bold text-base-content tracking-tight">Channels</h2>
          {channels.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-base-200 text-xs font-semibold text-base-content/60 border border-base-300/40">
              {channels.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 -mr-1">
          <button
            onClick={openExplore}
            className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            title="Explore channels"
            aria-label="Explore channels"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full active:scale-95 transition-all flex-shrink-0"
            title="Create channel"
            aria-label="Create channel"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-2">
        {/* Section title */}
        <div className="px-3 pt-1 pb-1.5 flex items-center justify-between">
          <span className="text-[11.5px] font-bold text-base-content/50 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={12} className="text-primary" />
            Subscribed
          </span>
          <button
            onClick={openExplore}
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 transition-colors"
          >
            <Compass size={12} />
            <span>Discover more</span>
          </button>
        </div>

        {isLoadingChannels && channels.length === 0 ? (
          <div className="px-4 py-12 flex flex-col items-center justify-center gap-2">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-xs text-base-content/40">Loading channels…</span>
          </div>
        ) : channels.length === 0 ? (
          /* Premium Empty State */
          <div className="mx-3 my-2 p-6 rounded-3xl bg-base-200/40 border border-base-300/60 text-center flex flex-col items-center shadow-sm">
            <div className="size-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-inner">
              <Megaphone size={26} />
            </div>
            <h4 className="text-base font-bold text-base-content">Stay Updated in Real-Time</h4>
            <p className="text-xs text-base-content/55 mt-1 max-w-[240px] leading-relaxed">
              Channels are one-way broadcast updates from creators, news, and communities you care about.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[240px] mt-4">
              <button
                onClick={openExplore}
                className="w-full h-10 rounded-2xl bg-primary text-primary-content font-semibold text-xs shadow-md shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <TrendingUp size={15} />
                Explore Public Channels
              </button>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="w-full h-10 rounded-2xl bg-base-200 hover:bg-base-300/80 text-base-content font-semibold text-xs border border-base-300/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Plus size={15} strokeWidth={2.2} />
                Create Your Own Channel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {channels.map((channel) => renderChannelRow(channel))}
          </div>
        )}

        {/* Recommended Channels */}
        {recommended.length > 0 && (
          <div className="mt-4 pt-2 border-t border-base-300/40">
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-base-content/50 uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={13} className="text-amber-500 fill-amber-500/20" />
                Recommended for you
              </span>
              <button
                onClick={openExplore}
                className="text-[11px] font-semibold text-base-content/50 hover:text-primary transition-colors"
              >
                View all
              </button>
            </div>
            <div className="space-y-0.5 pb-2">
              {recommended.map((channel) => renderChannelRow(channel, { showFollow: true }))}
            </div>
          </div>
        )}
      </div>

      <CreateChannelModal />
    </div>
  );
};

export default ChannelsTab;
