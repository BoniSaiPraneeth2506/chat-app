import { create } from "zustand";

export const useNotificationsStore = create((set) => ({
  messageNotifications: localStorage.getItem("notif-messages") !== "false",
  groupNotifications: localStorage.getItem("notif-groups") !== "false",
  callNotifications: localStorage.getItem("notif-calls") !== "false",
  statusNotifications: localStorage.getItem("notif-status") !== "false",
  showPreview: localStorage.getItem("notif-preview") !== "false",
  notificationSound: localStorage.getItem("notif-sound") !== "false",
  vibration: localStorage.getItem("notif-vibration") !== "false",

  setMessageNotifications: (v) => {
    localStorage.setItem("notif-messages", String(v));
    set({ messageNotifications: v });
  },
  setGroupNotifications: (v) => {
    localStorage.setItem("notif-groups", String(v));
    set({ groupNotifications: v });
  },
  setCallNotifications: (v) => {
    localStorage.setItem("notif-calls", String(v));
    set({ callNotifications: v });
  },
  setStatusNotifications: (v) => {
    localStorage.setItem("notif-status", String(v));
    set({ statusNotifications: v });
  },
  setShowPreview: (v) => {
    localStorage.setItem("notif-preview", String(v));
    set({ showPreview: v });
  },
  setNotificationSound: (v) => {
    localStorage.setItem("notif-sound", String(v));
    set({ notificationSound: v });
  },
  setVibration: (v) => {
    localStorage.setItem("notif-vibration", String(v));
    set({ vibration: v });
  },
}));
