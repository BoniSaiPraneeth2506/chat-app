import { create } from "zustand";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";

let statusPruneInterval = null;

// Drop statuses past their 24h window and any group left empty by that.
// Mirrors the server's expiresAt logic so the UI never lingers on an expired
// status between refetches — the backend cleanup job deletes them from the DB,
// and this keeps the client's cached list in step without a rebuild.
const pruneExpired = (groups) => {
  const now = Date.now();
  return (groups || [])
    .map((g) => ({
      ...g,
      statuses: (g.statuses || []).filter(
        (s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now
      ),
    }))
    .filter((g) => g.statuses.length > 0 || g.isOwn);
};

/**
 * Status 2.0 state.
 *
 * Data, not presentation: what each status type means is resolved where it is
 * drawn (the card in StatusRow, the viewer in StatusBody) rather than being
 * flattened into a `kind`/`label` pair here. A status carries its own fields,
 * and a store that pre-digests them is a store that has to be told about every
 * new type twice.
 */
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

  // Which editor the create sheet has opened, or null for the tool grid.
  createMode: null,

  // Default audience for new statuses, and the archive switch. Read once at
  // startup and used to pre-fill the privacy picker.
  defaultPrivacy: "contacts",
  keepArchived: false,

  // The scheduled/archived screens: statuses waiting to go out, and statuses
  // kept after their 24h window. Neither is ever in `statusGroups` — a scheduled
  // status must not be visible early and an archived one must not look live —
  // so they live here, fetched when one of the screens opens.
  scheduledStatuses: [],
  archivedStatuses: [],
  isLoadingManaged: false,

  fetchManagedStatuses: async () => {
    set({ isLoadingManaged: true });
    try {
      // Both are plain arrays of the owner's own statuses. Fetched together so
      // the sheet opens with its tabs already correct rather than flashing an
      // empty list and then filling in.
      const [scheduled, archived] = await Promise.allSettled([
        axiosInstance.get("/status/scheduled"),
        axiosInstance.get("/status/archive"),
      ]);
      set({
        scheduledStatuses: scheduled.status === "fulfilled" ? scheduled.value.data || [] : [],
        archivedStatuses: archived.status === "fulfilled" ? archived.value.data || [] : [],
      });
    } finally {
      set({ isLoadingManaged: false });
    }
  },

  /**
   * Puts an archived status back, and refreshes the live list.
   *
   * The server also moves the status to the front of the owner's own group, so
   * without the refetch the card would keep previewing whatever was posted most
   * recently until something else happened to trigger a reload.
   */
  restoreArchivedStatus: async (statusId) => {
    await axiosInstance.post(`/status/${statusId}/restore`);
    await get().fetchManagedStatuses();
    await get().fetchStatuses();
  },

  fetchStatuses: async () => {
    set({ isLoadingStatuses: true });
    try {
      const res = await axiosInstance.get("/status");
      set({ statusGroups: pruneExpired(res.data || []) });
    } catch (err) {
      console.error("Error fetching statuses:", err.message);
    } finally {
      set({ isLoadingStatuses: false });
    }
  },

  fetchStatusSettings: async () => {
    try {
      const res = await axiosInstance.get("/status/privacy");
      set({
        defaultPrivacy: res.data?.defaultPrivacy || "contacts",
        keepArchived: Boolean(res.data?.keepArchived),
      });
    } catch (err) {
      console.error("Error fetching status settings:", err.message);
    }
  },

  updateStatusSettings: async (patch) => {
    const previous = {
      defaultPrivacy: get().defaultPrivacy,
      keepArchived: get().keepArchived,
    };
    // Optimistic: the switch should move under the thumb, not after a round trip.
    set({ ...previous, ...patch });
    try {
      const res = await axiosInstance.put("/status/privacy", patch);
      set({
        defaultPrivacy: res.data?.defaultPrivacy || previous.defaultPrivacy,
        keepArchived: Boolean(res.data?.keepArchived),
      });
      return true;
    } catch (err) {
      console.error("Error updating status settings:", err.message);
      set(previous);
      return false;
    }
  },

  subscribeToStatusEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("status:new");
    socket.off("status:deleted");
    socket.off("status:viewed");
    socket.off("status:reacted");
    socket.off("status:liked");
    socket.off("status:replied");
    socket.off("status:pollVoted");
    socket.off("status:answered");

    // Periodically drop statuses that cross their 24h expiry locally, so the
    // cached Updates tab matches the server's cleanup without a full refetch.
    clearInterval(statusPruneInterval);
    statusPruneInterval = setInterval(() => {
      get().pruneExpiredStatuses();
    }, 60_000);

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
      const myId = useAuthStore.getState().authUser?._id?.toString();

      // Only mine to reflect. Another person's view is the owner's business, and
      // mirroring it here would show a viewer their own status marked seen by
      // someone it was not.
      if (viewer?._id?.toString() !== myId) return;

      set({
        statusGroups: statusGroups.map((g) => ({
          ...g,
          statuses: g.statuses.map((s) =>
            s._id === statusId
              ? {
                  ...s,
                  viewedByMe: true,
                  viewers: s.viewers
                    ? [
                        ...s.viewers.filter(
                          (v) => (v.user?._id || v.user)?.toString() !== myId
                        ),
                        { user: viewer, viewedAt: new Date() },
                      ]
                    : [{ user: viewer, viewedAt: new Date() }],
                }
              : s
          ),
        })),
      });
    });

    const applyToStatus = (statusId, updater) => {
      const { statusGroups, viewingStatusGroup } = get();
      const map = (s) => (s._id === statusId ? updater(s) : s);
      const groups = statusGroups.map((g) => ({ ...g, statuses: map(g.statuses) }));
      const viewing = viewingStatusGroup
        ? { ...viewingStatusGroup, statuses: map(viewingStatusGroup.statuses) }
        : null;
      set({ statusGroups: groups, viewingStatusGroup: viewing });
    };

    socket.on("status:reacted", ({ statusId, user, reaction }) => {
      applyToStatus(statusId, (s) => {
        const viewers = s.viewers || [];
        const id = (user?._id || user)?.toString();
        const idx = viewers.findIndex(
          (v) => (v.user?._id || v.user)?.toString() === id
        );
        if (idx < 0) return s;
        const next = viewers.slice();
        next[idx] = { ...next[idx], reaction };
        return { ...s, viewers: next };
      });
    });

    socket.on("status:liked", ({ statusId, user, liked }) => {
      const myId = useAuthStore.getState().authUser?._id?.toString();
      const id = (user?._id || user)?.toString();
      applyToStatus(statusId, (s) => {
        const likes = (s.likes || []).map((l) => String(l));
        const has = likes.includes(id);
        const next = liked
          ? has || id === myId
            ? likes
            : [...likes, id]
          : likes.filter((l) => l !== id);
        return { ...s, likes: next };
      });
    });

    socket.on("status:replied", ({ statusId, user, text, createdAt }) => {
      const myId = useAuthStore.getState().authUser?._id?.toString();
      if ((user?._id || user)?.toString() === myId) return;
      applyToStatus(statusId, (s) => ({
        ...s,
        replies: [...(s.replies || []), { user, text, createdAt }],
      }));
    });

    socket.on("status:pollVoted", ({ statusId, optionIndex, user }) => {
      applyToStatus(statusId, (s) => {
        if (!s.poll) return s;
        const id = (user?._id || user)?.toString();
        const options = s.poll.options.map((o) => ({
          ...o,
          votes: (o.votes || []).filter((v) => String(v?._id || v) !== id),
        }));
        if (options[optionIndex]) {
          options[optionIndex].votes = [
            ...(options[optionIndex].votes || []),
            user?._id || user,
          ];
        }
        return { ...s, poll: { ...s.poll, options } };
      });
    });

    socket.on("status:answered", ({ statusId, user, text, createdAt }) => {
      const myId = useAuthStore.getState().authUser?._id?.toString();
      if ((user?._id || user)?.toString() === myId) return;
      applyToStatus(statusId, (s) =>
        s.question
          ? {
              ...s,
              question: {
                ...s.question,
                answers: [...(s.question.answers || []), { user, text, createdAt }],
              },
            }
          : s
      );
    });
  },

  unsubscribeFromStatusEvents: () => {
    clearInterval(statusPruneInterval);
    statusPruneInterval = null;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("status:new");
    socket.off("status:deleted");
    socket.off("status:viewed");
    socket.off("status:reacted");
    socket.off("status:liked");
    socket.off("status:replied");
    socket.off("status:pollVoted");
    socket.off("status:answered");
  },

  openStatusGroup: (group, index = 0) => {
    const initialStatus = group?.statuses?.[index];
    set({
      viewingStatusGroup: group,
      viewingIndex: index,
      viewingMediaUrl: initialStatus?.media?.url || "",
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

  pruneExpiredStatuses: () => {
    set({ statusGroups: pruneExpired(get().statusGroups) });
  },

  markAsViewed: async (statusId) => {
    try {
      await axiosInstance.post(`/status/view/${statusId}`);
    } catch (err) {
      console.error("Error marking status as viewed:", err.message);
    }
  },

  /**
   * Posts a status of any type.
   *
   * The payload is passed through as given — the editors each assemble their own
   * shape, and the server validates per type. The one thing done here is the
   * local optimistic insert, so a posted status appears without waiting for the
   * next list fetch.
   */
  createStatus: async (payload) => {
    const res = await axiosInstance.post("/status", payload);
    const newStatus = res.data;
    const { statusGroups } = get();
    const ownGroup = statusGroups.find((g) => g.isOwn);

    // A scheduled status is not live yet, so it belongs in the scheduled list
    // rather than the Updates strip.
    if (newStatus.statusState === "scheduled") return newStatus;

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

  updateStatus: async (statusId, patch) => {
    const res = await axiosInstance.put(`/status/${statusId}`, patch);
    return res.data;
  },

  /**
   * A short-lived read grant for one status's media.
   *
   * Returns the whole re-signed status rather than a single `url`, because a
   * layout needs several keys and a voice status has its clip plus a background
   * — asking per slot would be several round trips to learn the same thing.
   */
  fetchStatusMediaUrl: async (statusId) => {
    const res = await axiosInstance.get(`/status/media/${statusId}`);
    return res.data?.status || null;
  },

  openViewersSheet: async (statusId) => {
    set({ viewersSheetOpen: true, viewersSheetStatusId: statusId });
  },

  closeViewersSheet: () => {
    set({ viewersSheetOpen: false, viewersSheetStatusId: null, viewerCount: 0 });
  },

  // ── likes ───────────────────────────────────────────────────────────────────
  // A like is its own toggle, separate from reactions, so the owner's analytics
  // can count "liked" and "reacted with 🔥" as the different things they are.
  toggleLike: async (statusId) => {
    const myId = useAuthStore.getState().authUser?._id?.toString();
    const res = await axiosInstance.post(`/status/like/${statusId}`);

    const apply = (s) => {
      if (s._id !== statusId) return s;
      const likes = (s.likes || []).map((l) => String(l));
      const has = likes.includes(myId);
      const next = res.data?.liked
        ? has
          ? likes
          : [...likes, myId]
        : likes.filter((l) => l !== myId);
      return { ...s, likes: next };
    };

    const { statusGroups, viewingStatusGroup } = get();
    set({
      statusGroups: statusGroups.map((g) => ({
        ...g,
        statuses: (g.statuses || []).map(apply),
      })),
      viewingStatusGroup: viewingStatusGroup
        ? {
            ...viewingStatusGroup,
            statuses: (viewingStatusGroup.statuses || []).map(apply),
          }
        : null,
    });

    return res.data;
  },

  // ── reactions ───────────────────────────────────────────────────────────────
  // One value per person: a second pick replaces the first, an empty one removes
  // it. Sends nothing to chat — that is what replyToStatus is for.
  reactToStatus: async (statusId, { reaction, text } = {}) => {
    const myId = useAuthStore.getState().authUser?._id?.toString();

    if (text) return get().replyToStatus(statusId, text);

    const res = await axiosInstance.post(`/status/react/${statusId}`, { reaction });

    const apply = (s) => {
      if (s._id !== statusId) return s;
      const viewers = s.viewers || [];
      const idx = viewers.findIndex(
        (v) => (v.user?._id || v.user)?.toString() === myId
      );
      const next = viewers.slice();
      if (idx >= 0) {
        next[idx] = { ...next[idx], reaction: res.data?.reaction || "" };
      } else {
        next.push({
          user: myId,
          viewedAt: new Date(),
          reaction: res.data?.reaction || "",
        });
      }
      return { ...s, viewers: next };
    };

    const { statusGroups, viewingStatusGroup } = get();
    set({
      statusGroups: statusGroups.map((g) => ({
        ...g,
        statuses: (g.statuses || []).map(apply),
      })),
      viewingStatusGroup: viewingStatusGroup
        ? { ...viewingStatusGroup, statuses: (viewingStatusGroup.statuses || []).map(apply) }
        : null,
    });

    return res.data;
  },

  /** A text reply — becomes a normal chat message carrying a statusRef. */
  replyToStatus: async (statusId, text) => {
    const myId = useAuthStore.getState().authUser?._id?.toString();
    const res = await axiosInstance.post(`/status/reply/${statusId}`, { text });

    const { statusGroups, viewingStatusGroup } = get();
    const apply = (s) =>
      s._id === statusId
        ? {
            ...s,
            replies: [
              ...(s.replies || []),
              { user: myId, text, createdAt: new Date() },
            ],
          }
        : s;
    set({
      statusGroups: statusGroups.map((g) => ({
        ...g,
        statuses: (g.statuses || []).map(apply),
      })),
      viewingStatusGroup: viewingStatusGroup
        ? { ...viewingStatusGroup, statuses: (viewingStatusGroup.statuses || []).map(apply) }
        : null,
    });

    return res.data;
  },

  // ── poll / question ─────────────────────────────────────────────────────────
  votePoll: async (statusId, optionIndex) => {
    const res = await axiosInstance.post(`/status/poll/${statusId}/vote`, { optionIndex });

    // The server returns the authoritative tally — a single vote per person is
    // enforced there, so merging only the option that changed locally would let
    // two devices disagree about who voted where.
    const apply = (s) => {
      if (s._id !== statusId || !res.data?.poll) return s;
      return { ...s, poll: { ...s.poll, ...res.data.poll } };
    };

    const { statusGroups, viewingStatusGroup } = get();
    set({
      statusGroups: statusGroups.map((g) => ({
        ...g,
        statuses: (g.statuses || []).map(apply),
      })),
      viewingStatusGroup: viewingStatusGroup
        ? {
            ...viewingStatusGroup,
            statuses: (viewingStatusGroup.statuses || []).map(apply),
          }
        : null,
    });

    return res.data;
  },

  answerQuestion: async (statusId, text) => {
    const myId = useAuthStore.getState().authUser?._id?.toString();
    await axiosInstance.post(`/status/question/${statusId}/answer`, { text });

    const apply = (s) =>
      s._id === statusId && s.question
        ? {
            ...s,
            question: {
              ...s.question,
              answers: [
                ...(s.question.answers || []).filter(
                  (a) => (a.user?._id || a.user)?.toString() !== myId
                ),
                { user: myId, text, createdAt: new Date() },
              ],
            },
          }
        : s;

    const { statusGroups, viewingStatusGroup } = get();
    set({
      statusGroups: statusGroups.map((g) => ({
        ...g,
        statuses: (g.statuses || []).map(apply),
      })),
      viewingStatusGroup: viewingStatusGroup
        ? { ...viewingStatusGroup, statuses: (viewingStatusGroup.statuses || []).map(apply) }
        : null,
    });
  },

  /** Owner-only. Answers are never part of a viewer's copy of a question. */
  fetchStatusAnswers: async (statusId) => {
    const res = await axiosInstance.get(`/status/answers/${statusId}`);
    return res.data;
  },

  fetchAnalytics: async (statusId) => {
    const res = await axiosInstance.get(`/status/analytics/${statusId}`);
    return res.data;
  },

  fetchScheduled: async () => {
    const res = await axiosInstance.get("/status/scheduled");
    return res.data || [];
  },

  fetchArchive: async () => {
    const res = await axiosInstance.get("/status/archive");
    return res.data || [];
  },

  restoreStatus: async (statusId) => {
    const restored = await axiosInstance.post(`/status/${statusId}/restore`);
    // Back in the Updates strip as a brand new status.
    await get().fetchStatuses();
    return restored.data;
  },

  setCreateOpen: (open) =>
    set(open ? { isCreateOpen: true, createMode: null } : { isCreateOpen: false, createMode: null }),

  setCreateMode: (mode) => set({ createMode: mode }),
}));
