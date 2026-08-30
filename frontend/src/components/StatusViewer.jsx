import { useState, useEffect, useRef, useCallback } from "react";
import { useStatusStore } from "../store/useStatusStore";
import useAuthStore from "../store/useAuthStore";
import { X, Eye, ChevronLeft, ChevronRight, Trash2, Pause, Play, Send, Heart, Smile, ArrowLeft } from "lucide-react";
import { haptic } from "../lib/haptics";
import toast from "react-hot-toast";

const STATUS_IMAGE_DURATION_MS = 10000;
const QUICK_EMOJIS = ["😍", "😂", "😮", "😢", "🙏", "🔥", "👏", "❤️"];

// In-memory media-URL cache so reopening a status doesn't refetch the URL
// every time — statuses are immutable once posted, so this stays valid.
const statusMediaCache = new Map();

// Warm the browser's HTTP cache for a status's full media blob so that when
// the viewer advances to it there is nothing left to wait on. Statuses are
// immutable; a hidden image/video fetch is cheap and makes swiping between
// stories feel instant instead of stalling per-frame.
const preloadMediaBlob = (url) => {
  if (!url || typeof window === "undefined") return;
  const lower = url.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".ogg")) {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
  } else {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
};

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
  const reactToStatus = useStatusStore((s) => s.reactToStatus);

  const authUser = useAuthStore((s) => s.authUser);
  const socket = useAuthStore((s) => s.socket);

  const currentStatus = viewingStatusGroup?.statuses?.[viewingIndex];
  const isOwn = viewingStatusGroup?.isOwn;
  const isVideo = currentStatus?.media?.type === "video";

  const isLikedByMe = Boolean(
    currentStatus?.viewers?.some(
      (v) =>
        (v.user?._id || v.user)?.toString() === authUser?._id?.toString() &&
        (v.reaction === "❤️" || v.reaction === "😍" || v.reaction === "like")
    )
  );

  const [mediaUrl, setMediaUrl] = useState(() => currentStatus?.media?.url || "");
  const [loading, setLoading] = useState(() => !currentStatus?.media?.url);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isTypingReply, setIsTypingReply] = useState(false);
  const [flyingEmoji, setFlyingEmoji] = useState(null);

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const replyInputRef = useRef(null);
  const popstateClosedRef = useRef(false);

  // Mobile Android back gesture / button router support: push history on open, close viewer on popstate
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ statusViewerOpen: true }, "");
      const handlePopState = () => {
        popstateClosedRef.current = true;
        closeViewer();
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    } else {
      if (!popstateClosedRef.current && window.history.state?.statusViewerOpen) {
        window.history.back();
      }
      popstateClosedRef.current = false;
    }
  }, [isOpen, closeViewer]);

  const handleBack = useCallback(() => {
    haptic("tap");
    closeViewer();
  }, [closeViewer]);

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
    if (currentStatus.media?.url) {
      statusMediaCache.set(currentStatus._id, currentStatus.media.url);
      setMediaUrl(currentStatus.media.url);
      setViewingMediaUrl(currentStatus.media.url);
      setLoading(false);
      setProgress(0);
      return;
    }
    // Serve from the in-memory cache when we've resolved this URL before, so
    // closing and reopening a status never flashes a loader.
    const cachedUrl = statusMediaCache.get(currentStatus._id);
    if (cachedUrl) {
      setMediaUrl(cachedUrl);
      setViewingMediaUrl(cachedUrl);
      setLoading(false);
      setProgress(0);
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      const url = await fetchMediaUrlSafe(currentStatus._id);
      if (url) statusMediaCache.set(currentStatus._id, url);
      setMediaUrl(url);
      setViewingMediaUrl(url);
    } catch {
      setMediaUrl("");
    } finally {
      setLoading(false);
    }
  }, [currentStatus, fetchMediaUrlSafe, setViewingMediaUrl]);

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
    if (isTypingReply) return;
    haptic("tap");
    prevStatus();
  }, [prevStatus, isTypingReply]);

  const handleTapRight = useCallback(() => {
    if (isTypingReply) return;
    haptic("tap");
    nextStatus();
  }, [nextStatus, isTypingReply]);

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

  const handleToggleLike = async () => {
    if (!currentStatus?._id) return;
    haptic("tap");
    const willLike = !isLikedByMe;
    if (willLike) {
      setFlyingEmoji("❤️");
      setTimeout(() => setFlyingEmoji(null), 1200);
    }
    try {
      await reactToStatus(currentStatus._id, {
        reaction: willLike ? "❤️" : "",
        isLikeToggle: true,
      });
      toast.success(willLike ? "Liked status ❤️" : "Unliked status");
    } catch (err) {
      toast.error("Failed to update like");
    }
  };

  const handleSendReaction = async (emoji) => {
    if (!currentStatus?._id) return;
    haptic("success");
    setFlyingEmoji(emoji);
    setTimeout(() => setFlyingEmoji(null), 1200);
    try {
      await reactToStatus(currentStatus._id, { reaction: emoji, isLikeToggle: false });
      toast.success(`Sent ${emoji} to chat`);
    } catch (err) {
      toast.error("Failed to send reaction");
    }
  };

  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !currentStatus?._id) return;
    const textToSend = replyText.trim();
    setReplyText("");
    setIsTypingReply(false);
    setIsPaused(false);
    haptic("success");
    try {
      await reactToStatus(currentStatus._id, { text: textToSend, isLikeToggle: false });
      toast.success("Reply sent to chat");
    } catch (err) {
      toast.error("Failed to send reply");
    }
  };

  const handleInteraction = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
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

  // Prefetch every other status in the current group's media URL in parallel
  // the moment the viewer opens, so forwarding through a group never blocks on
  // a freshly fetched signed URL. Also warm the next status's actual blob so
  // the browser has it cached before we swipe to it.
  useEffect(() => {
    const group = viewingStatusGroup;
    if (!isOpen || !group?.statuses?.length) return;
    const all = group.statuses;
    all.forEach((s) => {
      if (s.media?.url) statusMediaCache.set(s._id, s.media.url);
    });
    const missing = all.filter((s) => !statusMediaCache.has(s._id));
    if (missing.length > 0) {
      Promise.allSettled(
        missing.map((s) => fetchMediaUrlSafe(s._id).then((url) => {
          if (url) {
            statusMediaCache.set(s._id, url);
            preloadMediaBlob(url);
          }
        }))
      );
    }
    const next = all[viewingIndex + 1];
    if (next) {
      const nextUrl = statusMediaCache.get(next._id) || next.media?.url;
      if (nextUrl) preloadMediaBlob(nextUrl);
    }
    const currentUrl = mediaUrl || currentStatus?.media?.url;
    if (currentUrl) preloadMediaBlob(currentUrl);
  }, [isOpen, viewingStatusGroup?._id, viewingIndex, currentStatus?._id, fetchMediaUrlSafe, mediaUrl]);

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
    if (!isOpen || loading || !mediaUrl || isVideo || isPaused || isTypingReply) return;
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
  }, [isOpen, loading, mediaUrl, isVideo, viewingIndex, isPaused, isTypingReply, nextStatus, clearTimers]);

  useEffect(() => {
    if (showControls) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [showControls]);

  useEffect(() => {
    const onKey = (e) => {
      if (!isOpen || isTypingReply) return;
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
  }, [isOpen, isTypingReply, handleTapRight, handleTapLeft, closeViewer, togglePause]);

  if (!isOpen || !viewingStatusGroup || !currentStatus) return null;

  const statusCount = viewingStatusGroup.statuses.length;
  const caption = currentStatus.caption || "";

  return (
    <div
      className="fixed inset-0 z-[130] bg-black flex flex-col animate-in fade-in duration-150 select-none"
      onClick={handleInteraction}
    >
      {/* Progress bars — z-30 so they sit ABOVE the header's dark gradient
          (WhatsApp shows the thin line at the very top, over the black). */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3 pb-2">
        {viewingStatusGroup.statuses.map((s, i) => (
          <div
            key={s._id}
            className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/35"
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
                backgroundColor: "#34b7f1",
                boxShadow: "0 0 6px rgba(52,183,241,0.7)",
                transition: isVideo && i === viewingIndex ? "none" : "width 100ms linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Top Header — always visible while the status plays, like real-world
          story viewers, so the name + upload time never need a tap to appear. */}
      <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-4 pb-3 bg-gradient-to-b from-black/75 via-black/40 to-transparent">
        <div className="flex items-center gap-2.5">
          {/* Top Left Back Button (WhatsApp Style) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBack();
            }}
            title="Back"
            className="p-2 -ml-1 rounded-full text-white/95 hover:bg-white/20 active:scale-95 transition-all"
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>

          <img
            src={viewingStatusGroup.user?.profilePic || "/avatar.png"}
            alt=""
            className="size-9 rounded-full object-cover ring-2 ring-white/25 flex-shrink-0"
          />
          <div className="flex-1 min-w-0 text-left">
            <span className="text-sm font-semibold text-white truncate block">
              {isOwn ? "My status" : (viewingStatusGroup.user?.fullName || "User")}
            </span>
            <span className="text-[10px] text-white/70 block">
              {formatTimeAgo(currentStatus.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isOwn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                title="Delete status"
                className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBack();
              }}
              title="Close"
              className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Media Display Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {loading && !mediaUrl ? (
          <div className="flex flex-col items-center gap-3">
            <span className="loading loading-spinner loading-lg text-white" />
            <span className="text-sm text-white/60">Loading...</span>
          </div>
        ) : mediaUrl ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain pointer-events-auto"
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
              className="absolute left-0 top-0 bottom-24 w-1/3 z-10 cursor-pointer"
            />
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleTapRight();
              }}
              className="absolute right-0 top-0 bottom-24 w-1/3 z-10 cursor-pointer"
            />
          </>
        )}

        {/* Floating flying emoji reaction animation */}
        {flyingEmoji && (
          <div className="absolute bottom-24 inset-x-0 flex justify-center z-30 pointer-events-none animate-bounce text-6xl drop-shadow-2xl">
            {flyingEmoji}
          </div>
        )}

        {/* Pause indicator */}
        {isPaused && isVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="p-4 rounded-full bg-black/40 backdrop-blur-sm">
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
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white hover:bg-black/70 transition-all ${
              showControls ? "opacity-100" : "opacity-0"
            } hidden sm:flex`}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {viewingIndex < statusCount - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTapRight();
            }}
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 text-white hover:bg-black/70 transition-all ${
              showControls ? "opacity-100" : "opacity-0"
            } hidden sm:flex`}
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Caption if present */}
      {caption && (
        <div className="absolute bottom-20 left-0 right-0 z-20 px-6 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          <p className="text-sm font-medium text-white text-center leading-relaxed drop-shadow-md">
            {caption}
          </p>
        </div>
      )}

      {/* ── Bottom Bar: My Status (Left Eye Symbol) vs Other User (Reply + Quick Reactions) ── */}
      {isOwn ? (
        /* My Status: Eye symbol at bottom-left */
        <div className="absolute bottom-4 left-4 z-30 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openViewersSheet(currentStatus._id);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 active:scale-95 transition-all border border-white/20 shadow-xl"
            title="View status viewers"
          >
            <Eye size={16} className="text-white" />
            <span>{currentStatus.viewers?.length || 0}</span>
          </button>
        </div>
      ) : (
        /* Other User: Bottom Reply Input + Quick Emoji Reactions */
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 inset-x-0 z-30 px-3 flex flex-col items-center gap-2"
        >
          {/* Quick Reaction Emojis Strip */}
          <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-xl">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendReaction(emoji)}
                className="text-xl p-1 hover:scale-125 active:scale-95 transition-transform"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Reply Text Bar */}
          <form
            onSubmit={handleSendReply}
            className="w-full max-w-md flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={replyInputRef}
                type="text"
                value={replyText}
                onFocus={() => {
                  setIsTypingReply(true);
                  setIsPaused(true);
                }}
                onBlur={() => {
                  if (!replyText.trim()) {
                    setIsTypingReply(false);
                    setIsPaused(false);
                  }
                }}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply..."
                className="w-full h-10 pl-4 pr-10 rounded-full bg-black/60 backdrop-blur-md text-white placeholder:text-white/60 text-sm border border-white/20 focus:outline-none focus:border-primary shadow-lg"
              />
              {replyText.trim() && (
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-full hover:opacity-90 transition-opacity"
                  title="Send reply"
                >
                  <Send size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleLike}
              className={`size-10 rounded-full bg-black/60 backdrop-blur-md border transition-all shadow-lg flex-shrink-0 flex items-center justify-center ${
                isLikedByMe
                  ? "border-red-500/60 text-red-500 hover:scale-110 active:scale-95 shadow-red-500/25"
                  : "border-white/20 text-white/70 hover:text-red-400 hover:scale-110 active:scale-95"
              }`}
              title={isLikedByMe ? "Liked" : "Like status"}
            >
              <Heart
                size={19}
                fill={isLikedByMe ? "currentColor" : "none"}
                strokeWidth={isLikedByMe ? 2.5 : 2}
                className={`transition-transform duration-200 ${isLikedByMe ? "scale-110 text-red-500" : ""}`}
              />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default StatusViewer;
