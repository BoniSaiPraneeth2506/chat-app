import { create } from "zustand";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";
import { useChatStore } from "./useChatStore";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isGroupsLoading: false,
  isGroupMessagesLoading: false,
  latestGroupMessages: {},
  unreadGroupCounts: {},
  groupTypingUsers: {},

  // Modals
  isCreateGroupModalOpen: false,
  isGroupDetailsModalOpen: false,
  setIsCreateGroupModalOpen: (isOpen) => set({ isCreateGroupModalOpen: isOpen }),
  setIsGroupDetailsModalOpen: (isOpen) => set({ isGroupDetailsModalOpen: isOpen }),

  // Multi-peer Group Call states
  activeGroupCall: null, // { groupId, type, groupName }
  isGroupCallActive: false,
  groupLocalStream: null,
  groupCallStartTime: null,
  groupRemoteStreams: {}, // { [socketId]: { stream, user } }
  peerConnectionsRef: {}, // { [socketId]: RTCPeerConnection }
  // Internal callbacks for centralized signaling handlers
  onAllGroupCallParticipants: null,
  onGroupCallUserJoined: null,
  onGroupCallSignalReceived: null,
  onGroupUserLeftCall: null,

  // 1. Fetch User Groups
  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      const groups = Array.isArray(res.data) ? res.data : [];
      set({ groups });

      // Auto-join socket rooms for all user groups
      const socket = useAuthStore.getState().socket;
      if (socket) {
        groups.forEach((g) => socket.emit("joinGroupRoom", g._id));
      }

      // Fetch latest message for each group
      const latestMsgs = {};
      await Promise.all(
        groups.map(async (group) => {
          try {
            const msgRes = await axiosInstance.get(`/groups/${group._id}/messages?limit=1`);
            const msgs = Array.isArray(msgRes.data) ? msgRes.data : [];
            if (msgs.length > 0) {
              latestMsgs[group._id] = msgs[msgs.length - 1];
            }
          } catch (err) {
            console.error("Error fetching group latest msg:", err);
          }
        })
      );
      set({ latestGroupMessages: latestMsgs });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  // 2. Create Group
  createGroup: async (groupData) => {
    try {
      const res = await axiosInstance.post("/groups", groupData);
      set((state) => ({
        groups: [res.data, ...state.groups],
        isCreateGroupModalOpen: false,
      }));

      // Join socket room
      const socket = useAuthStore.getState().socket;
      if (socket) socket.emit("joinGroupRoom", res.data._id);

      toast.success(`Group "${res.data.name}" created successfully!`);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
    }
  },

  // 3. Select Group
  setSelectedGroup: (group) => {
    // Deselect 1-on-1 user chat when group is selected
    if (group) {
      useChatStore.getState().setSelectedUser(null);
    }
    set({ selectedGroup: group, groupMessages: [] });

    if (group) {
      set((state) => ({
        unreadGroupCounts: {
          ...state.unreadGroupCounts,
          [group._id]: 0,
        },
      }));
      get().getGroupMessages(group._id);
    }
  },

  // 4. Get Group Messages
  getGroupMessages: async (groupId) => {
    set({ isGroupMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      set({ groupMessages: Array.isArray(res.data) ? res.data : [] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load group messages");
    } finally {
      set({ isGroupMessagesLoading: false });
    }
  },

  // 5. Send Group Message
  sendGroupMessage: async (messageData) => {
    const { selectedGroup, groupMessages } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!selectedGroup || !authUser) return;

    const tempId = "temp-group-" + Date.now();
    const optimisticMsg = {
      _id: tempId,
      tempId,
      senderId: {
        _id: authUser._id,
        fullName: authUser.fullName,
        profilePic: authUser.profilePic,
      },
      groupId: selectedGroup._id,
      text: messageData.text || "",
      image: messageData.image || "",
      images: messageData.images || [],
      voice: messageData.voice || "",
      createdAt: new Date().toISOString(),
      isSending: true,
    };

    set((state) => ({
      groupMessages: [...state.groupMessages, optimisticMsg],
      latestGroupMessages: {
        ...state.latestGroupMessages,
        [selectedGroup._id]: optimisticMsg,
      },
    }));

    try {
      const res = await axiosInstance.post(`/groups/${selectedGroup._id}/send`, messageData);
      const sentMsg = res.data;

      set((state) => ({
        groupMessages: state.groupMessages.map((m) =>
          m._id === tempId || m.tempId === tempId ? sentMsg : m
        ),
        latestGroupMessages: {
          ...state.latestGroupMessages,
          [selectedGroup._id]: sentMsg,
        },
      }));
    } catch (error) {
      set((state) => ({
        groupMessages: state.groupMessages.filter((m) => m._id !== tempId),
      }));
      toast.error(error.response?.data?.message || "Failed to send group message");
    }
  },

  cancelScheduledMessage: async (messageId) => {
    try {
      await axiosInstance.post(`/messages/schedule/cancel/${messageId}`);
      set((state) => ({
        groupMessages: state.groupMessages.map((m) => m._id === messageId ? { ...m, scheduledStatus: 'failed' } : m)
      }));
      toast.success('Scheduled message cancelled');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel scheduled message');
    }
  },

  // 6. Update Group
  updateGroup: async (groupId, updateData) => {
    try {
      const res = await axiosInstance.put(`/groups/${groupId}`, updateData);
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Group settings updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
    }
  },

  // 7. Add Group Members
  addGroupMembers: async (groupId, newMembers) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/members`, { newMembers });
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success("Members added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add members");
    }
  },

  // 8. Remove Group Member or Leave
  removeGroupMember: async (groupId, memberId) => {
    const authUser = useAuthStore.getState().authUser;
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}`);
      if (authUser && memberId === authUser._id) {
        // User left group
        set((state) => ({
          groups: state.groups.filter((g) => g._id !== groupId),
          selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
          isGroupDetailsModalOpen: false,
        }));
        toast.success("You left the group");
      } else {
        set((state) => ({
          groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
          selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
        }));
        toast.success("Member removed");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  },

  // 9. Update Member Role
  updateMemberRole: async (groupId, targetUserId, newRole) => {
    try {
      const res = await axiosInstance.put(`/groups/${groupId}/roles`, { targetUserId, newRole });
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup,
      }));
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update member role");
    }
  },

  // 10. Group Typing Status
  sendGroupTypingStatus: (groupId, isTyping) => {
    const socket = useAuthStore.getState().socket;
    if (socket && groupId) {
      socket.emit("groupTyping", { groupId, isTyping });
    }
  },

  // 11. Real-time Subscriptions
  subscribeToGroupEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newGroupMessage");
    socket.off("groupCreated");
    socket.off("groupUpdated");
    socket.off("groupTyping");
    socket.off("removedFromGroup");
    socket.off("groupCallStarted");
    socket.off("allGroupCallParticipants");
    socket.off("groupCallUserJoined");
    socket.off("groupCallSignalReceived");
    socket.off("groupUserLeftCall");

    // New Group Message
    socket.on("newGroupMessage", (message) => {
      const { selectedGroup } = get();
      const currentUser = useAuthStore.getState().authUser;

      // Don't ignore server-created call logs even when sender is current user
      if (message.senderId?._id === currentUser?._id && !message.isCallLog) return;

      set((state) => ({
        latestGroupMessages: {
          ...state.latestGroupMessages,
          [message.groupId]: message,
        },
      }));

      if (selectedGroup && selectedGroup._id === message.groupId) {
        set((state) => ({
          groupMessages: [...state.groupMessages, message],
        }));
      } else {
        set((state) => ({
          unreadGroupCounts: {
            ...state.unreadGroupCounts,
            [message.groupId]: (state.unreadGroupCounts[message.groupId] || 0) + 1,
          },
        }));
      }
    });

    // Group Created Notification
    socket.on("groupCreated", (newGroup) => {
      set((state) => ({
        groups: [newGroup, ...state.groups],
      }));
      socket.emit("joinGroupRoom", newGroup._id);
    });

    // Group Updated Notification
    socket.on("groupUpdated", (updatedGroup) => {
      set((state) => ({
        groups: state.groups.map((g) => (g._id === updatedGroup._id ? updatedGroup : g)),
        selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
    });

    // Removed from Group
    socket.on("removedFromGroup", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((g) => g._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
      }));
      toast("You were removed from a group");
    });

    // Group Typing
    socket.on("groupTyping", ({ groupId, userId, isTyping }) => {
      set((state) => ({
        groupTypingUsers: {
          ...state.groupTypingUsers,
          [groupId]: {
            ...(state.groupTypingUsers[groupId] || {}),
            [userId]: isTyping,
          },
        },
      }));
    });

    // ── Group Multi-Peer Call Event Listeners ──
    socket.on("groupCallStarted", ({ groupId, type, groupName, startedBy }) => {
      const authUser = useAuthStore.getState().authUser;
      // Show modal for incoming group call and allow user to join (not auto-join)
      set({
        activeGroupCall: { groupId, type, groupName, startedBy },
        isGroupCallActive: true,
      });
      if (startedBy !== authUser?._id) {
        toast(`Group call started in "${groupName}"!`);
      }
    });

    // Centralized WebRTC signaling handlers that forward to dynamic callbacks
    socket.on("allGroupCallParticipants", (participants) => {
      const cb = get().onAllGroupCallParticipants;
      if (typeof cb === "function") cb(participants);
    });

    socket.on("groupCallUserJoined", (payload) => {
      const cb = get().onGroupCallUserJoined;
      if (typeof cb === "function") cb(payload);
    });

    socket.on("groupCallSignalReceived", (payload) => {
      const cb = get().onGroupCallSignalReceived;
      if (typeof cb === "function") cb(payload);
    });

    socket.on("groupUserLeftCall", (payload) => {
      const cb = get().onGroupUserLeftCall;
      if (typeof cb === "function") cb(payload);
    });

    socket.on("groupCallEnded", ({ groupId, duration, endedBy, startedBy, type }) => {
      const { activeGroupCall } = get();
      if (activeGroupCall && activeGroupCall.groupId === groupId) {
        // local cleanup when server reports call ended
        const pcs = get().peerConnectionsRef || {};
        Object.values(pcs).forEach((pc) => {
          try { pc.close(); } catch (e) {}
        });
        const localStream = get().groupLocalStream;
        if (localStream) localStream.getTracks().forEach((t) => t.stop());

        set({
          isGroupCallActive: false,
          activeGroupCall: null,
          groupLocalStream: null,
          groupRemoteStreams: {},
          peerConnectionsRef: {},
        });

        toast(`Group call ended (${Math.max(0, Math.floor(duration/60))}m ${duration%60}s)`);
      }
    });
  },

  unsubscribeFromGroupEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newGroupMessage");
      socket.off("groupCreated");
      socket.off("groupUpdated");
      socket.off("groupTyping");
      socket.off("removedFromGroup");
      socket.off("groupCallStarted");
      socket.off("allGroupCallParticipants");
      socket.off("groupCallUserJoined");
      socket.off("groupCallSignalReceived");
      socket.off("groupUserLeftCall");
    }
  },

  // 12. Group Call Control Methods (WebRTC Multi-Peer Mesh)
  startOrJoinGroupCall: async (groupId, type) => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    const { groups } = get();
    const group = groups.find((g) => g._id === groupId);
    const groupName = group ? group.name : "Group Call";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      set({
        groupLocalStream: stream,
        isGroupCallActive: true,
        activeGroupCall: { groupId, type, groupName },
        groupCallStartTime: Date.now(),
        groupRemoteStreams: {},
        peerConnectionsRef: {},
      });

      if (socket) {
        socket.emit("startGroupCall", { groupId, type, groupName });
        socket.emit("joinGroupCall", { groupId, user: { _id: authUser._id, fullName: authUser.fullName, profilePic: authUser.profilePic } });
      }

      // Instead of registering socket handlers here (which can cause duplicates),
      // set dynamic callbacks that the centralized listeners will invoke.
      set({
        onAllGroupCallParticipants: (participants) => {
          participants.forEach(({ socketId, userId }) => {
            const pc = createPeerConnection(socketId, stream, socket, authUser);
            get().peerConnectionsRef[socketId] = pc;

            // Create offer to existing participant
            pc.createOffer().then((offer) => {
              pc.setLocalDescription(offer);
              socket.emit("sendGroupSignal", {
                toSocketId: socketId,
                signal: offer,
                fromUser: { _id: authUser._id, fullName: authUser.fullName, profilePic: authUser.profilePic },
              });
            });
          });
        },
        onGroupCallUserJoined: ({ socketId, user }) => {
          toast(`${user.fullName} joined group call`);
        },
        onGroupCallSignalReceived: async ({ fromSocketId, signal, fromUser }) => {
          let pc = get().peerConnectionsRef[fromSocketId];
          if (!pc) {
            pc = createPeerConnection(fromSocketId, stream, socket, authUser, fromUser);
            get().peerConnectionsRef[fromSocketId] = pc;
          }

          if (signal.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("sendGroupSignal", {
              toSocketId: fromSocketId,
              signal: answer,
              fromUser: { _id: authUser._id, fullName: authUser.fullName, profilePic: authUser.profilePic },
            });
          } else if (signal.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          } else if (signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.error("Error adding ice candidate in group call:", e);
            }
          }
        },
        onGroupUserLeftCall: ({ socketId }) => {
          const pc = get().peerConnectionsRef[socketId];
          if (pc) {
            pc.close();
            delete get().peerConnectionsRef[socketId];
          }
          set((state) => {
            const updatedStreams = { ...state.groupRemoteStreams };
            delete updatedStreams[socketId];
            return { groupRemoteStreams: updatedStreams };
          });
        },
      });

    } catch (err) {
      console.error("Failed to start group call:", err);
      toast.error("Could not access camera/microphone");
    }
  },

  leaveGroupCall: async () => {
    const socket = useAuthStore.getState().socket;
    const { activeGroupCall, groupLocalStream, peerConnectionsRef } = get();

    if (socket && activeGroupCall) {
      const authUser = useAuthStore.getState().authUser;
      // If the starter ends the call, ask server to end for everyone; otherwise just leave
      if (activeGroupCall.startedBy && authUser && authUser._id === activeGroupCall.startedBy) {
        socket.emit("endGroupCall", { groupId: activeGroupCall.groupId });
      } else {
        socket.emit("leaveGroupCall", { groupId: activeGroupCall.groupId });
      }
      // Server will create the canonical call log when the call actually ends
    }

    if (groupLocalStream) {
      groupLocalStream.getTracks().forEach((track) => track.stop());
    }

    Object.values(peerConnectionsRef).forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });

    set({
      isGroupCallActive: false,
      activeGroupCall: null,
      groupLocalStream: null,
      groupRemoteStreams: {},
      peerConnectionsRef: {},
    });
    toast("Left group call");

    // Clear dynamic callbacks registered for signaling
    set({
      onAllGroupCallParticipants: null,
      onGroupCallUserJoined: null,
      onGroupCallSignalReceived: null,
      onGroupUserLeftCall: null,
    });
  },
}));

// Helper function to create peer connections for group mesh call
function createPeerConnection(targetSocketId, localStream, socket, authUser, remoteUser = null) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ],
  });

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sendGroupSignal", {
        toSocketId: targetSocketId,
        signal: { candidate: event.candidate },
        fromUser: { _id: authUser._id, fullName: authUser.fullName, profilePic: authUser.profilePic },
      });
    }
  };

  pc.ontrack = (event) => {
    useGroupStore.setState((state) => ({
      groupRemoteStreams: {
        ...state.groupRemoteStreams,
        [targetSocketId]: {
          stream: event.streams[0],
          user: remoteUser || { fullName: "Group Member" },
        },
      },
    }));
  };

  return pc;
}
