import { useState, useEffect, useRef, useCallback } from "react";
import { useStatusStore } from "../store/useStatusStore";
import useAuthStore from "../store/useAuthStore";
import { X, Eye, ChevronLeft, ChevronRight, Trash2, Pause, Play } from "lucide-react";
import { haptic } from "../lib/haptics";
import toast from "react-hot-toast";

const STATUS_IMAGE_DURATION_MS = 5000;

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

const StatusViewer = () => {
  const isOpen = useStatusStore((s) => s.isOpen);
  const viewingStatusGroup = useStatusStore((s) => s.viewingStatusGroup);
  const viewingIndex = useStatusStore((s) => s.viewingIndex);
  const nextStatus = useStatusStore((s) => s.nextStatus);
  const prevStatus = useStatusStore((s) => s.prevStatus);
  const closeViewer = useStatusStore((s) => s.closeViewer);
  const markAsViewed = useStatusStore((s) => s.markAsViewed);
  const fetchStatusMediaUrl = useStatusStore((s) => s.fetchStatusMediaUrl);
  const setViewingMediaUrl = useStatusStore((s) => s.setViewingMediaUrl);
  const openViewersSheet = useStatusStore((s) => s.openViewersSheet);
  const deleteStatus = useStatusStore((s) => s.deleteStatus);

  const authUser = useAuthStore((s) => s.authUser);
  const socket = useAuthStore((s) => s.socket);

  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const controlsTimerRef = useRef(null);

  const currentStatus = viewingStatusGroup?.statuses?.[viewingIndex];
  const isOwn = viewingStatusGroup?.isOwn;
  const isVideo = currentStatus?.media?.type === "video";

  const fetchMediaUrlSafe = useCallback(
    async (statusId) => {
      try {
        return await fetchStatusMediaUrl(statusId);
      } catch {
        return "";
      }
    },
    [fetchStatusMediaUrl]
  );

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const loadMedia = useCallback(async () => {
    if (!currentStatus?._id) return;
    setLoading(true);
    setProgress(0);
    setIsPaused(false);
    try {
      const url = await fetchMediaUrlSafe(currentStatus._id);
      setMediaUrl(url);
      setViewingMediaUrl(url);
    } catch {
      setMediaUrl("");
    } finally {
      setLoading(false);
    }
  }, [currentStatus?._id, fetchMediaUrlSafe, setViewingMediaUrl]);

  const handleVideoProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  }, []);

  const handleVideoEnded = useCallback(() => {
    nextStatus();
  }, [nextStatus]);

  const togglePause = useCallback(() => {
    if (isVideo && videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
    setIsPaused((p) => !p);
    haptic("tap");
  }, [isPaused, isVideo]);

  const handleTapLeft = useCallback(() => {
    haptic("tap");
    prevStatus();
  }, [prevStatus]);

  const handleTapRight = useCallback(() => {
    haptic("tap");
    nextStatus();
  }, [nextStatus]);

  const handleDelete = useCallback(async () => {
    if (!currentStatus?._id) return;
    if (!window.confirm("Delete this status?")) return;
    haptic("longPress");
    try {
      await deleteStatus(currentStatus._id);
      toast.success("Status deleted");
      const { viewingStatusGroup: group } = useStatusStore.getState();
      if (!group || group.statuses.length === 0) {
        closeViewer();
      }
    } catch {
      toast.error("Failed to delete status");
    }
  }, [currentStatus?._id, deleteStatus, closeViewer]);

  const handleInteraction = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!isOpen || !currentStatus?._id) return;
    loadMedia();
    if (!isOwn) {
      markAsViewed(currentStatus._id);
    }
    if (socket) {
      socket.emit("status:viewing", { statusId: currentStatus._id });
    }
    return () => {
      if (socket && currentStatus?._id) {
        socket.emit("status:stopViewing", { statusId: currentStatus._id });
      }
      clearTimers();
      setProgress(0);
    };
  }, [isOpen, currentStatus?._id, viewingIndex]);

  useEffect(() => {
    if (!socket) return;
    const handleDeleted = ({ statusId }) => {
      const state = useStatusStore.getState();
      if (!state.isOpen || !state.viewingStatusGroup) return;
      const current = state.viewingStatusGroup.statuses[state.viewingIndex];
      if (current?._id === statusId) {
        const updated = state.viewingStatusGroup.statuses.filter(
          (s) => s._id !== statusId
        );
        if (updated.length === 0) {
          closeViewer();
        } else {
          const newIndex = Math.min(state.viewingIndex, updated.length - 1);
          useStatusStore.setState({
            viewingStatusGroup: {
              ...state.viewingStatusGroup,
              statuses: updated,
            },
            viewingIndex: newIndex,
          });
        }
      }
    };
    socket.on("status:deleted", handleDeleted);
    return () => socket.off("status:deleted", handleDeleted);
  }, [socket, closeViewer]);

  useEffect(() => {
    if (!isOpen || loading || !mediaUrl || isVideo) return;
    clearTimers();
    startTimeRef.current = Date.now();
    const total = STATUS_IMAGE_DURATION_MS;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min(100, (elapsed / total) * 100));
      if (elapsed >= total) {
        nextStatus();
        return;
      }
      timerRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = requestAnimationFrame(tick);
    return () => clearTimers();
  }, [isOpen, loading, mediaUrl, isVideo, viewingIndex, nextStatus, clearTimers]);

  useEffect(() => {
    if (showControls) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [showControls]);

  useEffect(() => {
    const onKey = (e) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight") handleTapRight();
      if (e.key === "ArrowLeft") handleTapLeft();
      if (e.key === "Escape") closeViewer();
      if (e.key === " ") {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleTapRight, handleTapLeft, closeViewer, togglePause]);

  if (!isOpen || !viewingStatusGroup || !currentStatus) return null;

  const statusCount = viewingStatusGroup.statuses.length;
  const caption = currentStatus.caption || "";

  return (
    <div
      className="fixed inset-0 z-[130] bg-black flex flex-col animate-in fade-in duration-150"
      onClick={handleInteraction}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3 pb-2">
        {viewingStatusGroup.statuses.map((s, i) => (
          <div
            key={s._id}
            className="flex-1 h-[2.5px] rounded-full overflow-hidden bg-white/30"
          >
            <div
              className="h-full rounded-full"
              style={{
                width:
                  i < viewingIndex
                    ? "100%"
                    : i === viewingIndex
                    ? `${progress}%`
                    : "0%",
                backgroundColor: "white",
                transition: isVideo && i === viewingIndex ? "none" : "width 100ms linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 px-4 pt-5 pb-3 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-3">
          <img
            src={viewingStatusGroup.user?.profilePic || "/avatar.png"}
            alt=""
            className="size-9 rounded-full object-cover ring-2 ring-white/20"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-white truncate block">
              {viewingStatusGroup.user?.fullName || "User"}
            </span>
            <span className="text-[10px] text-white/60">
              {formatTimeAgo(currentStatus.createdAt)}
            </span>
          </div>
          {isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openViewersSheet(currentStatus._id);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
            >
              <Eye size={14} />
              <span className="text-xs">
                {currentStatus.viewers?.length || 0}
              </span>
            </button>
          )}
          {isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeViewer();
            }}
            className="p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <span className="loading loading-spinner loading-lg text-white" />
            <span className="text-sm text-white/60">Loading...</span>
          </div>
        ) : mediaUrl ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              onTimeUpdate={handleVideoProgress}
              onEnded={handleVideoEnded}
              onClick={(e) => {
                e.stopPropagation();
                togglePause();
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Status"
              className="w-full h-full object-contain"
            />
          )
        ) : (
          <div className="text-white/60 text-sm">Failed to load media</div>
        )}

        {/* Tap zones for navigation */}
        {!loading && (
          <>
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleTapLeft();
              }}
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
            />
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleTapRight();
              }}
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
            />
          </>
        )}

        {/* Pause indicator */}
        {isPaused && isVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="p-4 rounded-full bg-black/30">
              <Play size={32} className="text-white" fill="white" />
            </div>
          </div>
        )}

        {/* Prev/Next arrows on desktop */}
        {viewingIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTapLeft();
            }}
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all ${
              showControls ? "opacity-100" : "opacity-0"
            } hidden sm:flex`}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {viewingIndex < statusCount - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTapRight();
            }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all ${
              showControls ? "opacity-100" : "opacity-0"
            } hidden sm:flex`}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Caption */}
      {caption && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-8 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-sm text-white text-center leading-relaxed">
            {caption}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatusViewer;
