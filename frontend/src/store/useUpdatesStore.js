import { create } from "zustand";
import axiosInstance from "../lib/axios";

export const useUpdatesStore = create((set) => ({
  activeTab: "chats",
  callHistory: [],
  isCallHistoryLoading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchCallHistory: async () => {
    set({ isCallHistoryLoading: true });
    try {
      const res = await axiosInstance.get("/messages/call-history");
      set({ callHistory: res.data || [] });
    } catch (err) {
      console.error("Error fetching call history:", err.message);
    } finally {
      set({ isCallHistoryLoading: false });
    }
  },
}));
