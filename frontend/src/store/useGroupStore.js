import { create } from "zustand";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import {
  cacheMessages,
  getCachedMessages,
  updateCachedMessage,
  cacheConversationsMeta,
  getCachedConversationsMeta,
  addToOutbox,
  getOutbox,
  removeFromOutbox,
} from "../lib/db";
import { isNetworkError } from "../lib/network";

// Mirrors dmKey in useChatStore.js — same per-conversation cache, distinct prefix.
const groupKey = (groupId) => `group:${groupId}`;

/**
 * Inserts a group at the top of the list, or replaces it in place if it's
 * already there.
 *
 * A newly created group arrives twice for its creator: once as the HTTP
 * response to POST /groups, and once as the `groupCreated` socket event, which
 * the server broadcasts to every member — the creator included. Prepending
 * blindly on both paths showed the group twice until the next refetch replaced
 * the list. Deduping here rather than suppressing the emit keeps the event
 * useful for the creator's other sessions.
 */
const upsertGroup = (groups, group) => {
  if (!group?._id) return groups;
  const id = String(group._id);
  const exists = groups.some((g) => String(g._id) === id);
  return exists
    ? groups.map((g) => (String(g._id) === id ? group : g)) // refresh in place
    : [group, ...groups];                                   // genuinely new
};

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isGroupsLoading: false,
  isGroupMessagesLoading: false,
  latestGroupMessages: {},
  unreadGroupCounts: {},
  // Groups where an unread message @-mentions you — surfaced ahead of a
  // plain unread count, since being named is a stronger signal.
  mentionedGroups: {},
  groupTypingUsers: {},

  // The group whose sidebar avatar was tapped — mirrors profilePreviewUser for
  // one-to-one chats, so an avatar means "show me this" in both lists rather than
  // only in one of them.
  groupPreview: null,
  setGroupPreview: (groupPreview) => set({ groupPreview }),

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
  raisedHands: {}, // { [userId]: true } — who currently has a hand up
  isHandRaised: false,
  peerConnectionsRef: {}, // { [socketId]: RTCPeerConnection }
  // Internal callbacks for centralized signaling handlers
  onAllGroupCallParticipants: null,
  onGroupCallUserJoined: null,
  onGroupCallSignalReceived: null,
  onGroupUserLeftCall: null,

  // ── Invite links ──────────────────────────────────────────────────────
  createGroupInvite: async (groupId) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/invite`);
      set((state) => ({
        groups: state.groups.map((g) =>
          g._id === groupId ? { ...g, inviteCode: res.data.inviteCode } : g
        ),
        selectedGroup:
          state.selectedGroup?._id === groupId
            ? { ...state.selectedGroup, inviteCode: res.data.inviteCode }
            : state.selectedGroup,
      }));
      return res.data.inviteCode;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create an invite link");
      return null;
    }
  },

  revokeGroupInvite: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}/invite`);
      set((state) => ({
        groups: state.groups.map((g) =>
          g._id === groupId ? { ...g, inviteCode: undefined } : g
        ),
        selectedGroup:
          state.selectedGroup?._id === groupId
            ? { ...state.selectedGroup, inviteCode: undefined }
            : state.selectedGroup,
      }));
      toast.success("Invite link revoked");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not revoke the link");
      return false;
    }
  },

  joinGroupByInvite: async (code) => {
    try {
      const res = await axiosInstance.post(`/groups/invite/${code}/join`);
      const group = res.data.group;
      set((state) => ({ groups: upsertGroup(state.groups, group) }));

      const socket = useAuthStore.getState().socket;
      if (socket) socket.emit("joinGroupRoom", group._id);

      toast.success(res.data.alreadyMember ? `Opened ${group.name}` : `Joined ${group.name}`);
      return group;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not join this group");
      return null;
    }
  },

  // Raise / lower your hand in the active group call.
  toggleRaiseHand: () => {
    const { activeGroupCall, isHandRaised } = get();
    const socket = useAuthStore.getState().socket;
    if (!activeGroupCall || !socket) return;
    const raised = !isHandRaised;
    set({ isHandRaised: raised });
    socket.emit("groupRaiseHand", { groupId: activeGroupCall.groupId, raised });
  },

  // Ask everyone else to mute. Only the person who started the call may do
  // this, and the server enforces that — a client cannot silence another
  // client's microphone directly, so each one mutes itself on receipt.
  muteAllParticipants: () => {
    const { activeGroupCall } = get();
    const socket = useAuthStore.getState().socket;
    if (!activeGroupCall || !socket) return;
    socket.emit("groupMuteAll", { groupId: activeGroupCall.groupId });
    toast.success("Asked everyone to mute");
  },

  // 1. Fetch User Groups
  getGroups: async () => {
    set({ isGroupsLoading: true });
    const authUser = useAuthStore.getState().authUser;

    // Cache-first: paint instantly from the last sync instead of a skeleton
    // while the network confirms/refreshes — mirrors getUsers in useChatStore.
    if (authUser) {
      const cached = await getCachedConversationsMeta(authUser._id, "group-sidebar");
      if (cached) set({ groups: cached.groups || [], latestGroupMessages: cached.latestGroupMessages || {} });
    }

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
      if (authUser) cacheConversationsMeta(authUser._id, "group-sidebar", { groups, latestGroupMessages: latestMsgs });
    } catch (error) {
      if (isNetworkError(error) && authUser) {
        const cached = await getCachedConversationsMeta(authUser._id, "group-sidebar");
        if (cached) {
          set({ groups: cached.groups || [], latestGroupMessages: cached.latestGroupMessages || {} });
        }
        // No toast here: the DM sidebar's own offline fallback (useChatStore.getUsers)
        // already surfaces one "you're offline" message for the whole home screen.
      } else {
        toast.error(error.response?.data?.message || "Failed to load groups");
      }
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  // 2. Create Group
  createGroup: async (groupData) => {
    try {
      const res = await axiosInstance.post("/groups", groupData);
      set((state) => ({
        groups: upsertGroup(state.groups, res.data),
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

    // Persist the read mark for this group. Group reads were not recorded
    // anywhere before, which is what "seen by" needs to report against.
    if (group) {
      const socket = useAuthStore.getState().socket;
      socket?.emit("markGroupAsRead", { groupId: group._id });
    }

    if (group) {
      set((state) => {
        const mentionedGroups = { ...state.mentionedGroups };
        delete mentionedGroups[group._id];
        return {
          unreadGroupCounts: { ...state.unreadGroupCounts, [group._id]: 0 },
          mentionedGroups,
        };
      });
      get().getGroupMessages(group._id);
    }
  },

  // 4. Get Group Messages
  getGroupMessages: async (groupId) => {
    const authUser = useAuthStore.getState().authUser;
    const conversationKey = groupKey(groupId);

    // Cache-first: paint instantly, then confirm/refresh over the network.
    const cached = authUser ? await getCachedMessages(authUser._id, conversationKey) : [];
    set({ isGroupMessagesLoading: true, groupMessages: cached });

    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      const messages = Array.isArray(res.data) ? res.data : [];
      set({ groupMessages: messages });
      if (authUser) cacheMessages(authUser._id, conversationKey, messages);
    } catch (error) {
      if (isNetworkError(error)) {
        // Offline: keep whatever's cached (possibly empty) instead of a raw
        // "Network Error" toast — the offline banner already covers this.
      } else {
        toast.error(error.response?.data?.message || "Failed to load group messages");
      }
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
    // An anonymous question is shown without its author from the moment it
    // appears, matching exactly what the server will send back. Anything else
    // would flash the sender's name and then swap it out.
    const anonymous = Boolean(messageData.isAnonymous);
    const optimisticMsg = {
      _id: tempId,
      tempId,
      isAnonymous: anonymous,
      anonymousIsMine: anonymous,
      senderId: anonymous
        ? { _id: null, fullName: "Anonymous", profilePic: "" }
        : {
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
      cacheMessages(authUser._id, groupKey(selectedGroup._id), [sentMsg]);
    } catch (error) {
      if (isNetworkError(error)) {
        // Offline: keep the bubble on screen and queue it for retry.
        addToOutbox(authUser._id, {
          tempId,
          conversationKey: groupKey(selectedGroup._id),
          kind: "group",
          targetId: selectedGroup._id,
          payload: messageData,
          createdAt: Date.now(),
        });
      } else {
        set((state) => ({
          groupMessages: state.groupMessages.filter((m) => m._id !== tempId),
        }));
        toast.error(error.response?.data?.message || "Failed to send group message");
      }
    }
  },

  // Retries every group message queued while offline, in composed order.
  // Runs on socket (re)connect — see useAuthStore.connectSocket.
  flushOutbox: async () => {
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    const queued = (await getOutbox(authUser._id)).filter((entry) => entry.kind === "group");
    for (const entry of queued) {
      try {
        const res = await axiosInstance.post(`/groups/${entry.targetId}/send`, entry.payload);
        const sentMsg = res.data;
        set((state) => ({
          groupMessages: state.groupMessages.map((m) =>
            m._id === entry.tempId || m.tempId === entry.tempId ? sentMsg : m
          ),
          latestGroupMessages: {
            ...state.latestGroupMessages,
            [entry.targetId]: sentMsg,
          },
        }));
        cacheMessages(authUser._id, entry.conversationKey, [sentMsg]);
        await removeFromOutbox(authUser._id, entry.tempId);
      } catch (error) {
        if (!isNetworkError(error)) {
          set((state) => ({
            groupMessages: state.groupMessages.filter((m) => m._id !== entry.tempId && m.tempId !== entry.tempId),
          }));
          await removeFromOutbox(authUser._id, entry.tempId);
          toast.error(error.response?.data?.message || "A queued group message failed to send");
        } else break; // still offline — keep order, retry next reconnect
      }
    }
  },

  // 5b. Polls (group chats only)
  createPoll: async ({ question, options, allowMultiple }) => {
    const { selectedGroup } = get();
    if (!selectedGroup) return null;

    try {
      const res = await axiosInstance.post(`/groups/${selectedGroup._id}/polls`, {
        question,
        options,
        allowMultiple,
      });
      set((state) => ({
        groupMessages: state.groupMessages.some((m) => m._id === res.data._id)
          ? state.groupMessages
          : [...state.groupMessages, res.data],
        latestGroupMessages: {
          ...state.latestGroupMessages,
          [selectedGroup._id]: res.data,
        },
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) cacheMessages(authUser._id, groupKey(selectedGroup._id), [res.data]);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create poll");
      return null;
    }
  },

  voteOnPoll: async (messageId, optionIds) => {
    const { selectedGroup } = get();
    if (!selectedGroup) return;

    try {
      const res = await axiosInstance.post(
        `/groups/${selectedGroup._id}/polls/${messageId}/vote`,
        { optionIds }
      );
      set((state) => ({
        groupMessages: state.groupMessages.map((m) => (m._id === messageId ? res.data : m)),
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit vote");
    }
  },

  closePoll: async (messageId) => {
    const { selectedGroup } = get();
    if (!selectedGroup) return;

    try {
      const res = await axiosInstance.post(`/groups/${selectedGroup._id}/polls/${messageId}/close`);
      set((state) => ({
        groupMessages: state.groupMessages.map((m) => (m._id === messageId ? res.data : m)),
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, res.data);
      toast.success("Poll closed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to close poll");
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

  /**
   * Records that the signed-in member has seen this group's welcome/rules.
   *
   * The local copy is patched straight away so the sheet cannot flash back if
   * the group object is refetched before the request lands.
   */
  markWelcomeSeen: async (groupId) => {
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    const seen = (g) =>
      g._id === groupId
        ? { ...g, welcomeSeenBy: [...(g.welcomeSeenBy || []), authUser._id] }
        : g;
    set((state) => ({
      groups: state.groups.map(seen),
      selectedGroup: state.selectedGroup ? seen(state.selectedGroup) : state.selectedGroup,
    }));

    try {
      await axiosInstance.post(`/groups/${groupId}/welcome-seen`);
    } catch (err) {
      // Not worth a toast: the worst case is the sheet appearing once more.
      console.warn("Could not record welcome as seen:", err?.message || err);
    }
  },

  /**
   * Saves a private note about a member.
   *
   * The note lives on the caller's own user document, so the response carries the
   * whole notes map and it is merged into authUser rather than kept in component
   * state — that way the sheet, and anywhere else that wants it later, reads one
   * source instead of refetching.
   */
  setMemberNote: async (groupId, memberId, note) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/members/${memberId}/note`, { note });
      const { memberNotes } = res.data || {};
      useAuthStore.setState((state) =>
        state.authUser ? { authUser: { ...state.authUser, memberNotes } } : state
      );
      toast.success(note?.trim() ? "Note saved" : "Note removed");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save note");
      return false;
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
    socket.off("groupPollUpdated");
    socket.off("groupMessageDeleted");
    socket.off("groupMessageEdited");
    socket.off("groupMessageTranscript");
    socket.off("groupMessageReaction");
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

      // Anonymous questions arrive with no author at all, so the check above
      // cannot recognise the sender's own message and it was appended a second
      // time on top of the copy the send request had already inserted — the
      // author saw duplicates while everyone else saw one. Matching on _id
      // covers that and any other path where both copies arrive.
      if (get().groupMessages.some((m) => m._id === message._id)) return;

      set((state) => ({
        latestGroupMessages: {
          ...state.latestGroupMessages,
          [message.groupId]: message,
        },
      }));

      // Write-through regardless of which group is open, so reopening this
      // group later (even offline) shows it.
      if (currentUser) cacheMessages(currentUser._id, groupKey(message.groupId), [message]);

      if (selectedGroup && selectedGroup._id === message.groupId) {
        set((state) => ({
          groupMessages: [...state.groupMessages, message],
        }));
      } else {
        const mentionsMe = (message.mentions || []).some(
          (id) => String(id?._id || id) === String(currentUser?._id)
        );
        set((state) => ({
          unreadGroupCounts: {
            ...state.unreadGroupCounts,
            [message.groupId]: (state.unreadGroupCounts[message.groupId] || 0) + 1,
          },
          mentionedGroups: mentionsMe
            ? { ...state.mentionedGroups, [message.groupId]: true }
            : state.mentionedGroups,
        }));
      }
    });

    // Live poll vote / close updates
    socket.on("groupPollUpdated", (message) => {
      set((state) => ({
        groupMessages: state.groupMessages.map((m) => (m._id === message._id ? message : m)),
        latestGroupMessages: state.latestGroupMessages[message.groupId]?._id === message._id
          ? { ...state.latestGroupMessages, [message.groupId]: message }
          : state.latestGroupMessages,
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, message._id, message);
    });

    // An edit made by another member. Without this the change only showed up
    // after reopening the group.
    socket.on("groupMessageEdited", (message) => {
      set((state) => ({
        groupMessages: state.groupMessages.map((m) => (m._id === message._id ? message : m)),
        latestGroupMessages:
          state.latestGroupMessages[message.groupId]?._id === message._id
            ? { ...state.latestGroupMessages, [message.groupId]: message }
            : state.latestGroupMessages,
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, message._id, message);
    });

    // Someone reacted to a group message. Without this a reaction only appeared
    // for the person who tapped it, and only until the next fetch.
    socket.on("groupMessageReaction", ({ messageId, reactions }) => {
      set((state) => ({
        groupMessages: state.groupMessages.map((m) =>
          m._id === messageId ? { ...m, reactions: reactions || [] } : m
        ),
      }));
    });

    // Transcript progress for a group voice note, delivered to the group room.
    // The payload carries no author, so it is safe for an anonymous question too.
    socket.on("groupMessageTranscript", ({ messageId, transcript }) => {
      set((state) => ({
        groupMessages: state.groupMessages.map((m) =>
          m._id === messageId
            ? { ...m, transcript: { ...(m.transcript || {}), ...(transcript || {}) } }
            : m
        ),
      }));
    });

    // Deletion of a group message. There was no listener for this at all, so a
    // delete by another member stayed on screen until the group was reopened.
    socket.on("groupMessageDeleted", ({ messageId, isDeletedForEveryone }) => {
      if (!isDeletedForEveryone) return;
      const patch = { isDeletedForEveryone: true, text: "", image: "", images: [], reactions: [] };
      set((state) => ({
        groupMessages: state.groupMessages.map((m) =>
          m._id === messageId ? { ...m, ...patch } : m
        ),
      }));
      const authUser = useAuthStore.getState().authUser;
      if (authUser) updateCachedMessage(authUser._id, messageId, patch);
    });

    // Group Created Notification
    socket.on("groupCreated", (newGroup) => {
      set((state) => ({
        groups: upsertGroup(state.groups, newGroup),
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
    socket.on("groupHandRaised", ({ userId, raised }) => {
      set((state) => {
        const raisedHands = { ...state.raisedHands };
        if (raised) raisedHands[userId] = true;
        else delete raisedHands[userId];
        return { raisedHands };
      });
    });

    // The server can't mute anyone's microphone, so this arrives as a request
    // and each client silences itself.
    socket.on("groupMuteAllRequested", () => {
      const stream = get().groupLocalStream;
      if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = false));
      set({ mutedByHostAt: Date.now() });
      toast("You were muted by the host");
    });

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
          raisedHands: {},
          isHandRaised: false,
        });

        toast(`Group call ended (${Math.max(0, Math.floor(duration/60))}m ${duration%60}s)`);
      }
    });
  },

  unsubscribeFromGroupEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newGroupMessage");
      socket.off("groupPollUpdated");
      socket.off("groupMessageDeleted");
      socket.off("groupMessageEdited");
      socket.off("groupMessageTranscript");
      socket.off("groupMessageReaction");
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
