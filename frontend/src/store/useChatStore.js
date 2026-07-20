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

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      const users = res.data;
      set({ users });

      // Fetch the last message for each user to populate latestMessages
      const latestMsgs = {};
      await Promise.all(
        users.map(async (user) => {
          try {
            const msgRes = await axiosInstance.get(`/messages/${user._id}`);
            const userMessages = msgRes.data;
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
      set({ 
        messages: res.data,
        hasMoreMessages: res.data.length === limit
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
      const skip = messages.length;
      const res = await axiosInstance.get(`/messages/${userId}?limit=${limit}&skip=${skip}`);
      const newMessages = res.data;

      if (newMessages.length < limit) {
        set({ hasMoreMessages: false });
      }

      set({
        messages: [...newMessages, ...messages] // Prepend older messages to the top
      });
    } catch (error) {
      console.error("Failed to load more messages:", error);
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      const sentMessage = res.data;
      set({ 
        messages: [...messages, sentMessage],
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
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("messagesRead");
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
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
  }
}));