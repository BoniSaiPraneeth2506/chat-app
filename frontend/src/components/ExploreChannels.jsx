import { useEffect, useMemo, useState } from "react";
import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import { Search, X, Plus, TrendingUp, Users, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = [
  "Tech",
  "News",
  "Entertainment",
  "Sports",
  "Business",
  "Education",
  "Health",
  "Food",
  "Travel",
  "Lifestyle",
  "Other",
];

// The Explore / search screen.
//
// Layout (top to bottom): a back bar, the search field, then a horizontally
// scrollable row of category filters. Below that "Recommended channels" show
// when nothing is typed; picking a category narrows to that category; typing a
// query shows the relevant search results.
//
// The "×" on a recommended row only dismisses that recommendation from view —
// deliberately NOT an unfollow. Dismissing is a local preference; following is
// the account-level relationship with the channel itself.
const ExploreChannels = () => {
  const {
    exploreList,
    isExploreLoading,
    searchResults,
    isSearchLoading,
    fetchExplore,
    searchChannels,
    searchByCategory,
    followChannel,
    setCreateModalOpen,
    openChannel,
    closeExplore,
  } = useChannelStore();
  const authUser = useAuthStore((s) => s.authUser);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [dismissed, setDismissed] = useState(() => new Set());

  useEffect(() => {
    fetchExplore();
  }, [fetchExplore]);

  const handleFollow = async (channel) => {
    if (channel.isFollowing) {
      openChannel(channel._id);
      return;
    }
    const ok = await followChannel(channel._id);
    if (ok) {
      toast.success(`Following ${channel.name}`);
      openChannel(channel._id);
    } else {
      toast.error("Could not follow this channel");
    }
  };

  const visibleRecommended = useMemo(
    () =>
      (exploreList || [])
        .filter((c) => !dismissed.has(c._id))
        .filter((c) => {
          if (c.owner && String(c.owner._id || c.owner) === String(authUser?._id)) return false;
          return true;
        }),
    [exploreList, dismissed, authUser]
  );

  const searching = query.trim().length > 0;
  const filteringByCategory = !searching && activeCategory !== "";

  const handleCategorySelect = (cat) => {
    const next = activeCategory === cat ? "" : cat;
    setActiveCategory(next);
    if (next) searchByCategory(next);
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    searchChannels(value, activeCategory);
  };

  const shown = searching
    ? searchResults
    : filteringByCategory
    ? searchResults
    : visibleRecommended;

  const loading = searching || filteringByCategory ? isSearchLoading : isExploreLoading;

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0">
      {/* Back bar */}
      <div className="px-3 py-3 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={closeExplore}
          className="p-2 -ml-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-base font-semibold text-base-content">Explore channels</h2>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="ml-auto p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors flex-shrink-0"
          title="Create channel"
          aria-label="Create channel"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search channels..."
            className="field-flat w-full h-10 pl-11 pr-10 rounded-full border-0 bg-base-200 text-sm text-base-content ph-dim"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                searchChannels("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-base-300 rounded-full text-base-content/40 hover:text-base-content transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal category filter */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full border transition-all flex-shrink-0 select-none ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "bg-base-200 text-base-content/75 border-base-300 hover:bg-base-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-4">
        {!searching && (
          <div className="px-4 pt-1 pb-2 flex items-center gap-2 text-xs font-semibold text-base-content/60 uppercase tracking-wide">
            {filteringByCategory ? (
              <span>{activeCategory} channels</span>
            ) : (
              <>
                <TrendingUp size={14} />
                Recommended
              </>
            )}
          </div>
        )}

        {loading && shown.length === 0 ? (
          <div className="px-4 py-10 flex justify-center">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : shown.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="size-14 mx-auto rounded-full bg-base-200 flex items-center justify-center mb-3">
              <Search size={20} className="text-base-content/30" />
            </div>
            <p className="text-sm font-medium text-base-content/70">
              {searching
                ? `No channels match “${query}”`
                : filteringByCategory
                ? `No ${activeCategory} channels yet`
                : "No recommendations right now"}
            </p>
            <p className="text-xs text-base-content/40 mt-1">
              {searching
                ? "Try a different name or category"
                : filteringByCategory
                ? "Try another category"
                : "Create a channel to get started"}
            </p>
            {!searching && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 px-5 py-2.5 rounded-2xl bg-primary text-primary-content font-semibold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
              >
                Create a channel
              </button>
            )}
          </div>
        ) : (
          shown.map((channel) => (
            <div
              key={channel._id}
              className="flex items-center gap-3 py-3 px-4 hover:bg-base-200/60 transition-colors group"
            >
              {/* Avatar */}
              <button
                onClick={() => openChannel(channel._id)}
                className="flex-shrink-0 relative"
                title="Open channel"
              >
                {channel.avatar ? (
                  <img
                    src={channel.avatar}
                    alt={channel.name}
                    className="object-cover rounded-full size-12"
                  />
                ) : (
                  <div className="flex items-center justify-center rounded-full size-12 bg-secondary/10 border border-secondary/20 text-secondary">
                    <Users className="size-6" />
                  </div>
                )}
              </button>

              {/* Info */}
              <div className="min-w-0 flex-1 text-left">
                <div className="font-semibold text-base-content truncate text-[15px]">
                  {channel.name}
                </div>
                <div className="text-xs text-base-content/50 truncate">
                  {channel.description || (channel.category ? channel.category : "Channel")}
                </div>
                <div className="text-[11px] text-base-content/35 mt-0.5 flex items-center gap-1">
                  <span>{channel.followerCount || 0}</span>
                  <span>followers</span>
                  {channel.privacy === "private" && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-base-300 text-[9px] font-semibold">
                      Private
                    </span>
                  )}
                </div>
              </div>

              {/* Follow / Dismiss */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleFollow(channel)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                    channel.isFollowing
                      ? "border border-base-content/20 text-base-content/70"
                      : "bg-primary text-white"
                  }`}
                >
                  {channel.isFollowing ? "Open" : "Follow"}
                </button>
                {!searching && !filteringByCategory && (
                  <button
                    onClick={() => setDismissed((prev) => new Set(prev).add(channel._id))}
                    className="p-1.5 rounded-full text-base-content/35 hover:text-base-content hover:bg-base-200 transition-colors"
                    aria-label={`Dismiss ${channel.name} recommendation`}
                    title="Not interested — removes this recommendation"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {!searching && !filteringByCategory && shown.length > 0 && visibleRecommended.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-base-content/40">
            You've dismissed them all. Reset to browse more.
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreChannels;
