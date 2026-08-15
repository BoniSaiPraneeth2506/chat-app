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
  lastReadTimestamps: JSON.parse(localStorage.getItem("lastReadTimestamps") || "{}"),
  hasMoreMessages: true,
  isRecipientProfileOpen: false,
  setIsRecipientProfileOpen: (isOpen) => set({ isRecipientProfileOpen: isOpen }),

  // Advanced features states
  typingUsers: {},
  messageSearchQuery: "",
  replyingToMessage: null,
  editingMessage: null,
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
  toggleCallMinimize: () => set((state) => ({ isCallMinimized: !state.isCallMinimized })),

  pinnedMessage: null,
  setPinnedMessage: (pinnedMessage) => set({ pinnedMessage }),

  profilePreviewUser: null,
  setProfilePreviewUser: (profilePreviewUser) => set({ profilePreviewUser }),

  lightboxImage: null,
  setLightboxImage: (lightboxImage) => set({ lightboxImage }),

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
      set({ users });

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

    // Cache-first: paint instantly from whatever's already on the device
    // (like WhatsApp reopening a chat) while the network call confirms.
    const cached = authUser ? await getCachedMessages(authUser._id, conversationKey) : [];
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

      set({
        messages,
        hasMoreMessages: messages.length === limit,
        pinnedMessage
      });
      if (authUser) cacheMessages(authUser._id, conversationKey, messages);

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
        set({ hasMoreMessages: false });
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to load messages");
      }
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  loadMoreMessages: async (userId) => {
    const { messages, hasMoreMessages } = get();
    if (!hasMoreMessages) return;

    try {
      const limit = 20;
      const skip = Array.isArray(messages) ? messages.length : 0;
      const res = await axiosInstance.get(`/messages/${userId}?limit=${limit}&skip=${skip}`);
      const newMessages = Array.isArray(res.data) ? res.data : [];

      if (newMessages.length < limit) {
        set({ hasMoreMessages: false });
      }

      set({
        messages: [...newMessages, ...(Array.isArray(messages) ? messages : [])] // Prepend older messages to the top
      });
    } catch (error) {
      console.error("Failed to load more messages:", error);
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
      ? { ...messageData, replyTo: replyingToMessage._id }
      : messageData;

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
        ? { ...messageData, replyTo: replyingToMessage._id } 
        : messageData;

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
      // Build forward payload from original message content
      const payload = { isForwarded: true };
      if (!message.isDeletedForEveryone) {
        if (message.text) payload.text = message.text;
        if (message.image) payload.image = message.image;
        if (message.images) payload.images = message.images;
        if (message.voice) payload.voice = message.voice;
      }

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

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Clean up existing listeners to avoid duplicates
    socket.off("newMessage");
    socket.off("messagesRead");
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

      // Write-through to the local cache regardless of which chat is open,
      // so reopening this conversation later (even offline) shows it.
      if (currentUser) {
        const receiverKey = typeof newMessage.receiverId === 'object'
          ? (newMessage.receiverId._id || newMessage.receiverId.toString())
          : newMessage.receiverId;
        const otherPartyId = senderKey === currentUser._id ? receiverKey : senderKey;
        if (otherPartyId) cacheMessages(currentUser._id, dmKey(otherPartyId), [newMessage]);
      }

      // If the message is from the currently active chat, append or merge it
      if (selectedUser && (senderKey === selectedUser._id || newMessage.receiverId === selectedUser._id)) {
        set((state) => {
          // If we have an optimistic temp message (tempId) matching server _id, replace it
          const existingIndex = state.messages.findIndex(m => m._id === newMessage._id || m.tempId === newMessage._id || (m.tempId && newMessage.tempId && m.tempId === newMessage.tempId));
          if (existingIndex > -1) {
            const updated = [...state.messages];
            updated[existingIndex] = { ...updated[existingIndex], ...newMessage };
            return { messages: updated };
          }

          // Otherwise append, ensuring we keep any existing fields like scheduledAt if server omitted them
          return { messages: [...state.messages, { ...newMessage }] };
        });

        // Emit read receipt back immediately if privacy setting allows it
        if (currentUser && useThemeStore.getState().privacyReadReceipts) {
          console.log(`[Socket Client] Active chat message received. Emitting markAsRead for: ${selectedUser._id}`);
          socket.emit("markAsRead", { senderId: selectedUser._id, receiverId: currentUser._id });
        }
      } else {
        // Otherwise, increment the unread count for this sender
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [senderKey]: (state.unreadCounts[senderKey] || 0) + 1
          }
        }));
      }
    });

    // Handle read confirmation received from receiver
    socket.on("messagesRead", ({ userId }) => {
      console.log(`[Socket Client] Received messagesRead confirmation for user: ${userId}`);
      const updated = {
        ...get().lastReadTimestamps,
        [userId]: Date.now()
      };
      localStorage.setItem("lastReadTimestamps", JSON.stringify(updated));
      set({ lastReadTimestamps: updated });
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
          set((state) => ({
            messages: [...state.messages, res.data]
          }));
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

    // Optimistic UI update
    set((state) => ({
      messages: state.messages.map((msg) => {
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
      })
    }));

    try {
      const res = await axiosInstance.post(`/messages/reaction/${messageId}`, { emoji });
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? res.data : msg
        )
      }));
      updateCachedMessage(currentUser._id, messageId, res.data);
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    }
  },

  toggleContactAction: async (contactId, action) => {
    try {
      const res = await axiosInstance.post(`/messages/action/${contactId}`, { action });
      useAuthStore.setState({ authUser: res.data });
      toast.success(`${action === "favorite" ? "Favorites" : "Archived"} updated successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update action");
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
        if (authUser) deleteCachedMessage(authUser._id, messageId);
        toast.success("Message deleted for you");
      } else {
        const patch = { isDeletedForEveryone: true, text: "", image: "", reactions: [] };
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg._id === messageId ? { ...msg, ...patch } : msg
          )
        }));
        if (authUser) updateCachedMessage(authUser._id, messageId, patch);
        toast.success("Message deleted for everyone");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  clearChatHistory: async (contactId) => {
    const authUser = useAuthStore.getState().authUser;
    try {
      await axiosInstance.delete(`/messages/clear/${contactId}`);
      set({ messages: [] });
      if (authUser) clearCachedConversation(authUser._id, dmKey(contactId));
      toast.success("Conversation cleared successfully");
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
        )
      }));
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

  toggleBlockUser: async (targetId) => {
    try {
      const res = await axiosInstance.post(`/messages/block/${targetId}`);
      const { user, isBlocked } = res.data;
      useAuthStore.setState({ authUser: user });
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
        set((state) => ({
          messages: [...state.messages, res.data]
        }));
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