import { create } from "zustand";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";

export const useChannelStore = create((set, get) => ({
  // Joined + owned channels shown in the Channels tab.
  channels: [],
  isLoadingChannels: false,

  // Explore / recommended and search results.
  exploreList: [],
  isExploreLoading: false,
  searchResults: [],
  isSearchLoading: false,

  // Open channel feed.
  selectedChannel: null,
  posts: [],
  isPostsLoading: false,
  hasMore: false,

  // UI sub-state within the Channels tab and the Explorer overlay.
  channelsView: "list", // "list" | "explore"
  isCreateModalOpen: false,
  isChannelFeedOpen: false,
  activeChannelId: null,

  // ── List loading ───────────────────────────────────────────────────────────
  fetchMyChannels: async () => {
    set({ isLoadingChannels: true });
    try {
      const res = await axiosInstance.get("/channels/joined");
      set({ channels: res.data || [] });
    } catch (err) {
      console.error("Error fetching channels:", err.message);
    } finally {
      set({ isLoadingChannels: false });
    }
  },

  fetchExplore: async () => {
    set({ isExploreLoading: true });
    try {
      const res = await axiosInstance.get("/channels/explore", { params: { limit: 30 } });
      set({ exploreList: res.data || [] });
    } catch (err) {
      console.error("Error fetching explore channels:", err.message);
    } finally {
      set({ isExploreLoading: false });
    }
  },

  searchChannels: async (q, category = "") => {
    if (!q || !q.trim()) {
      set({ searchResults: [], isSearchLoading: false });
      return;
    }
    set({ isSearchLoading: true });
    try {
      const res = await axiosInstance.get("/channels/search", {
        params: { q, category, limit: 30 },
      });
      set({ searchResults: res.data || [] });
    } catch (err) {
      console.error("Error searching channels:", err.message);
      set({ searchResults: [] });
    } finally {
      set({ isSearchLoading: false });
    }
  },

  searchByCategory: async (category) => {
    if (!category || !category.trim()) {
      set({ searchResults: [], isSearchLoading: false });
      return;
    }
    set({ isSearchLoading: true });
    try {
      const res = await axiosInstance.get("/channels/search", {
        params: { category, limit: 30 },
      });
      set({ searchResults: res.data || [] });
    } catch (err) {
      console.error("Error searching by category:", err.message);
      set({ searchResults: [] });
    } finally {
      set({ isSearchLoading: false });
    }
  },

  createChannel: async (payload) => {
    const res = await axiosInstance.post("/channels", payload);
    const newChannel = res.data;
    // The owner auto-follows, so prepend it to the joined list.
    set({ channels: [newChannel, ...get().channels] });
    return newChannel;
  },

  updateChannel: async (channelId, payload) => {
    const res = await axiosInstance.put(`/channels/${channelId}`, payload);
    set({
      channels: get().channels.map((c) => (c._id === channelId ? { ...c, ...res.data } : c)),
      selectedChannel: get().selectedChannel?._id === channelId ? { ...get().selectedChannel, ...res.data } : get().selectedChannel,
    });
    return res.data;
  },

  deleteChannel: async (channelId) => {
    await axiosInstance.delete(`/channels/${channelId}`);
    set({
      channels: get().channels.filter((c) => c._id !== channelId),
      exploreList: get().exploreList.filter((c) => c._id !== channelId),
    });
    if (get().activeChannelId === channelId) get().closeChannel();
  },

  followChannel: async (channelId) => {
    try {
      await axiosInstance.post(`/channels/${channelId}/follow`);
      // Pull from explore/search so the row flips its button.
      const patch = (list) =>
        (list || []).map((c) => (c._id === channelId ? { ...c, isFollowing: true } : c));
      set({
        exploreList: patch(get().exploreList),
        searchResults: patch(get().searchResults),
      });
      await get().fetchMyChannels();
      return true;
    } catch (err) {
      console.error("Error following channel:", err.message);
      return false;
    }
  },

  unfollowChannel: async (channelId) => {
    try {
      await axiosInstance.post(`/channels/${channelId}/unfollow`);
      const patch = (list) =>
        (list || []).map((c) => (c._id === channelId ? { ...c, isFollowing: false } : c));
      set({
        exploreList: patch(get().exploreList),
        searchResults: patch(get().searchResults),
        channels: get().channels.filter((c) => c._id !== channelId),
      });
      if (get().activeChannelId === channelId) get().closeChannel();
      return true;
    } catch (err) {
      console.error("Error unfollowing channel:", err.message);
      return false;
    }
  },

  muteChannel: async (channelId, muted) => {
    try {
      await axiosInstance.post(`/channels/${channelId}/mute`, { muted });
      const patch = (list) =>
        (list || []).map((c) => (c._id === channelId ? { ...c, isMuted: muted } : c));
      set({
        channels: patch(get().channels),
        selectedChannel: get().selectedChannel?._id === channelId ? { ...get().selectedChannel, isMuted: muted } : get().selectedChannel,
      });
      return true;
    } catch (err) {
      console.error("Error muting channel:", err.message);
      return false;
    }
  },

  reportChannel: async (channelId, reason = "") => {
    try {
      await axiosInstance.post(`/channels/${channelId}/report`, { reason });
      return true;
    } catch (err) {
      console.error("Error reporting channel:", err.message);
      return false;
    }
  },

  generateInvite: async (channelId) => {
    const res = await axiosInstance.post(`/channels/${channelId}/invite`);
    return res.data?.inviteCode || "";
  },

  revokeInvite: async (channelId) => {
    await axiosInstance.post(`/channels/${channelId}/invite/revoke`);
    return true;
  },

  joinByInvite: async (inviteCode) => {
    const res = await axiosInstance.post("/channels/invite/join", { inviteCode });
    await get().fetchMyChannels();
    return res.data?.channel || null;
  },

  // ── Channel feed (posts) ───────────────────────────────────────────────────
  openChannel: async (channelId) => {
    set({ isChannelFeedOpen: true, activeChannelId: channelId, isPostsLoading: true });
    const socket = useAuthStore.getState().socket;
    if (socket) socket.emit("joinChannelRoom", channelId);

    await Promise.all([
      get().fetchChannelDetails(channelId),
      get().fetchPosts(channelId),
    ]);
  },

  fetchChannelDetails: async (channelId) => {
    try {
      const res = await axiosInstance.get(`/channels/${channelId}`);
      set({ selectedChannel: res.data });
    } catch (err) {
      console.error("Error fetching channel details:", err.message);
    }
  },

  fetchPosts: async (channelId, { page = 1, append = false } = {}) => {
    set({ isPostsLoading: true });
    try {
      const res = await axiosInstance.get(`/channels/${channelId}/posts`, { params: { page, limit: 20 } });
      const incoming = res.data?.posts || [];
      set((state) => ({
        posts: append ? [...state.posts, ...incoming] : incoming,
        hasMore: res.data?.hasMore || false,
        isPostsLoading: false,
      }));
    } catch (err) {
      console.error("Error fetching posts:", err.message);
      set({ isPostsLoading: false });
    }
  },

  closeChannel: () => {
    const channelId = get().activeChannelId;
    if (channelId) {
      const socket = useAuthStore.getState().socket;
      if (socket) socket.emit("leaveChannelRoom", channelId);
    }
    set({
      isChannelFeedOpen: false,
      activeChannelId: null,
      selectedChannel: null,
      posts: [],
      hasMore: false,
    });
  },

  createPost: async (channelId, payload) => {
    const res = await axiosInstance.post(`/channels/${channelId}/posts`, payload);
    const newPost = res.data;
    if (get().activeChannelId === channelId) {
      set({ posts: [newPost, ...get().posts] });
      // Keep the joined list sorted so the just-posted channel bumps to the top.
      set({ channels: [...get().channels] });
    }
    return newPost;
  },

  deletePost: async (channelId, postId) => {
    await axiosInstance.delete(`/channels/${channelId}/posts/${postId}`);
    set({ posts: get().posts.filter((p) => p._id !== postId) });
  },

  pinPost: async (channelId, postId, pinned) => {
    await axiosInstance.post(`/channels/${channelId}/posts/${postId}/pin`, { pinned });
    set({
      posts: get().posts
        .map((p) => (p._id === postId ? { ...p, pinned } : p))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
    });
  },

  reactToPost: async (channelId, postId, reaction) => {
    try {
      const res = await axiosInstance.post(`/channels/${channelId}/posts/${postId}/react`, { reaction });
      const currentUserId = useAuthStore.getState().authUser?._id;
      set({
        posts: get().posts.map((p) => {
          if (p._id !== postId) return p;
          const others = (p.reactions || []).filter(
            (r) => String(r.user) !== String(currentUserId)
          );
          return {
            ...p,
            myReaction: res.data?.myReaction || "",
            reactions: res.data?.myReaction ? [...others, { user: currentUserId, reaction: res.data.myReaction }] : others,
          };
        }),
      });
      return true;
    } catch (err) {
      console.error("Error reacting to post:", err.message);
      return false;
    }
  },

  viewPost: async (channelId, postId) => {
    try {
      await axiosInstance.post(`/channels/${channelId}/posts/${postId}/view`);
    } catch (err) {
      console.error("Error recording post view:", err.message);
    }
  },

  fetchPostMediaUrl: async (channelId, postId) => {
    const res = await axiosInstance.get(`/channels/${channelId}/posts/media/${postId}`);
    return res.data?.url || "";
  },

  // ── Socket subscriptions ───────────────────────────────────────────────────
  subscribeToChannelEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("channel:postCreated");
    socket.off("channel:postDeleted");
    socket.off("channel:deleted");

    socket.on("channel:postCreated", (post) => {
      const { activeChannelId, posts } = get();
      const pid = post?.channel?._id || post?.channel;
      if (activeChannelId && pid && String(pid) === String(activeChannelId)) {
        if (!posts.some((p) => p._id === post._id)) {
          set({ posts: [post, ...posts] });
        }
      }
      // A channel somebody posts to bumps to the top of the joined list.
      const { channels } = get();
      const idx = channels.findIndex((c) => String(c._id) === String(pid));
      if (idx > 0) {
        const copy = [...channels];
        const [moved] = copy.splice(idx, 1);
        copy.unshift(moved);
        set({ channels: copy });
      }
    });

    socket.on("channel:postDeleted", ({ channelId, postId }) => {
      if (get().activeChannelId && String(get().activeChannelId) === String(channelId)) {
        set({ posts: get().posts.filter((p) => p._id !== postId) });
      }
    });

    socket.on("channel:deleted", ({ channelId }) => {
      set({ channels: get().channels.filter((c) => c._id !== channelId) });
      if (get().activeChannelId === channelId) get().closeChannel();
    });
  },

  unsubscribeFromChannelEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("channel:postCreated");
    socket.off("channel:postDeleted");
    socket.off("channel:deleted");
  },

  // ── UI helpers ─────────────────────────────────────────────────────────────
  openExplore: () => {
    set({ channelsView: "explore" });
    get().fetchExplore();
  },
  closeExplore: () => set({ channelsView: "list" }),
  setChannelsView: (view) => set({ channelsView: view }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
}));
