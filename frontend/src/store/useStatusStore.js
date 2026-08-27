import { create } from "zustand";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";

export const useStatusStore = create((set, get) => ({
  statusGroups: [],
  isLoadingStatuses: false,
  viewingStatusGroup: null,
  viewingIndex: 0,
  viewingMediaUrl: "",
  isOpen: false,
  isCreateOpen: false,
  viewersSheetOpen: false,
  viewersSheetStatusId: null,
  viewerCount: 0,

  fetchStatuses: async () => {
    set({ isLoadingStatuses: true });
    try {
      const res = await axiosInstance.get("/status");
      set({ statusGroups: res.data || [] });
    } catch (err) {
      console.error("Error fetching statuses:", err.message);
    } finally {
      set({ isLoadingStatuses: false });
    }
  },

  subscribeToStatusEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("status:new");
    socket.off("status:deleted");
    socket.off("status:viewed");

    socket.on("status:new", (statusData) => {
      const { statusGroups } = get();
      const userId = statusData.user?._id;

      const existing = statusGroups.find(
        (g) => g.user?._id === userId && !g.isOwn
      );

      if (existing) {
        const alreadyExists = existing.statuses.some(
          (s) => s._id === statusData._id
        );
        if (!alreadyExists) {
          set({
            statusGroups: statusGroups.map((g) =>
              g.user?._id === userId
                ? {
                    ...g,
                    statuses: [...g.statuses, statusData],
                    hasUnseen: true,
                    latestStatusAt: statusData.createdAt,
                  }
                : g
            ),
          });
        }
      } else {
        set({
          statusGroups: [
            ...statusGroups.filter((g) => !g.isOwn),
            {
              user: statusData.user,
              statuses: [statusData],
              hasUnseen: true,
              isOwn: false,
              latestStatusAt: statusData.createdAt,
            },
            ...statusGroups.filter((g) => g.isOwn),
          ],
        });
      }
    });

    socket.on("status:deleted", ({ statusId }) => {
      const { statusGroups, viewingStatusGroup, viewingIndex, isOpen } = get();

      const updated = statusGroups
        .map((g) => ({
          ...g,
          statuses: g.statuses.filter((s) => s._id !== statusId),
        }))
        .filter((g) => g.statuses.length > 0 || g.isOwn);

      if (isOpen && viewingStatusGroup) {
        const groupStillExists = updated.some(
          (g) => g.user?._id === viewingStatusGroup.user?._id
        );
        if (!groupStillExists) {
          set({ isOpen: false, viewingStatusGroup: null, viewingIndex: 0 });
        } else {
          const currentGroup = updated.find(
            (g) => g.user?._id === viewingStatusGroup.user?._id
          );
          if (currentGroup && viewingIndex >= currentGroup.statuses.length) {
            set({
              viewingIndex: Math.max(0, currentGroup.statuses.length - 1),
              viewingStatusGroup: currentGroup,
            });
          } else if (currentGroup) {
            set({ viewingStatusGroup: currentGroup });
          }
        }
      }

      set({ statusGroups: updated });
    });

    socket.on("status:viewed", ({ statusId, viewer }) => {
      const { statusGroups } = get();
      set({
        statusGroups: statusGroups.map((g) => ({
          ...g,
          statuses: g.statuses.map((s) =>
            s._id === statusId
              ? {
                  ...s,
                  viewedByMe: true,
                  viewers: s.viewers ? [...s.viewers, { user: viewer, viewedAt: new Date() }] : [{ user: viewer, viewedAt: new Date() }],
                }
              : s
          ),
        })),
      });
    });

    socket.on("status:reacted", ({ statusId, user, reaction }) => {
      const { statusGroups } = get();
      set({
        statusGroups: statusGroups.map((g) => ({
          ...g,
          statuses: g.statuses.map((s) =>
            s._id === statusId
              ? {
                  ...s,
                  viewers: (s.viewers || []).map((v) =>
                    (v.user?._id || v.user)?.toString() === user?._id?.toString()
                      ? { ...v, reaction }
                      : v
                  ),
                }
              : s
          ),
        })),
      });
    });
  },

  unsubscribeFromStatusEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("status:new");
    socket.off("status:deleted");
    socket.off("status:viewed");
    socket.off("status:reacted");
  },

  openStatusGroup: (group, index = 0) => {
    const initialStatus = group?.statuses?.[index];
    const initialUrl = initialStatus?.media?.url || "";
    set({
      viewingStatusGroup: group,
      viewingIndex: index,
      viewingMediaUrl: initialUrl,
      isOpen: true,
    });
  },

  closeViewer: () => {
    set({
      isOpen: false,
      viewingStatusGroup: null,
      viewingIndex: 0,
      viewingMediaUrl: "",
    });
  },

  nextStatus: () => {
    const { viewingStatusGroup, viewingIndex } = get();
    if (!viewingStatusGroup) return;

    if (viewingIndex < viewingStatusGroup.statuses.length - 1) {
      set({ viewingIndex: viewingIndex + 1, viewingMediaUrl: "" });
    } else {
      get().closeViewer();
    }
  },

  prevStatus: () => {
    const { viewingIndex } = get();
    if (viewingIndex > 0) {
      set({ viewingIndex: viewingIndex - 1, viewingMediaUrl: "" });
    }
  },

  setViewingMediaUrl: (url) => set({ viewingMediaUrl: url }),

  markAsViewed: async (statusId) => {
    try {
      await axiosInstance.post(`/status/view/${statusId}`);
      const { statusGroups } = get();
      set({
        statusGroups: statusGroups.map((g) => ({
          ...g,
          statuses: g.statuses.map((s) =>
            s._id === statusId ? { ...s, viewedByMe: true } : s
          ),
        })),
      });
    } catch (err) {
      console.error("Error marking status as viewed:", err.message);
    }
  },

  createStatus: async ({ key, type, fileName, contentType, size, duration, caption }) => {
    const res = await axiosInstance.post("/status", {
      key,
      type,
      fileName,
      contentType,
      size,
      duration,
      caption,
    });
    const newStatus = res.data;
    const { statusGroups } = get();
    const ownGroup = statusGroups.find((g) => g.isOwn);

    if (ownGroup) {
      set({
        statusGroups: statusGroups.map((g) =>
          g.isOwn
            ? {
                ...g,
                statuses: [...g.statuses, newStatus],
                latestStatusAt: newStatus.createdAt,
              }
            : g
        ),
      });
    } else {
      set({
        statusGroups: [
          {
            user: {
              _id: newStatus.user?._id,
              fullName: newStatus.user?.fullName,
              profilePic: newStatus.user?.profilePic,
            },
            statuses: [newStatus],
            hasUnseen: false,
            isOwn: true,
            latestStatusAt: newStatus.createdAt,
          },
          ...statusGroups,
        ],
      });
    }

    return newStatus;
  },

  deleteStatus: async (statusId) => {
    try {
      await axiosInstance.delete(`/status/${statusId}`);
      const { statusGroups } = get();
      const updated = statusGroups
        .map((g) => ({
          ...g,
          statuses: g.statuses.filter((s) => s._id !== statusId),
        }))
        .filter((g) => g.statuses.length > 0 || g.isOwn);
      set({ statusGroups: updated });
    } catch (err) {
      console.error("Error deleting status:", err.message);
      throw err;
    }
  },

  fetchStatusMediaUrl: async (statusId) => {
    const res = await axiosInstance.get(`/status/media/${statusId}`);
    return res.data?.url || "";
  },

  openViewersSheet: async (statusId) => {
    set({ viewersSheetOpen: true, viewersSheetStatusId: statusId });
  },

  closeViewersSheet: () => {
    set({ viewersSheetOpen: false, viewersSheetStatusId: null, viewerCount: 0 });
  },

  reactToStatus: async (statusId, { reaction, text }) => {
    try {
      const res = await axiosInstance.post(`/status/react/${statusId}`, {
        reaction,
        text,
      });

      const currentUserId = useAuthStore.getState().authUser?._id;
      const reactionVal = reaction || text || "❤️";
      const { statusGroups, viewingStatusGroup } = get();

      const updateGroupStatuses = (statuses) =>
        (statuses || []).map((s) => {
          if (s._id !== statusId) return s;
          const viewers = s.viewers || [];
          const idx = viewers.findIndex(
            (v) => (v.user?._id || v.user)?.toString() === currentUserId?.toString()
          );
          let updatedViewers;
          if (idx >= 0) {
            updatedViewers = viewers.map((v, i) =>
              i === idx ? { ...v, reaction: reactionVal } : v
            );
          } else {
            updatedViewers = [
              ...viewers,
              { user: currentUserId, viewedAt: new Date(), reaction: reactionVal },
            ];
          }
          return { ...s, viewers: updatedViewers };
        });

      const updatedGroups = statusGroups.map((g) => ({
        ...g,
        statuses: updateGroupStatuses(g.statuses),
      }));

      const updatedViewingGroup = viewingStatusGroup
        ? {
            ...viewingStatusGroup,
            statuses: updateGroupStatuses(viewingStatusGroup.statuses),
          }
        : null;

      set({
        statusGroups: updatedGroups,
        viewingStatusGroup: updatedViewingGroup,
      });

      return res.data;
    } catch (err) {
      console.error("Error reacting to status:", err.message);
      throw err;
    }
  },

  setCreateOpen: (open) => set({ isCreateOpen: open }),
}));
