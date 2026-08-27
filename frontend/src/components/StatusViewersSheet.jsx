import { useState, useEffect } from "react";
import { useStatusStore } from "../store/useStatusStore";
import axiosInstance from "../lib/axios";
import { X, Eye } from "lucide-react";

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const StatusViewersSheet = () => {
  const { viewersSheetOpen, viewersSheetStatusId, closeViewersSheet } =
    useStatusStore();
  const [viewers, setViewers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!viewersSheetOpen || !viewersSheetStatusId) return;

    const fetchViewers = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(
          `/status/viewers/${viewersSheetStatusId}`
        );
        setViewers(res.data?.viewers || []);
        setCount(res.data?.count || 0);
      } catch (err) {
        console.error("Error fetching viewers:", err.message);
        setViewers([]);
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchViewers();
  }, [viewersSheetOpen, viewersSheetStatusId]);

  if (!viewersSheetOpen) return null;

  return (
    <div
      onClick={closeViewersSheet}
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[1px] animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-base-content">
              Viewed by
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm t-dim">{count}</span>
            <button
              onClick={closeViewersSheet}
              className="p-1 rounded-full hover:bg-base-200 transition-colors"
            >
              <X size={18} className="text-base-content/60" />
            </button>
          </div>
        </div>

        {/* Viewers list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-base-content/40">
              <Eye size={24} />
              <span className="text-sm">No viewers yet</span>
            </div>
          ) : (
            viewers.map((viewer) => (
              <div
                key={viewer._id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-base-200/60 transition-colors"
              >
                <img
                  src={viewer.profilePic || "/avatar.png"}
                  alt={viewer.fullName}
                  className="size-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-base-content block truncate">
                    {viewer.fullName}
                  </span>
                </div>
                <span className="text-[11px] t-dim flex-shrink-0">
                  {formatTimeAgo(viewer.viewedAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusViewersSheet;
