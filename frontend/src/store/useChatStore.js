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
import { useThemeStore } from "./useThemeStore";

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

  setMessageSearchQuery: (query) => set({ messageSearchQuery: query }),
  setReplyingToMessage: (message) => set({ replyingToMessage: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),
  setShowArchivedOnly: (show) => set({ showArchivedOnly: show }),

  getUsers: async (search = "") => {
    set({ isUsersLoading: true });
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
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    // Clear messages immediately so old chat doesn't flash while new one loads
    set({ isMessagesLoading: true, hasMoreMessages: true, messages: [] });
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

      // Emit markAsRead to receiver
      const socket = useAuthStore.getState().socket;
      const currentUser = useAuthStore.getState().authUser;
      if (socket && currentUser) {
        socket.emit("markAsRead", { senderId: userId, receiverId: currentUser._id });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to load messages");
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
    const { selectedUser, messages, replyingToMessage } = get();
    try {
      const payload = replyingToMessage 
        ? { ...messageData, replyTo: replyingToMessage._id } 
        : messageData;

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      const sentMessage = res.data;
      set({ 
        messages: [...messages, sentMessage],
        replyingToMessage: null,
        latestMessages: {
          ...get().latestMessages,
          [selectedUser._id]: sentMessage
        }
      });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to send message");
    }
  },

  forwardMessage: async (message, recipientIds) => {
    try {
      // Build forward payload from original message content
      const payload = { isForwarded: true };
      if (!message.isDeletedForEveryone) {
        if (message.text) payload.text = message.text;
        if (message.image) payload.image = message.image;
        if (message.voice) payload.voice = message.voice;
      }

      const results = await Promise.all(
        recipientIds.map((id) => axiosInstance.post(`/messages/send/${id}`, payload))
      );

      // Update latestMessages and current chat messages for each forwarded recipient
      results.forEach((res, idx) => {
        const sentMsg = res.data;
        const { selectedUser } = get();
        set((state) => ({
          latestMessages: { ...state.latestMessages, [recipientIds[idx]]: sentMsg },
        }));
        if (selectedUser && recipientIds[idx] === selectedUser._id) {
          set((state) => ({ messages: [...state.messages, sentMsg] }));
        }
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
    if (selectedUser && currentUser) {
      console.log(`[Socket Client] Emitting markAsRead on initialization for user: ${selectedUser._id}`);
      socket.emit("markAsRead", { senderId: selectedUser._id, receiverId: currentUser._id });
    }

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, messages } = get();
      const currentUser = useAuthStore.getState().authUser;

      if (newMessage.senderId === currentUser?._id && newMessage.receiverId === currentUser?._id) {
        return;
      }
      
      if (useThemeStore.getState().soundEnabled) {
        try {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav");
          audio.volume = 0.5;
          audio.play();
        } catch (err) {
          console.error("Failed to play notification sound:", err);
        }
      }
      
      // Update latest message for the sender
      set((state) => ({
        latestMessages: {
          ...state.latestMessages,
          [newMessage.senderId]: newMessage
        }
      }));

      // If the message is from the currently active chat, append it
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        set({
          messages: [...messages, newMessage],
        });
        // Emit read receipt back immediately
        if (currentUser) {
          console.log(`[Socket Client] Active chat message received. Emitting markAsRead for: ${selectedUser._id}`);
          socket.emit("markAsRead", { senderId: selectedUser._id, receiverId: currentUser._id });
        }
      } else {
        // Otherwise, increment the unread count for this sender
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [newMessage.senderId]: (state.unreadCounts[newMessage.senderId] || 0) + 1
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
    });

    // Handle real-time message deletions
    socket.on("messageDeleted", ({ messageId, isDeletedForEveryone }) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, isDeletedForEveryone, text: "", image: "", reactions: [] } : msg
        )
      }));
    });

    // Handle message editing
    socket.on("messageEdited", (editedMessage) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === editedMessage._id ? editedMessage : msg
        )
      }));
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
    }
  },

  setSelectedUser: (selectedUser) => {
    // Clear messages immediately on user switch to prevent stale flash
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

  sendTypingStatus: (isTyping) => {
    const socket = useAuthStore.getState().socket;
    const { selectedUser } = get();
    if (socket && selectedUser) {
      socket.emit("typing", { receiverId: selectedUser._id, isTyping });
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
    try {
      await axiosInstance.delete(`/messages/${messageId}`, { data: { type } });
      if (type === "me") {
        set((state) => ({
          messages: state.messages.filter((msg) => msg._id !== messageId)
        }));
        toast.success("Message deleted for you");
      } else {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg._id === messageId ? { ...msg, isDeletedForEveryone: true, text: "", image: "", reactions: [] } : msg
          )
        }));
        toast.success("Message deleted for everyone");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  clearChatHistory: async (contactId) => {
    try {
      await axiosInstance.delete(`/messages/clear/${contactId}`);
      set({ messages: [] });
      toast.success("Conversation cleared successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear history");
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
      toast.success("Message edited");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true
      });
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

    set({ callState: "connected" });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true
      });
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
      callStartTime = Date.now();
    } catch (err) {
      console.error("Failed to accept call", err);
      toast.error("Could not accept call");
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