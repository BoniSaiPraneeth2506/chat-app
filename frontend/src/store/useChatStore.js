// import { create } from "zustand";
// import toast from "react-hot-toast";
// import axiosInstance from "../lib/axios";


// export const useChatStore = create((set, get) => ({
//   messages: [],
//   users: [],
//   selectedUser: null,
//   isUsersLoading: false,
//   isMessagesLoading: false,

//   getUsers: async () => {
//     set({ isUsersLoading: true });
//     try {
//       const res = await axiosInstance.get("/messages/users");
//       set({ users: res.data });
//     } catch (error) {
//       toast.error(error.response.data.message);
//     } finally {
//       set({ isUsersLoading: false });
//     }
//   },

//   getMessages: async (userId) => {
//     set({ isMessagesLoading: true });
//     try {
//       const res = await axiosInstance.get(`/messages/${userId}`);
//       set({ messages: res.data });
//     } catch (error) {
//       toast.error(error.response.data.message);
//     } finally {
//       set({ isMessagesLoading: false });
//     }
//   },
//   sendMessage: async (messageData) => {
//     const { selectedUser, messages } = get();
//     try {
//       const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
//       set({ messages: [...messages, res.data] });
//     } catch (error) {
//       toast.error(error.response.data.message);
//     }
//   },


//   setSelectedUser:(selectedUser)=>{
//     set({selectedUser})
//   }
//   }));


import { create } from "zustand";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";
import { useGroupStore } from "./useGroupStore";
import { useThemeStore } from "./useThemeStore";
import {
  cacheMessages,
  getCachedMessages,
  updateCachedMessage,
  deleteCachedMessage,
  clearCachedConversation,
  cacheConversationsMeta,
  getCachedConversationsMeta,
  addToOutbox,
  getOutbox,
  removeFromOutbox,
} from "../lib/db";
import { isNetworkError } from "../lib/network";

// Local cache keys are shared with db.js's per-conversation message store —
// "dm:<userId>" keeps a DM's cache distinct from a group's ("group:<id>").
const dmKey = (userId) => `dm:${userId}`;

// Group messages are held in useGroupStore, not here. These two reach across
// so a delete initiated from the shared message UI updates whichever list the
// message actually lives in. Written as functions rather than a module-level
// import binding because the two stores import each other; resolving the state
// at call time is what keeps that cycle harmless.
const removeGroupMessageLocally = (messageId) => {
  const gs = useGroupStore.getState();
  if (!gs?.groupMessages?.length) return;
  if (!gs.groupMessages.some((m) => m._id === messageId)) return;
  useGroupStore.setState((state) => ({
    groupMessages: state.groupMessages.filter((m) => m._id !== messageId),
  }));
};

const patchGroupMessageLocally = (messageId, patch) => {
  const gs = useGroupStore.getState();
  if (!gs?.groupMessages?.length) return;
  if (!gs.groupMessages.some((m) => m._id === messageId)) return;
  useGroupStore.setState((state) => ({
    groupMessages: state.groupMessages.map((m) =>
      m._id === messageId ? { ...m, ...patch } : m
    ),
  }));
};

// Deleting a chat removes the contact from the sidebar list, so a later message
// from them has no row to attach to. Refetching restores it — throttled because
// a burst of messages from the same unknown sender would otherwise refetch once
// per message.
let lastSidebarRefetch = 0;
const restoreSidebarRow = (getState, senderKey) => {
  if (!senderKey) return;
  const { users, getUsers } = getState();
  if (users.some((u) => u._id === senderKey)) return;
  if (Date.now() - lastSidebarRefetch < 3000) return;
  lastSidebarRefetch = Date.now();
  getUsers();
};

// Applies transcript state to whichever list holds the message. DMs live here,
// group messages in useGroupStore, and a voice note in either can be transcribed.
const applyTranscript = (setState, messageId, transcript) => {
  const merge = (m) =>
    m._id === messageId ? { ...m, transcript: { ...(m.transcript || {}), ...transcript } } : m;

  setState((state) => ({ messages: state.messages.map(merge) }));

  const gs = useGroupStore.getState();
  if (gs?.groupMessages?.some((m) => m._id === messageId)) {
    useGroupStore.setState((state) => ({ groupMessages: state.groupMessages.map(merge) }));
  }
};

/**
 * Adds a message to a list, or merges it into the copy already there.
 *
 * Three things can be the same message: an optimistic copy still carrying its
 * tempId, the server's reply to the request that created it, and the socket event
 * the server broadcasts. Now that the server echoes a message back to the
 * sender's other devices, all three can arrive in any order on the device that
 * sent it, so every path that adds a message goes through here.
 */
const upsertIntoList = (list, message) => {
  if (!Array.isArray(list)) return [message];
  const index = list.findIndex(
    (m) =>
      m._id === message._id ||
      (message.clientId && m.tempId === message.clientId) ||
      (m.tempId && message.tempId && m.tempId === message.tempId) ||
      (m.tempId && m.tempId === message._id)
  );
  if (index === -1) return [...list, message];
  const merged = [...list];
  merged[index] = { ...merged[index], ...message };
  return merged;
};

/** Content carried over when forwarding; a deleted message forwards empty. */
const buildForwardPayload = (message) => {
  const payload = { isForwarded: true };
  if (!message.isDeletedForEveryone) {
    if (message.text) payload.text = message.text;
    if (message.image) payload.image = message.image;
    if (message.images) payload.images = message.images;
    if (message.voice) payload.voice = message.voice;
  }
  return payload;
};

let callStartTime = null;
let pendingIceCandidates = [];

const processPendingIceCandidates = async (pc) => {
  if (!pc || !pc.remoteDescription) return;
  while (pendingIceCandidates.length > 0) {
    const candidate = pendingIceCandidates.shift();
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("Error adding queued ice candidate", e);
    }
  }
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  latestMessages: {},
  unreadCounts: {},
  // Populated from the server by getUsers and kept current by the messagesRead
  // socket event. Deliberately not persisted locally — see the handler.
  lastReadTimestamps: {},
  hasMoreMessages: true,
  isRecipientProfileOpen: false,
  setIsRecipientProfileOpen: (isOpen) => set({ isRecipientProfileOpen: isOpen }),

  // Advanced features states
  typingUsers: {},
  messageSearchQuery: "",
  replyingToMessage: null,
  editingMessage: null,
  forwardingMessage: null,
  setForwardingMessage: (message) => set({ forwardingMessage: message }),

  // Bumped when something (an edit) should pull the view back to the newest
  // message. A counter rather than a boolean so repeated requests each fire.
  scrollToBottomSignal: 0,

  // Multi-select forwarding keeps its own field rather than overloading
  // `forwardingMessage` with an array, so every existing single-message
  // caller and the modal's preview logic stay unchanged.
  forwardingMessages: [],
  setForwardingMessages: (messages) => set({ forwardingMessages: messages || [] }),
  showArchivedOnly: false,
  isSelectionMode: false,
  selectedMessageIds: [],
  setSelectionMode: (isSelectionMode) => set({ isSelectionMode, selectedMessageIds: [] }),
  toggleMessageSelection: (messageId) => set((state) => {
    const isSelected = state.selectedMessageIds.includes(messageId);
    const updated = isSelected 
      ? state.selectedMessageIds.filter(id => id !== messageId)
      : [...state.selectedMessageIds, messageId];
    return { selectedMessageIds: updated };
  }),
  clearMessageSelection: () => set({ selectedMessageIds: [] }),

  // Calling features states
  callState: null,
  callType: null,
  callPartner: null,
  isCaller: false,
  isCallMinimized: false,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  incomingSignal: null,
  setPeerConnection: (pc) => set({ peerConnection: pc }),

  isScreenSharing: false,
  screenStream: null,

  /**
   * Swap the outgoing camera track for the screen.
   *
   * Uses `replaceTrack` on the existing video sender, so there is no
   * renegotiation and the other side needs no new code — the same track just
   * starts carrying different pixels. That's also why this is offered on video
   * calls only: a voice call has no video sender to replace, and adding one
   * would require a fresh offer/answer round trip.
   *
   * Not available on Android: `getDisplayMedia` isn't implemented in the
   * WebView, so the UI hides the control there rather than failing on tap.
   */
  startScreenShare: async () => {
    const { peerConnection, callState, callType, isScreenSharing } = get();
    if (isScreenSharing || callState !== "connected" || callType !== "video") return false;
    if (!peerConnection || !navigator.mediaDevices?.getDisplayMedia) {
      toast.error("Screen sharing isn't supported on this device");
      return false;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video");

      if (!sender || !screenTrack) {
        screenStream.getTracks().forEach((t) => t.stop());
        toast.error("Couldn't start screen sharing");
        return false;
      }

      await sender.replaceTrack(screenTrack);

      // The browser's own "Stop sharing" bar ends the track without telling
      // our UI, so restore the camera when that happens.
      screenTrack.onended = () => get().stopScreenShare();

      set({ isScreenSharing: true, screenStream });
      return true;
    } catch (err) {
      // Dismissing the picker rejects with NotAllowedError — not an error worth
      // showing.
      if (err?.name !== "NotAllowedError") {
        console.error("Screen share failed:", err);
        toast.error("Couldn't start screen sharing");
      }
      return false;
    }
  },

  stopScreenShare: async () => {
    const { peerConnection, localStream, screenStream, isScreenSharing } = get();
    if (!isScreenSharing) return;

    try {
      const cameraTrack = localStream?.getVideoTracks?.()[0];
      const sender = peerConnection?.getSenders?.().find((s) => s.track?.kind === "video");
      // If the call ended mid-share there may be nothing left to restore to.
      if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);
    } catch (err) {
      console.error("Failed to restore camera after screen share:", err);
    } finally {
      screenStream?.getTracks?.().forEach((t) => t.stop());
      set({ isScreenSharing: false, screenStream: null });
    }
  },
  toggleCallMinimize: () => set((state) => ({ isCallMinimized: !state.isCallMinimized })),

  pinnedMessage: null,
  setPinnedMessage: (pinnedMessage) => set({ pinnedMessage }),

  profilePreviewUser: null,
  setProfilePreviewUser: (profilePreviewUser) => set({ profilePreviewUser }),

  lightboxImage: null,
  // Marks the open image as view-once, so App can hold FLAG_SECURE while it is
  // on screen and drop it again afterwards. Kept as a separate flag rather than
  // inferred from the message, because the lightbox is also used for avatars
  // and ordinary photos, which should stay screenshot-able.
  lightboxSecure: false,
  setLightboxImage: (lightboxImage, { secure = false } = {}) =>
    set({ lightboxImage, lightboxSecure: Boolean(lightboxImage) && secure }),

  drafts: {},
  setDraft: (userId, text) => set((state) => ({
    drafts: { ...state.drafts, [userId]: text }
  })),

  setMessageSearchQuery: (query) => set({ messageSearchQuery: query }),
  setReplyingToMessage: (message) => set({ replyingToMessage: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),
  setShowArchivedOnly: (show) => set({ showArchivedOnly: show }),

  getUsers: async (search = "") => {
    set({ isUsersLoading: true });
    const authUser = useAuthStore.getState().authUser;

    // Cache-first: paint the sidebar instantly from the last sync, exactly
    // like getMessages does for a conversation, instead of showing a
    // skeleton while waiting on the network for something we already have.
    if (authUser && !search) {
      const cached = await getCachedConversationsMeta(authUser._id, "dm-sidebar");
      if (cached) set({ users: cached.users || [], latestMessages: cached.latestMessages || {} });
    }

    try {
      const res = await axiosInstance.get(`/messages/users?search=${search}`);
      const users = Array.isArray(res.data) ? res.data : [];

      // Seed unread badges from the server's count. Without this the badge
      // only ever reflected messages seen live over the socket, so anything
      // that arrived while the app was closed or logged out came back looking
      // already read. `Math.max` keeps any increment that landed over the
      // socket while this request was still in flight.
      set((state) => {
        const unreadCounts = { ...state.unreadCounts };
        users.forEach((user) => {
          if (typeof user.unreadCount !== "number") return;
          // The chat that's currently open is read by definition. Its
          // markAsRead may not have hit the database yet, so trusting the
          // server here would flash a badge onto the conversation being read.
          if (state.selectedUser?._id === user._id) {
            unreadCounts[user._id] = 0;
            return;
          }
          unreadCounts[user._id] = Math.max(user.unreadCount, unreadCounts[user._id] || 0);
        });

        // Sender-side read ticks now come from the server. Previously this map
        // was only ever filled by a live socket receipt and cached in
        // localStorage, so ticks reverted to single after a reinstall and every
        // account sharing a browser read the same global key. `Math.max` keeps
        // a receipt that landed while this request was in flight.
        const lastReadTimestamps = { ...state.lastReadTimestamps };
        users.forEach((user) => {
          if (typeof user.readMyMessagesAt !== "number" || !user.readMyMessagesAt) return;
          lastReadTimestamps[user._id] = Math.max(
            user.readMyMessagesAt,
            lastReadTimestamps[user._id] || 0
          );
        });

        return { users, unreadCounts, lastReadTimestamps };
      });

      // Fetch the last message for each user to populate latestMessages
      const latestMsgs = {};
      await Promise.all(
        users.map(async (user) => {
          try {
            const msgRes = await axiosInstance.get(`/messages/${user._id}`);
            const userMessages = Array.isArray(msgRes.data) ? msgRes.data : [];
            if (userMessages && userMessages.length > 0) {
              latestMsgs[user._id] = userMessages[userMessages.length - 1];
            }
          } catch (err) {
            console.error("Error fetching latest message for user", user._id, err);
          }
        })
      );
      set({ latestMessages: latestMsgs });

      // Cache only the canonical unfiltered sidebar, not per-search results,
      // so the offline fallback above always restores the full chat list.
      if (authUser && !search) {
        cacheConversationsMeta(authUser._id, "dm-sidebar", { users, latestMessages: latestMsgs });
      }
    } catch (error) {
      if (isNetworkError(error)) {
        // Offline — whether or not a cache existed to fall back to (handled
        // above), never surface axios's raw "Network Error" string.
        if (search) toast.error("You're offline — search needs a connection");
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to load users");
      }
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    const authUser = useAuthStore.getState().authUser;
    const conversationKey = dmKey(userId);

    // Every write below is gated on this still being the open conversation.
    // Tapping two chats in quick succession used to let the first request's
    // response land in the second chat — the wrong history painted for a moment
    // and then corrected itself, which reads as the screen flickering.
    const isStillCurrent = () => get().selectedUser?._id === userId;

    // Cache-first: paint instantly from whatever's already on the device
    // (like WhatsApp reopening a chat) while the network call confirms.
    const cached = authUser ? await getCachedMessages(authUser._id, conversationKey) : [];
    if (!isStillCurrent()) return;
    set({ isMessagesLoading: true, hasMoreMessages: true, messages: cached });

    try {
      const limit = 20;
      const res = await axiosInstance.get(`/messages/${userId}?limit=${limit}&skip=0`);
      const messages = Array.isArray(res.data) ? res.data : [];

      const pinnedHeader = res.headers["x-pinned-message"];
      let pinnedMessage = null;
      if (pinnedHeader) {
        try {
          pinnedMessage = JSON.parse(decodeURIComponent(pinnedHeader));
        } catch (e) {
          console.error("Failed to parse pinned message header", e);
        }
      }

      // Cached regardless — this history is worth keeping for next time even if
      // the user has already moved on to another chat.
      if (authUser) cacheMessages(authUser._id, conversationKey, messages);
      if (!isStillCurrent()) return;

      set({
        messages,
        hasMoreMessages: messages.length === limit,
        pinnedMessage
      });

      // Emit markAsRead to receiver
      const socket = useAuthStore.getState().socket;
      const currentUser = useAuthStore.getState().authUser;
      if (socket && currentUser && useThemeStore.getState().privacyReadReceipts) {
        socket.emit("markAsRead", { senderId: userId, receiverId: currentUser._id });
      }
    } catch (error) {
      if (isNetworkError(error)) {
        // Offline: stay on whatever's cached (possibly empty, if this chat
        // was never opened before) instead of surfacing axios's raw
        // "Network Error" — the offline banner already says what's going on.
        if (isStillCurrent()) set({ hasMoreMessages: false });
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to load messages");
      }
    } finally {
      // Leaving this set would strand a spinner over a conversation this
      // request no longer owns.
      if (isStillCurrent()) set({ isMessagesLoading: false });
    }
  },

  isLoadingMore: false,

  /**
   * Prepends the previous page of history.
   *
   * Three things this has to be careful about, all of which used to bite:
   *
   *   * the merge must read the list as it is when the response lands, not the
   *     snapshot from when the request went out — anything that arrived over the
   *     socket in between was silently overwritten and the message vanished
   *   * ids can repeat, because skip counts from the newest end and new arrivals
   *     shift the window, so the same message could be prepended twice
   *   * a second call must not start while one is in flight, and the caller must
   *     be told when it settles even on the error path, or scroll-to-load stays
   *     stuck for the rest of the conversation
   */
  loadMoreMessages: async (userId) => {
    const { hasMoreMessages, isLoadingMore } = get();
    if (!hasMoreMessages || isLoadingMore) return;
    set({ isLoadingMore: true });

    try {
      const limit = 20;
      const skip = Array.isArray(get().messages) ? get().messages.length : 0;
      const res = await axiosInstance.get(`/messages/${userId}?limit=${limit}&skip=${skip}`);
      const newMessages = Array.isArray(res.data) ? res.data : [];

      if (get().selectedUser?._id !== userId) return false;

      let prepended = 0;
      set((state) => {
        const current = Array.isArray(state.messages) ? state.messages : [];
        const known = new Set(current.map((m) => m._id));
        const older = newMessages.filter((m) => !known.has(m._id));
        prepended = older.length;
        return {
          messages: [...older, ...current],
          hasMoreMessages: newMessages.length === limit,
        };
      });
      // Reported back so the view knows whether to expect a re-render. Without
      // it, a page that added nothing left the caller's scroll-anchor flag armed
      // and loading older messages stayed dead for the rest of the conversation.
      return prepended > 0;
    } catch (error) {
      console.error("Failed to load more messages:", error);
      return false;
    } finally {
      set({ isLoadingMore: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, replyingToMessage } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!selectedUser || !authUser) return;

    const tempId = "temp-" + Date.now();
    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text || "",
      image: messageData.image || "",
      images: messageData.images || [],
      voice: messageData.voice || "",
      isOneView: messageData.isOneView || false,
      replyTo: replyingToMessage,
      createdAt: new Date().toISOString(),
      isSending: true,
    };

    // Optimistically append message to UI instantly (0ms delay)
    set((state) => ({
      messages: [...state.messages, optimisticMsg],
      replyingToMessage: null,
      latestMessages: {
        ...state.latestMessages,
        [selectedUser._id]: optimisticMsg
      }
    }));

    const payload = replyingToMessage
      ? { ...messageData, replyTo: replyingToMessage._id, clientId: tempId }
      : { ...messageData, clientId: tempId };

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      const sentMessage = { ...res.data, tempId };

      // Replace temporary optimistic message with confirmed server message
      set((state) => ({
        messages: state.messages.map((m) => (m._id === tempId || m.tempId === tempId ? sentMessage : m)),
        latestMessages: {
          ...state.latestMessages,
          [selectedUser._id]: sentMessage
        }
      }));
      cacheMessages(authUser._id, dmKey(selectedUser._id), [sentMessage]);
    } catch (error) {
      if (isNetworkError(error)) {
        // Offline: keep the bubble on screen (renderTicks shows it pending)
        // and queue it to auto-send once the connection comes back.
        addToOutbox(authUser._id, {
          tempId,
          conversationKey: dmKey(selectedUser._id),
          kind: "dm",
          targetId: selectedUser._id,
          payload,
          createdAt: Date.now(),
        });
      } else {
        // A real rejection (validation, blocked, etc.) — revert as before.
        set((state) => ({
          messages: state.messages.filter((m) => m._id !== tempId)
        }));
        toast.error(error.response?.data?.message || error.message || "Failed to send message");
      }
    }
  },

  // Retries every message that got queued while offline, in the order it
  // was composed. Runs on socket (re)connect — see useAuthStore.connectSocket.
  flushOutbox: async () => {
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    const queued = (await getOutbox(authUser._id)).filter((entry) => entry.kind === "dm");
    for (const entry of queued) {
      try {
        const res = await axiosInstance.post(`/messages/send/${entry.targetId}`, entry.payload);
        const sentMessage = { ...res.data, tempId: entry.tempId };
        set((state) => ({
          messages: state.messages.map((m) =>
            m._id === entry.tempId || m.tempId === entry.tempId ? sentMessage : m
          ),
          latestMessages: {
            ...state.latestMessages,
            [entry.targetId]: sentMessage
          }
        }));
        cacheMessages(authUser._id, entry.conversationKey, [sentMessage]);
        await removeFromOutbox(authUser._id, entry.tempId);
      } catch (error) {
        if (!isNetworkError(error)) {
          // Genuinely rejected (not just still offline) — stop retrying it.
          set((state) => ({
            messages: state.messages.filter((m) => m._id !== entry.tempId && m.tempId !== entry.tempId)
          }));
          await removeFromOutbox(authUser._id, entry.tempId);
          toast.error(error.response?.data?.message || "A queued message failed to send");
        }
        // Still offline: leave it queued and stop — preserves send order for next attempt.
        else break;
      }
    }
  },

  // Send message with simulated progress and cancellation support.
  // Provides a client-side progress indicator and allows abort + retry by re-calling this function.
  sendMessageWithProgress: async (messageData, { onProgress, signal } = {}) => {
    const { selectedUser, replyingToMessage } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!selectedUser || !authUser) return;

    const tempId = "temp-" + Date.now();
    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text || "",
      image: messageData.image || "",
      images: messageData.images || [],
      voice: messageData.voice || "",
      isOneView: messageData.isOneView || false,
      replyTo: replyingToMessage,
      createdAt: new Date().toISOString(),
      isSending: true,
      isUploading: Boolean(messageData.image || (messageData.images && messageData.images.length)),
      uploadProgress: 0,
      _abortController: null,
    };

    // Append optimistic message
    set((state) => ({
      messages: [...state.messages, optimisticMsg],
      replyingToMessage: null,
      latestMessages: {
        ...state.latestMessages,
        [selectedUser._id]: optimisticMsg
      }
    }));

    // Simulated progress timer nudges progress forward while network request runs
    let progress = 0;
    const progressTimer = setInterval(() => {
      progress = Math.min(90, progress + Math.floor(Math.random() * 8) + 4);
      set((s) => ({
        messages: s.messages.map((m) => m._id === tempId ? { ...m, uploadProgress: progress } : m)
      }));
      if (onProgress) onProgress(progress);
    }, 300);

    // Use AbortController to allow cancellation
    const controller = new AbortController();
    if (signal) {
      // When caller provides a signal, wire cancellation
      signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const payload = replyingToMessage 
        ? { ...messageData, replyTo: replyingToMessage._id, clientId: tempId } 
        : { ...messageData, clientId: tempId };

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload, {
        signal: controller.signal
      });

      clearInterval(progressTimer);
      // Finalize progress
      set((s) => ({
        messages: s.messages.map((m) => m._id === tempId ? { ...res.data, tempId } : m),
        latestMessages: {
          ...s.latestMessages,
          [selectedUser._id]: res.data
        }
      }));
      if (onProgress) onProgress(100);
      return res.data;
    } catch (error) {
      clearInterval(progressTimer);
      // If aborted, remove optimistic message
      if (controller.signal.aborted || error.name === 'CanceledError' || error.message === 'canceled') {
        set((s) => ({ messages: s.messages.filter((m) => m._id !== tempId) }));
        throw new Error('aborted');
      }

      // Network failure: remove optimistic and throw
      set((s) => ({ messages: s.messages.filter((m) => m._id !== tempId) }));
      throw error;
    }
  },

  forwardMessage: async (message, recipientIds) => {
    try {
      const payload = buildForwardPayload(message);

      const results = await Promise.all(
        recipientIds.map((id) => axiosInstance.post(`/messages/send/${id}`, payload))
      );

      // Update latestMessages and current chat messages for each forwarded recipient
      const authUser = useAuthStore.getState().authUser;
      results.forEach((res, idx) => {
        const sentMsg = res.data;
        const { selectedUser } = get();
        set((state) => ({
          latestMessages: { ...state.latestMessages, [recipientIds[idx]]: sentMsg },
        }));
        if (selectedUser && recipientIds[idx] === selectedUser._id) {
          set((state) => ({ messages: [...state.messages, sentMsg] }));
        }
        if (authUser) cacheMessages(authUser._id, dmKey(recipientIds[idx]), [sentMsg]);
      });

      toast.success(
        `Forwarded to ${recipientIds.length} chat${recipientIds.length > 1 ? "s" : ""}`
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward message");
    }
  },

  /**
   * Forward several messages at once (multi-select).
   *
   * Messages are sent one after another rather than all in parallel so they
   * arrive in the order they were selected — fanning them out concurrently
   * would let the server assign timestamps in an arbitrary order and scramble
   * the transcript at the far end. Recipients within a single message still go
   * out in parallel, since their ordering is independent.
   */
  forwardMessages: async (msgs, recipientIds) => {
    if (!msgs?.length || !recipientIds?.length) return;
    try {
      const authUser = useAuthStore.getState().authUser;

      for (const message of msgs) {
        const payload = buildForwardPayload(message);
        const results = await Promise.all(
          recipientIds.map((id) => axiosInstance.post(`/messages/send/${id}`, payload))
        );

        results.forEach((res, idx) => {
          const sentMsg = res.data;
          const { selectedUser } = get();
          set((state) => ({
            latestMessages: { ...state.latestMessages, [recipientIds[idx]]: sentMsg },
          }));
          if (selectedUser && recipientIds[idx] === selectedUser._id) {
            set((state) => ({ messages: [...state.messages, sentMsg] }));
          }
          if (authUser) cacheMessages(authUser._id, dmKey(recipientIds[idx]), [sentMsg]);
        });
      }

      const chats = `${recipientIds.length} chat${recipientIds.length > 1 ? "s" : ""}`;
      toast.success(
        msgs.length > 1 ? `Forwarded ${msgs.length} messages to ${chats}` : `Forwarded to ${chats}`
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward messages");
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Clean up existing listeners to avoid duplicates
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("messageTranscript");
    socket.off("accountListsUpdated");
    socket.off("typing");
    socket.off("messageReaction");
    socket.off("messageDeleted");
    socket.off("messageEdited");
    socket.off("callUser");
    socket.off("callAccepted");
    socket.off("callEnded");
    socket.off("iceCandidate");

    // Emit read receipt for current active chat immediately if any
    const { selectedUser } = get();
    const currentUser = useAuthStore.getState().authUser;
    if (selectedUser && currentUser && useThemeStore.getState().privacyReadReceipts) {
      console.log(`[Socket Client] Emitting markAsRead on initialization for user: ${selectedUser._id}`);
      socket.emit("markAsRead", { senderId: selectedUser._id, receiverId: currentUser._id });
    }

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, messages } = get();
      const currentUser = useAuthStore.getState().authUser;

      if (newMessage.senderId === currentUser?._id && newMessage.receiverId === currentUser?._id) {
        return;
      }

      // Normalize IDs to string for consistent keying
      const senderKey = typeof newMessage.senderId === 'object' ? (newMessage.senderId._id || newMessage.senderId.toString()) : newMessage.senderId;

      // Update latest message for the sender (prefer scheduledAt when present)
      set((state) => ({
        latestMessages: {
          ...state.latestMessages,
          [senderKey]: {
            ...(state.latestMessages[senderKey] || {}),
            ...newMessage
          }
        }
      }));

      // If this sender is not in the sidebar (their chat was deleted, or this
      // is a first-ever message), bring the row back.
      if (senderKey !== currentUser?._id) restoreSidebarRow(get, senderKey);

      // Write-through to the local cache regardless of which chat is open,
      // so reopening this conversation later (even offline) shows it.
      if (currentUser) {
        const receiverKey = typeof newMessage.receiverId === 'object'
          ? (newMessage.receiverId._id || newMessage.receiverId.toString())
          : newMessage.receiverId;
        const otherPartyId = senderKey === currentUser._id ? receiverKey : senderKey;
        if (otherPartyId) cacheMessages(currentUser._id, dmKey(otherPartyId), [newMessage]);
      }

      // Belongs to the open chat if either end of it is the person on screen —
      // which covers a message this account sent from one of its other devices,
      // where the sender is us and the recipient is who we are looking at.
      const receiverKeyForMatch = typeof newMessage.receiverId === "object"
        ? (newMessage.receiverId?._id || newMessage.receiverId?.toString())
        : newMessage.receiverId;
      const belongsToOpenChat =
        selectedUser &&
        (senderKey === selectedUser._id || receiverKeyForMatch === selectedUser._id);

      if (belongsToOpenChat) {
        set((state) => ({ messages: upsertIntoList(state.messages, { ...newMessage }) }));

        // Emit read receipt back immediately if privacy setting allows it
        if (currentUser && useThemeStore.getState().privacyReadReceipts) {
          console.log(`[Socket Client] Active chat message received. Emitting markAsRead for: ${selectedUser._id}`);
          socket.emit("markAsRead", { senderId: selectedUser._id, receiverId: currentUser._id });
        }
      } else if (senderKey !== currentUser?._id) {
        // Otherwise, increment the unread count for this sender.
        //
        // Never for your own message. A note to yourself is delivered straight
        // back to you, so writing one with any other chat open left an unread
        // badge sitting on Personal Notes for something you had just typed.
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [senderKey]: (state.unreadCounts[senderKey] || 0) + 1
          }
        }));
      }
    });

    // Account-level lists changed on another of this user's devices: pins,
    // favourites, archive, or the locked set. Applying them here is what makes a
    // pin on the phone show up on the laptop without a refresh.
    //
    // The lists are merged rather than replacing authUser, and the sidebar is
    // refetched because a change to the locked set alters what the server is
    // willing to send at all.
    socket.on("accountListsUpdated", (lists) => {
      if (!lists) return;
      useAuthStore.setState((state) =>
        state.authUser ? { authUser: { ...state.authUser, ...lists } } : state
      );
      if ("lockedChats" in lists || "lockedGroups" in lists) {
        get().getUsers();
        useGroupStore.getState().getGroups();
      }
    });

    // Transcript progress for a DM voice note. Emitted only to the two
    // participants, so nothing arrives here that this user may not see.
    socket.on("messageTranscript", ({ messageId, transcript }) => {
      applyTranscript(set, messageId, transcript || {});
    });

    // Handle read confirmation received from receiver
    socket.on("messagesRead", ({ userId, readAt }) => {
      console.log(`[Socket Client] Received messagesRead confirmation for user: ${userId}`);
      // The server's clock, not this device's, and no longer mirrored into
      // localStorage — that key was global to the browser, so switching
      // accounts carried one account's read state into another.
      set((state) => ({
        lastReadTimestamps: {
          ...state.lastReadTimestamps,
          [userId]: readAt || Date.now(),
        },
      }));
    });

    // Handle disappearing timer changes from receiver
    socket.on("disappearingTimerUpdate", ({ userId, timer }) => {
      console.log(`[Socket Client] Received disappearingTimerUpdate for user: ${userId} to: ${timer}`);
      const currentUser = useAuthStore.getState().authUser;
      if (currentUser) {
        useAuthStore.setState({
          authUser: {
            ...currentUser,
            disappearingTimers: {
              ...currentUser.disappearingTimers,
              [userId]: timer
            }
          }
        });
      }
    });

    // Handle user status changes (user goes offline)
    socket.on("userOffline", ({ userId, lastSeen }) => {
      console.log(`[Socket Client] Received userOffline for user: ${userId} at: ${lastSeen}`);
      set((state) => {
        const updatedUsers = state.users.map((u) =>
          u._id === userId ? { ...u, lastSeen } : u
        );
        const updatedSelectedUser =
          state.selectedUser && state.selectedUser._id === userId
            ? { ...state.selectedUser, lastSeen }
            : state.selectedUser;
        return {
          users: updatedUsers,
          selectedUser: updatedSelectedUser
        };
      });
    });

    // Handle typing indicators
    socket.on("typing", ({ senderId, isTyping }) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [senderId]: isTyping
        }
      }));
    });

    // Handle real-time message reactions
    socket.on("messageReaction", ({ messageId, reactions }) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, { reactions });
    });

    // Handle real-time message deletions
    socket.on("messageDeleted", ({ messageId, isDeletedForEveryone }) => {
      const patch = { isDeletedForEveryone, text: "", image: "", reactions: [] };
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, ...patch } : msg
        )
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, patch);
    });

    // Handle message editing
    socket.on("messageEdited", (editedMessage) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === editedMessage._id ? { ...msg, ...editedMessage } : msg
        )
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, editedMessage._id, editedMessage);
    });

    // Handle call User
    socket.on("callUser", async ({ signal, from, type }) => {
      const users = get().users;
      const caller = users.find((u) => u._id === from) || { _id: from, fullName: "Someone" };
      set({
        callState: "incoming",
        callType: type,
        callPartner: caller,
        incomingSignal: signal,
        isCaller: false
      });
    });

    // Handle call accepted
    socket.on("callAccepted", async ({ signal }) => {
      const pc = get().peerConnection;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await processPendingIceCandidates(pc);
          set({ callState: "connected" });
          callStartTime = Date.now();
        } catch (e) {
          console.error("Error setting remote description on callAccepted", e);
        }
      }
    });

    // Handle call ended
    socket.on("callEnded", () => {
      const { peerConnection, localStream, isCaller, callPartner, callType, callState } = get();
      
      // If we are the caller, we save the call log message to the database
      if (isCaller && callPartner) {
        let callStatus = "missed";
        let callDuration = 0;
        if (callState === "connected" && callStartTime) {
          callStatus = "completed";
          callDuration = Math.round((Date.now() - callStartTime) / 1000);
        }

        axiosInstance.post("/messages/call-log", {
          receiverId: callPartner._id,
          callType,
          callDuration,
          callStatus
        }).then((res) => {
          set((state) => ({ messages: upsertIntoList(state.messages, res.data) }));
        }).catch((err) => {
          console.error("Failed to save call log", err);
        });
      }

      callStartTime = null;
      pendingIceCandidates = [];

      if (peerConnection) {
        try {
          peerConnection.close();
        } catch (e) {}
      }
      const sharedScreen = get().screenStream;
      if (sharedScreen) {
        // A screen capture keeps the browser's "sharing" indicator up until
        // its tracks are stopped, even after the call is gone.
        sharedScreen.getTracks().forEach((track) => track.stop());
      }
      if (localStream) {
        try {
          localStream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
      set({
        callState: null,
        isScreenSharing: false,
        screenStream: null,
        callType: null,
        callPartner: null,
        localStream: null,
        remoteStream: null,
        peerConnection: null,
        incomingSignal: null,
        isCaller: false
      });
      toast("Call ended");
    });

    // Handle ICE candidates
    socket.on("iceCandidate", async ({ candidate }) => {
      const pc = get().peerConnection;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      } else {
        pendingIceCandidates.push(candidate);
      }
    });

    // Handle message pinning
    socket.on("messagePinned", (pinnedMsg) => {
      const { selectedUser } = get();
      if (selectedUser && (pinnedMsg.senderId === selectedUser._id || pinnedMsg.receiverId === selectedUser._id)) {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg._id === pinnedMsg._id ? pinnedMsg : (pinnedMsg.isPinned ? { ...msg, isPinned: false } : msg)
          ),
          pinnedMessage: pinnedMsg.isPinned ? pinnedMsg : null
        }));
      }
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, pinnedMsg._id, pinnedMsg);
    });

    // Handle chat wallpaper update
    socket.on("chatWallpaperUpdate", ({ updatedBy, wallpaper }) => {
      const authUser = useAuthStore.getState().authUser;
      if (authUser) {
        const currentWallpapers = authUser.chatWallpapers ? { ...authUser.chatWallpapers } : {};
        currentWallpapers[updatedBy] = wallpaper;
        useAuthStore.setState({
          authUser: { ...authUser, chatWallpapers: currentWallpapers }
        });
      }
    });

    // Handle view-once message viewed real-time update
    socket.on("messageViewed", ({ messageId, viewedBy }) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, viewedBy } : msg
        )
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, { viewedBy });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("messagesRead");
      socket.off("messageTranscript");
      socket.off("accountListsUpdated");
    socket.off("accountListsUpdated");
      socket.off("disappearingTimerUpdate");
      socket.off("userOffline");
      socket.off("typing");
      socket.off("messageReaction");
      socket.off("messageDeleted");
      socket.off("messageEdited");
      socket.off("callUser");
      socket.off("callAccepted");
      socket.off("callEnded");
      socket.off("iceCandidate");
      socket.off("messagePinned");
      socket.off("chatWallpaperUpdate");
      socket.off("messageViewed");
    }
  },

  setSelectedUser: (selectedUser) => {
    // Clear messages immediately on user switch to prevent stale flash
    
    // If we're switching to a direct user chat, clear any selected group to ensure chat view updates
    if (selectedUser) {
      try {
        useGroupStore.getState().setSelectedGroup(null);
      } catch (e) {
        // ignore cross-store errors
      }
    }
    set({ selectedUser, isRecipientProfileOpen: false, pinnedMessage: null, messages: [] });
    if (selectedUser) {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [selectedUser._id]: 0
        }
      }));
      // Emit read receipt immediately
      const socket = useAuthStore.getState().socket;
      const currentUser = useAuthStore.getState().authUser;
      if (socket && currentUser) {
        socket.emit("markAsRead", { senderId: selectedUser._id, receiverId: currentUser._id });
      }
    }
  },

  setDisappearingTimer: async (recipientId, timer) => {
    try {
      const res = await axiosInstance.post(`/messages/disappearing/${recipientId}`, { timer });
      useAuthStore.setState({ authUser: res.data });
      toast.success(`Disappearing messages set to ${timer === "off" ? "Off" : timer}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update disappearing messages");
    }
  },

  sendTypingStatus: (status) => {
    const socket = useAuthStore.getState().socket;
    const { selectedUser } = get();
    if (socket && selectedUser) {
      socket.emit("typing", { receiverId: selectedUser._id, isTyping: status });
    }
  },

  toggleReaction: async (messageId, emoji) => {
    const { messages } = get();
    const currentUser = useAuthStore.getState().authUser;
    if (!currentUser) return;

    // Group messages live in useGroupStore, so patching only `messages` left a
    // group reaction with nothing to update — the tap looked ignored even when the
    // request succeeded.
    const applyLocally = (list) =>
      list.map((msg) => {
        if (msg._id === messageId) {
          const reactions = msg.reactions || [];
          const existingIndex = reactions.findIndex(
            (r) => (r.userId === currentUser._id || r.userId?._id === currentUser._id)
          );
          let updatedReactions = [...reactions];
          if (existingIndex > -1) {
            if (updatedReactions[existingIndex].emoji === emoji) {
              updatedReactions.splice(existingIndex, 1);
            } else {
              updatedReactions[existingIndex] = { ...updatedReactions[existingIndex], emoji };
            }
          } else {
            updatedReactions.push({ userId: currentUser._id, emoji });
          }
            return { ...msg, reactions: updatedReactions };
        }
        return msg;
      });

    set((state) => ({ messages: applyLocally(state.messages) }));
    if (useGroupStore.getState().groupMessages?.some((m) => m._id === messageId)) {
      useGroupStore.setState((state) => ({ groupMessages: applyLocally(state.groupMessages) }));
    }

    try {
      const res = await axiosInstance.post(`/messages/reaction/${messageId}`, { emoji });
      set((state) => ({
        messages: state.messages.map((msg) => (msg._id === messageId ? res.data : msg)),
      }));
      // The server response is authoritative for the group copy too, otherwise a
      // group reaction stayed optimistic and vanished on the next fetch.
      patchGroupMessageLocally(messageId, { reactions: res.data?.reactions || [] });
      updateCachedMessage(currentUser._id, messageId, res.data);
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    }
  },

  toggleContactAction: async (contactId, action, { silent = false, scope = "user" } = {}) => {
    try {
      // scope tells the server which set of lists to touch. Groups keep their own,
      // because the DM arrays are ref:"User".
      const res = await axiosInstance.post(`/messages/action/${contactId}`, { action, scope });
      // Merge the three lists rather than replacing authUser: the response is
      // deliberately narrow now, so overwriting would drop every other field.
      const { favorites, archived, pinnedChats, favoriteGroups, archivedGroups, pinnedGroups } =
        res.data || {};
      useAuthStore.setState((state) =>
        state.authUser
          ? {
              authUser: {
                ...state.authUser,
                favorites,
                archived,
                pinnedChats,
                favoriteGroups,
                archivedGroups,
                pinnedGroups,
              },
            }
          : state
      );
      if (!silent) {
        const label =
          action === "favorite" ? "Favorites" : action === "pin" ? "Pinned" : "Archived";
        toast.success(`${label} updated`);
      }
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update action");
      return false;
    }
  },

  deleteMessage: async (messageId, type) => {
    const authUser = useAuthStore.getState().authUser;
    try {
      await axiosInstance.delete(`/messages/${messageId}`, { data: { type } });
      if (type === "me") {
        set((state) => ({
          messages: state.messages.filter((msg) => msg._id !== messageId)
        }));
        // Group messages live in useGroupStore, so patching only `messages`
        // left a deleted group message on screen until the next reload.
        removeGroupMessageLocally(messageId);
        if (authUser) deleteCachedMessage(authUser._id, messageId);
        toast.success("Message deleted for you");
      } else {
        const patch = { isDeletedForEveryone: true, text: "", image: "", reactions: [] };
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg._id === messageId ? { ...msg, ...patch } : msg
          )
        }));
        patchGroupMessageLocally(messageId, patch);
        if (authUser) updateCachedMessage(authUser._id, messageId, patch);
        toast.success("Message deleted for everyone");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  /** Per-message read state for the "Message info" sheet. */
  /**
   * Asks the server to transcribe a voice note.
   *
   * The server owns duplicate prevention, so this stays thin: it writes back
   * whatever state comes home and lets the socket deliver the finished text. A
   * completed transcript comes straight from the database, so a second viewer
   * costs nothing.
   */
  requestTranscript: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/transcribe`);
      applyTranscript(set, messageId, res.data || {});
      return res.data;
    } catch (error) {
      const detail = error.response?.data?.message || "Couldn't start transcription";
      applyTranscript(set, messageId, { status: "failed", error: detail });
      toast.error(detail);
      return null;
    }
  },

  getMessageInfo: async (messageId) => {
    try {
      const res = await axiosInstance.get(`/messages/info/${messageId}`);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load message info");
      return null;
    }
  },

  clearChatHistory: async (contactId) => {
    const authUser = useAuthStore.getState().authUser;
    try {
      await axiosInstance.delete(`/messages/clear/${contactId}`);
      if (authUser) clearCachedConversation(authUser._id, dmKey(contactId));

      // Drop the row from the sidebar as well, the way WhatsApp does — the
      // conversation is gone, so leaving the contact listed with an empty
      // preview looked like the delete had not worked. The server no longer
      // counts hidden messages either, so a refetch agrees; this just avoids
      // waiting for one. A new message re-adds the contact normally.
      set((state) => {
        const latestMessages = { ...state.latestMessages };
        delete latestMessages[contactId];
        const unreadCounts = { ...state.unreadCounts };
        delete unreadCounts[contactId];
        const isOpen = state.selectedUser?._id === contactId;
        return {
          messages: isOpen ? [] : state.messages,
          users: state.users.filter((u) => u._id !== contactId),
          latestMessages,
          unreadCounts,
          ...(isOpen ? { selectedUser: null } : {}),
        };
      });

      toast.success("Chat deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear history");
    }
  },

  viewOneViewMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/view-once/${messageId}`);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? res.data : msg
        )
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, res.data);
    } catch (error) {
      console.error("Failed to view one-view message:", error);
    }
  },

  deleteMessagesBulk: async (messageIds, type) => {
    const authUser = useAuthStore.getState().authUser;
    try {
      await axiosInstance.post("/messages/delete-bulk", { messageIds, type });
      if (type === "me") {
        set((state) => ({
          messages: state.messages.filter((msg) => !messageIds.includes(msg._id))
        }));
        messageIds.forEach((id) => removeGroupMessageLocally(id));
        if (authUser) messageIds.forEach((id) => deleteCachedMessage(authUser._id, id));
        toast.success("Selected messages deleted for you");
      } else {
        const patch = { isDeletedForEveryone: true, text: "", image: "", reactions: [] };
        set((state) => ({
          messages: state.messages.map((msg) =>
            messageIds.includes(msg._id)
              ? { ...msg, ...patch }
              : msg
          )
        }));
        messageIds.forEach((id) => patchGroupMessageLocally(id, patch));
        if (authUser) messageIds.forEach((id) => updateCachedMessage(authUser._id, id, patch));
        toast.success("Selected messages deleted for everyone");
      }
      set({ isSelectionMode: false, selectedMessageIds: [] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete selected messages");
    }
  },

  editMessage: async (messageId, newText) => {
    try {
      const res = await axiosInstance.put(`/messages/edit/${messageId}`, { text: newText });
      const updatedMessage = res.data;
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? updatedMessage : msg
        ),
        // Bring the conversation back to the newest message after an edit, so
        // the view is not left parked at whatever older message was edited.
        scrollToBottomSignal: state.scrollToBottomSignal + 1,
      }));
      patchGroupMessageLocally(messageId, updatedMessage);
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, updatedMessage);
      toast.success("Message edited");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
    }
  },

  cancelScheduledMessage: async (messageId) => {
    try {
      await axiosInstance.post(`/messages/schedule/cancel/${messageId}`);
      set((state) => ({
        messages: state.messages.map((m) => m._id === messageId ? { ...m, scheduledStatus: 'failed' } : m)
      }));
      toast.success('Scheduled message cancelled');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel scheduled message');
    }
  },

  // Private rename for one contact. Lives on the signed-in user's own record,
  // so it follows the account across devices and is invisible to the contact.
  // Passing an empty string clears it and restores their real name.
  setContactNickname: async (contactId, nickname) => {
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return false;

    const previous = authUser.contactNicknames || {};
    const trimmed = String(nickname || "").trim();

    // Optimistic: renaming should feel instant, and the failure path below
    // puts the old value back.
    const optimistic = { ...previous };
    if (trimmed) optimistic[contactId] = trimmed;
    else delete optimistic[contactId];
    useAuthStore.setState({ authUser: { ...authUser, contactNicknames: optimistic } });

    try {
      await axiosInstance.post(`/messages/nickname/${contactId}`, { nickname: trimmed });
      toast.success(trimmed ? "Nickname saved" : "Nickname removed");
      return true;
    } catch (error) {
      useAuthStore.setState({
        authUser: { ...useAuthStore.getState().authUser, contactNicknames: previous },
      });
      toast.error(
        isNetworkError(error)
          ? "You're offline — nickname not saved"
          : error.response?.data?.message || "Could not save the nickname"
      );
      return false;
    }
  },

  toggleBlockUser: async (targetId) => {
    try {
      const res = await axiosInstance.post(`/messages/block/${targetId}`);
      const { blockedUsers, isBlocked } = res.data;
      // Merge just the list: the endpoint no longer returns (and must not
      // return) the whole user document.
      useAuthStore.setState((state) =>
        state.authUser ? { authUser: { ...state.authUser, blockedUsers } } : state
      );
      toast.success(isBlocked ? "User blocked" : "User unblocked");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change block status");
    }
  },

  startCall: async (type) => {
    const selectedUser = get().selectedUser;
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!selectedUser || !socket || !authUser) return;

    set({ callState: "ringing", callType: type, callPartner: selectedUser, isCaller: true });

    try {
      // If we already have a local stream, stop its tracks before requesting new one
      const existing = get().localStream;
      if (existing) {
        try { existing.getTracks().forEach(t => t.stop()); } catch (e) {}
        set({ localStream: null });
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: type === "video", audio: true });
      } catch (err) {
        // If camera/device is busy, gracefully fallback to audio-only for video calls
        if (type === "video" && (err?.name === "NotReadableError" || err?.message?.toLowerCase().includes("device"))) {
          toast.error("Camera is busy — starting audio-only call");
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          type = "voice"; // downgrade to voice
        } else {
          throw err;
        }
      }
      set({ localStream: stream });

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:openrelay.metered.ca:80" },
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turn:openrelay.metered.ca:443?transport=tcp"
            ],
            username: "openrelay",
            credential: "openrelay"
          }
        ]
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", { candidate: event.candidate, to: selectedUser._id });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", {
        userToCall: selectedUser._id,
        signalData: offer,
        from: authUser._id,
        type
      });

      get().setPeerConnection(pc);
    } catch (err) {
      console.error("Failed to start call", err);
      toast.error("Could not access camera/microphone");
      get().endCall();
    }
  },

  acceptCall: async () => {
    const { callPartner, incomingSignal, callType } = get();
    const socket = useAuthStore.getState().socket;
    if (!callPartner || !incomingSignal || !socket) return;
    try {
      // Stop any existing local stream tracks before requesting permissions
      const existing = get().localStream;
      if (existing) {
        try { existing.getTracks().forEach(t => t.stop()); } catch (e) {}
        set({ localStream: null });
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: callType === "video", audio: true });
      } catch (err) {
        if (callType === "video" && (err?.name === "NotReadableError" || err?.message?.toLowerCase().includes("device"))) {
          toast.error("Camera is busy — joining audio-only");
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } else {
          throw err;
        }
      }
      set({ localStream: stream });

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:openrelay.metered.ca:80" },
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turn:openrelay.metered.ca:443?transport=tcp"
            ],
            username: "openrelay",
            credential: "openrelay"
          }
        ]
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", { candidate: event.candidate, to: callPartner._id });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      await processPendingIceCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", { signal: answer, to: callPartner._id });

      get().setPeerConnection(pc);
      set({ callState: "connected" });
      callStartTime = Date.now();
    } catch (err) {
      console.error("Failed to accept call", err);
      // Provide clearer feedback for common device errors
      if (err?.name === "NotReadableError" || err?.message?.toLowerCase().includes("device")) {
        toast.error("Could not access camera — it may be in use by another application");
      } else {
        toast.error("Could not accept call");
      }
      get().endCall();
    }
  },

  rejectCall: () => {
    get().endCall();
  },

  endCall: () => {
    const { peerConnection, localStream, callPartner, callType, callState, isCaller } = get();
    const socket = useAuthStore.getState().socket;

    if (isCaller && callPartner) {
      let callStatus = "missed";
      let callDuration = 0;
      if (callState === "connected" && callStartTime) {
        callStatus = "completed";
        callDuration = Math.round((Date.now() - callStartTime) / 1000);
      }

      axiosInstance.post("/messages/call-log", {
        receiverId: callPartner._id,
        callType,
        callDuration,
        callStatus
      }).then((res) => {
        set((state) => ({ messages: upsertIntoList(state.messages, res.data) }));
      }).catch((err) => {
        console.error("Failed to save call log", err);
      });
    }

    if (callPartner && socket) {
      socket.emit("endCall", { to: callPartner._id });
    }

    callStartTime = null;
    pendingIceCandidates = [];

    if (peerConnection) {
      try {
        peerConnection.close();
      } catch (e) {}
    }

    if (localStream) {
      try {
        localStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
    }

    set({
      callState: null,
      callType: null,
      callPartner: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      incomingSignal: null,
      isCaller: false
    });
  },

  toggleLocalMute: () => {
    const localStream = get().localStream;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  },

  toggleScreenShare: async () => {
    const pc = get().peerConnection;
    const localStream = get().localStream;
    const isScreenSharing = get().isScreenSharing;

    if (!pc) return;

    try {
      if (isScreenSharing) {
        // Stop screen share and restore camera track
        const screenStream = get().screenStream;
        if (screenStream) {
          screenStream.getTracks().forEach((t) => t.stop());
        }

        // Replace sender track with camera video track
        const cameraTrack = localStream && localStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);

        set({ isScreenSharing: false, screenStream: null });
      } else {
        // Start screen share
        // eslint-disable-next-line no-undef
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender && screenTrack) await sender.replaceTrack(screenTrack);
        set({ isScreenSharing: true, screenStream });
      }
    } catch (err) {
      console.error("Screen share toggle failed", err);
    }
  },

  togglePinMessage: async (messageId) => {
    try {
      const res = await axiosInstance.put(`/messages/pin/${messageId}`);
      const updatedMessage = res.data;
      
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? updatedMessage : (updatedMessage.isPinned ? { ...msg, isPinned: false } : msg)
        ),
        pinnedMessage: updatedMessage.isPinned ? updatedMessage : null
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, updatedMessage);

      toast.success(updatedMessage.isPinned ? "Message pinned" : "Message unpinned");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to toggle pin");
    }
  },

  setConversationWallpaper: async (wallpaper) => {
    const selectedUser = get().selectedUser;
    if (!selectedUser) return;
    try {
      const res = await axiosInstance.post(`/messages/wallpaper/${selectedUser._id}`, { wallpaper });
      useAuthStore.setState({ authUser: res.data.myUser });
      toast.success("Chat theme updated for both");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update chat theme");
    }
  }
}));