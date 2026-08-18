import { create } from "zustand";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import useAuthStore from "./useAuthStore";

// Chat lock.
//
// Two things kept apart on purpose:
//
//   * whether the lock EXISTS and which chats are in it — account state, on the
//     server, reflected into authUser
//   * whether it is currently OPEN — session state, held here and nowhere else
//
// The open state is deliberately not persisted. Surviving a reload would mean a
// lock that stays open after the app is closed, which is the opposite of what it
// is for. Locked conversations are also withheld from the sidebar payload, so
// this store never has to hide anything the client was already given.

export const useChatLockStore = create((set, get) => ({
  isModalOpen: false,
  // "locked" -> asking for the password, "open" -> showing the list,
  // "recover" -> answering the security question.
  view: "locked",
  isUnlocked: false,
  isBusy: false,
  error: "",
  lockedUsers: [],
  lockedGroups: [],

  // True while a locked chat is open, so backing out of it returns to the locked
  // list instead of the normal home.
  returnToLocked: false,

  /**
   * Entering the locked screen always asks for the password again.
   *
   * The session used to stay unlocked in memory, so leaving and double-tapping
   * again walked straight in — which makes the lock decorative for anyone who
   * picks the phone up next. Navigating back out of a locked chat is the one path
   * that does not re-ask, because that is movement inside the flow rather than a
   * fresh entry, and it goes through resumeLockedList instead.
   */
  openModal: () => {
    get().relock();
    set({ isModalOpen: true, view: "locked", error: "" });
  },

  closeModal: () => set({ isModalOpen: false, error: "" }),

  /** Opening a locked chat: keep the session so Back can come back here. */
  enterLockedChat: () => set({ isModalOpen: false, returnToLocked: true, error: "" }),

  /** Back out of that chat — straight to the list, no password. */
  resumeLockedList: () => {
    if (!get().isUnlocked) {
      set({ returnToLocked: false });
      return false;
    }
    set({ isModalOpen: true, view: "open", returnToLocked: false, error: "" });
    return true;
  },

  setView: (view) => set({ view, error: "" }),

  /** Forgets the unlocked session — on sign-out, or when the user locks up again. */
  relock: () =>
    set({
      isUnlocked: false,
      view: "locked",
      lockedUsers: [],
      lockedGroups: [],
      returnToLocked: false,
      error: "",
    }),

  /**
   * Verifies the password and pulls the locked conversations.
   *
   * The list only exists in this response, so a wrong password leaves the client
   * with nothing to show rather than with data it is choosing to hide.
   */
  unlock: async (password) => {
    set({ isBusy: true, error: "" });
    try {
      const res = await axiosInstance.post("/auth/chat-lock/unlock", { password });
      set({
        isUnlocked: true,
        view: "open",
        lockedUsers: res.data?.users || [],
        lockedGroups: res.data?.groups || [],
        isBusy: false,
      });
      return true;
    } catch (error) {
      set({ isBusy: false, error: error.response?.data?.message || "Could not unlock" });
      return false;
    }
  },

  setup: async ({ password, securityQuestion, securityAnswer }) => {
    set({ isBusy: true, error: "" });
    try {
      const res = await axiosInstance.post("/auth/chat-lock/setup", {
        password,
        securityQuestion,
        securityAnswer,
      });
      mergeLockState(res.data);
      set({ isBusy: false });
      toast.success("Chat lock is on");
      return true;
    } catch (error) {
      const message = error.response?.data?.message || "Could not set up chat lock";
      set({ isBusy: false, error: message });
      toast.error(message);
      return false;
    }
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    set({ isBusy: true, error: "" });
    try {
      await axiosInstance.post("/auth/chat-lock/password", { currentPassword, newPassword });
      set({ isBusy: false });
      toast.success("Lock password changed");
      return true;
    } catch (error) {
      const message = error.response?.data?.message || "Could not change the password";
      set({ isBusy: false, error: message });
      return false;
    }
  },

  recover: async ({ securityAnswer, newPassword }) => {
    set({ isBusy: true, error: "" });
    try {
      await axiosInstance.post("/auth/chat-lock/recover", { securityAnswer, newPassword });
      set({ isBusy: false, view: "locked" });
      toast.success("Lock password reset — sign in with it now");
      return true;
    } catch (error) {
      set({ isBusy: false, error: error.response?.data?.message || "Could not reset the password" });
      return false;
    }
  },

  disable: async (password) => {
    set({ isBusy: true, error: "" });
    try {
      const res = await axiosInstance.post("/auth/chat-lock/disable", { password });
      mergeLockState(res.data);
      get().relock();
      set({ isBusy: false, isModalOpen: false });
      // Every conversation is released server-side, so the sidebar has to refetch
      // or the newly freed chats stay missing until a reload.
      await refreshLists();
      toast.success("Chat lock turned off");
      return true;
    } catch (error) {
      const message = error.response?.data?.message || "Could not turn off chat lock";
      set({ isBusy: false, error: message });
      return false;
    }
  },

  /**
   * Releases one conversation from inside the unlocked screen.
   *
   * Kept separate from toggleChat because the session stays open here: the user
   * has already proved themselves to get this far, so asking again would be
   * pointless, and dropping them back to the password prompt after every unlock
   * would make releasing several chats needlessly painful.
   *
   * The row is removed locally rather than by refetching. The toggle response
   * carries ids, not sidebar entries, and we already know which one left.
   */
  releaseChat: async (id, type = "user") => {
    try {
      const res = await axiosInstance.post(`/auth/chat-lock/toggle/${id}`, { type });
      mergeLockState(res.data);
      set((state) => ({
        lockedUsers: state.lockedUsers.filter((u) => u._id !== id),
        lockedGroups: state.lockedGroups.filter((g) => g._id !== id),
      }));
      await refreshLists();
      toast.success("Moved back to your chats");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not unlock that chat");
      return false;
    }
  },

  /** Locks or unlocks one conversation, then refreshes the lists it moved between. */
  toggleChat: async (id, type = "user") => {
    try {
      const res = await axiosInstance.post(`/auth/chat-lock/toggle/${id}`, { type });
      mergeLockState(res.data);
      await refreshLists();

      // The open list is stale now; refresh it while the session is still valid.
      if (get().isUnlocked) set({ lockedUsers: [], lockedGroups: [], isUnlocked: false, view: "locked" });

      toast.success(res.data?.locked ? "Chat locked" : "Chat unlocked");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the lock");
      return false;
    }
  },
}));

/** Mirrors the server's lock state into authUser, which the UI reads from. */
const mergeLockState = (data) => {
  if (!data) return;
  useAuthStore.setState((state) =>
    state.authUser
      ? {
          authUser: {
            ...state.authUser,
            chatLock: {
              enabled: Boolean(data.enabled),
              securityQuestion: data.securityQuestion || "",
            },
            lockedChats: data.lockedChats || [],
            lockedGroups: data.lockedGroups || [],
          },
        }
      : state
  );
};

/**
 * Refetches the sidebar after the locked set changes.
 *
 * Imported at call time rather than at module scope: the chat and group stores
 * already import each other, and adding a third participant to that cycle at
 * load time is how it stops being harmless.
 */
const refreshLists = async () => {
  const [{ useChatStore }, { useGroupStore }] = await Promise.all([
    import("./useChatStore"),
    import("./useGroupStore"),
  ]);
  await Promise.all([useChatStore.getState().getUsers(), useGroupStore.getState().getGroups()]);
};
