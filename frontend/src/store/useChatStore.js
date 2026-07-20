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
  showArchivedOnly: false,

  setMessageSearchQuery: (query) => set({ messageSearchQuery: query }),
  setReplyingToMessage: (message) => set({ replyingToMessage: message }),
  setShowArchivedOnly: (show) => set({ showArchivedOnly: show }),

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
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
    set({ isMessagesLoading: true, hasMoreMessages: true });
    try {
      const limit = 20;
      const res = await axiosInstance.get(`/messages/${userId}?limit=${limit}&skip=0`);
      const messages = Array.isArray(res.data) ? res.data : [];
      set({ 
        messages,
        hasMoreMessages: messages.length === limit
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
  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Clean up existing listeners to avoid duplicates
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("typing");
    socket.off("messageReaction");
    socket.off("messageDeleted");

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
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser, isRecipientProfileOpen: false });
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
  }
}));