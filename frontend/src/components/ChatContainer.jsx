import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useEffect, useMemo, useRef, useLayoutEffect, useState } from "react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { X, Globe, FileText, Calendar, ShieldCheck, Clock, CornerUpLeft, Trash2, Pencil, Phone, Video, Pin, Forward, Image, Link2, EyeOff, ChevronRight } from "lucide-react";
import ForwardModal from "./ForwardModal";
import MediaGallerySheet from "./MediaGallerySheet";
import MessageAttachment from "./MessageAttachment";
import SocialLinksRow from "./SocialLinksRow";
import { useNicknames, displayNameOf } from "../lib/contacts";
import PollMessage from "./PollMessage";
import VoiceNote from "./VoiceNote";
import VoiceTranscript from "./VoiceTranscript";
import MessageAiPanel from "./ai/MessageAiPanel";
import { useThemeStore } from "../store/useThemeStore";
import { getWallpaperStyle } from "../pages/SettingsPage";


import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import useAuthStore from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { haptic } from "../lib/haptics";
import { stopAllAudio } from "../lib/aiAudio";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const getYoutubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const isDirectVideo = (url) => {
  return /\.(mp4|webm|ogg)($|\?)/i.test(url);
};

const LinkPreviewCard = ({ url }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHasError(false);

    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          if (data.status === "success" && data.data) {
            setPreview(data.data);
          } else {
            setHasError(true);
          }
        }
      })
      .catch((err) => {
        console.log("Link preview error:", err);
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 mt-2 p-2.5 border rounded-xl animate-pulse w-full max-w-[280px] select-none">
        <div className="w-10 h-10 bg-base-300 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 bg-base-300 rounded w-3/4" />
          <div className="h-2.5 bg-base-300 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (hasError || !preview) {
    try {
      const parsedUrl = new URL(url);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-2 p-2 hover:bg-base-200 border border-base-300 rounded-lg transition-colors text-left w-full max-w-[280px] text-xs"
        >
          <Globe size={16} className="text-primary shrink-0" />
          <span className="truncate font-medium text-primary underline">{parsedUrl.hostname}</span>
        </a>
      );
    } catch {
      return null;
    }
  }

  const { title, description, image, logo, publisher } = preview;
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    hostname = publisher || "Link";
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="flex flex-col mt-2 hover:bg-base-200 border border-base-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left w-full max-w-[280px] group block"
    >
      {image?.url && (
        <div className="relative w-full h-32 overflow-hidden bg-base-300">
          <img 
            src={image.url} 
            alt={title || "Preview Card"} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-2.5 select-none space-y-1">
        <div className="flex items-center gap-1.5">
          {logo?.url ? (
            <img 
              src={logo.url} 
              alt="Logo" 
              className="w-3.5 h-3.5 object-contain rounded"
            />
          ) : (
            <Globe size={12} className="text-primary" />
          )}
          <span className="text-[10px] font-semibold truncate uppercase tracking-wider">
            {hostname}
          </span>
        </div>
        {title && (
          <h4 className="text-xs font-bold text-base-content leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h4>
        )}
        {description && (
          <p className="text-[11px] leading-snug line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </a>
  );
};

const MessageCalendar = ({ userId, onPickDay }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayIndex, setDayIndex] = useState(null); // null = not fetched yet
  const getMessageDates = useChatStore((state) => state.getMessageDates);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Which days actually hold messages, for the whole conversation.
  //
  // This used to be derived from the loaded page — the newest twenty messages — so
  // every day before those looked empty however much was said on it, and the grid
  // for last month was entirely dead. Fetched once when the calendar is opened
  // rather than on every profile open, since most opens never expand it.
  useEffect(() => {
    if (!isOpen || !userId || dayIndex !== null) return;
    let cancelled = false;
    getMessageDates(userId).then((rows) => {
      if (!cancelled) setDayIndex(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, dayIndex, getMessageDates]);

  // Reset when the conversation changes, so one contact's days never show under
  // another's name.
  useEffect(() => {
    setDayIndex(null);
  }, [userId]);

  // "2026-08-19" -> first message id of that day.
  const messageDates = {};
  (dayIndex || []).forEach((row) => {
    messageDates[row.date] = { id: row.firstId, count: row.count };
  });

  const keyFor = (y, m, d) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = (e) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const days = [];
  // Add empty slots for first day index
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  // Add calendar days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="space-y-2.5 pt-4 border-t border-base-200">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity select-none"
      >
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
          <Calendar size={12} className="text-primary" />
          Chat Calendar
        </span>
        <span className="text-xs font-medium">
          {isOpen ? "Hide" : "Show"}
        </span>
      </div>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top duration-200 space-y-3 mt-2 text-left">
          <div className="flex items-center justify-between">
            <button 
              onClick={prevMonth} 
              className="p-1 hover:bg-base-200 rounded"
              type="button"
            >
              &lt;
            </button>
            <span className="text-[10px] font-bold min-w-[70px] text-center select-none">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={nextMonth} 
              className="p-1 hover:bg-base-200 rounded"
              type="button"
            >
              &gt;
            </button>
          </div>

          {dayIndex === null && (
            <p className="text-[10px] text-center t-dim">Loading dates…</p>
          )}

          <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="font-bold py-0.5 select-none">{d}</div>
            ))}
            {days.map((day, i) => {
              if (day === null) return <div key={i} />;
              
              const entry = messageDates[keyFor(year, month, day)];
              const hasMessage = Boolean(entry);

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!hasMessage}
                  onClick={() => entry && onPickDay(entry.id)}
                  className={`py-1 rounded-md transition-all font-semibold
                    ${hasMessage 
                      ? "text-primary hover:scale-105 cursor-pointer font-bold border" 
                      : "disabled:opacity-50 pointer-events-none"
                    }
                  `}
                  title={
                    hasMessage
                      ? `${entry.count} ${entry.count === 1 ? "message" : "messages"} — open this day`
                      : ""
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const formatCallDuration = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const formatScheduledShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const datePart = sameYear
    ? d.toLocaleDateString([], { month: "short", day: "numeric" })
    : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  return `${datePart} • ${time}`;
};
const SingleCheck = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 8.5L6.5 12L13.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DoubleCheck = ({ className }) => (
  <svg viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1.5 8.5L5 12L12 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 8.5L9.5 12L16.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Date separator helpers ──
const getDateLabel = (dateStr) => {
  const msgDate = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (msgDate.toDateString() === today.toDateString()) return "Today";
  if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diffDays = Math.floor((today - msgDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return msgDate.toLocaleDateString("en-US", { weekday: "long" });
  return msgDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const DateSeparator = ({ date, bare }) => (
  <div className={`flex items-center gap-3 my-3 select-none px-2 ${bare ? "justify-center" : ""}`}>
    {!bare && <div className="flex-1 h-px bg-base-300/50" />}
    <span className="text-[10px] font-medium text-base-content/40 bg-base-200/50 px-3 py-1 rounded-full whitespace-nowrap">
      {getDateLabel(date)}
    </span>
    {!bare && <div className="flex-1 h-px bg-base-300/50" />}
  </div>
);

// Tiny heavily blurred Cloudinary derivative, used as a placeholder while the
// full image downloads so the bubble keeps its size instead of jumping.
const blurPlaceholder = (url) => {
  if (typeof url !== "string" || !url.includes("/upload/")) return null;
  return url.replace("/upload/", "/upload/w_24,e_blur:1200,q_10,f_auto/");
};

const SmoothImage = ({ src, alt, className, onClick, onLoaded }) => {
  const [displayedSrc, setDisplayedSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const prevSrcRef = useRef(src);
  const placeholder = blurPlaceholder(displayedSrc);

  useEffect(() => {
    if (src === prevSrcRef.current) return;
    setIsLoaded(false);

    if (prevSrcRef.current?.startsWith("data:") && src?.startsWith("http")) {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        setDisplayedSrc(src);
        prevSrcRef.current = src;
      };
      img.onerror = () => {
        setDisplayedSrc(src);
        prevSrcRef.current = src;
      };
    } else {
      setDisplayedSrc(src);
      prevSrcRef.current = src;
    }
  }, [src]);

  return (
    <img
      src={displayedSrc}
      alt={alt}
      onClick={onClick}
      loading="lazy"
      onLoad={() => {
        setIsLoaded(true);
        // A single photo has no reserved height until it decodes, so every one
        // that lands grows the list under the reader. The container re-pins if it
        // was already at the newest message.
        if (onLoaded) onLoaded();
      }}
      style={placeholder && !isLoaded ? {
        backgroundImage: `url(${placeholder})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(1px)",
      } : undefined}
      className={className}
    />
  );
};

const ChatContainer = () => {
  const nicknames = useNicknames();
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    lastReadTimestamps,
    loadMoreMessages,
    cancelAttachmentUpload,
    jumpToMessage,
    isViewingHistory,
    pendingScrollId,
    clearPendingScroll,
    isRecipientProfileOpen,
    setIsRecipientProfileOpen,
    setDisappearingTimer,
    messageSearchQuery,
    setReplyingToMessage,
    setEditingMessage,
    toggleReaction,
    deleteMessage,
    pinnedMessage,
    togglePinMessage,
    setLightboxImage,
    typingUsers,
    users,
    setSelectedUser,
    isSelectionMode,
    selectedMessageIds,
    toggleMessageSelection,
    setSelectionMode,
    viewOneViewMessage,
    forwardingMessage,
    setForwardingMessage,
    forwardingMessages,
    setForwardingMessages,
    scrollToBottomSignal,
  } = useChatStore();

  const {
    selectedGroup,
    groupMessages,
    isGroupMessagesLoading,
  } = useGroupStore();

  const [reactionsSheet, setReactionsSheet] = useState(null);

  // The contact profile's gallery.
  //
  // Held separately from `messages` on purpose. That list is one page of the
  // conversation, so deriving the gallery from it meant every picture older than
  // the newest twenty vanished the moment the fetch replaced the cached page —
  // which is what made the media appear and then disappear a second later.
  const [sharedMedia, setSharedMedia] = useState(null); // null = not loaded yet
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const { authUser, onlineUsers } = useAuthStore();
  const { theme, wallpaper, privacyReadReceipts } = useThemeStore();

  // Stop any synthesized speech when switching chats or leaving — a clip from
  // one conversation must not keep playing over another.
  useEffect(() => stopAllAudio, [selectedUser?._id, selectedGroup?._id]);

  const activeMessages = selectedGroup ? groupMessages : messages;
  const activeLoading = selectedGroup ? isGroupMessagesLoading : isMessagesLoading;
  const activeWallpaper = authUser?.chatWallpapers?.[selectedUser?._id] || selectedUser?.chatWallpapers?.[authUser?._id] || wallpaper;
  const messageEndRef = useRef(null);
  const scrollableRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const lastMessageIdRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const isPrependingRef = useRef(false);
  // Mobile-only: long press shows the emoji row and selects the message,
  // handing Reply/Pin/Delete/Forward off to ChatHeader's selection toolbar
  // instead of a separate floating pill (see ChatHeader.jsx).
  const [mobileEmojiId, setMobileEmojiId] = useState(null);
  const longPressTimerRef = useRef(null);
  // Mobile gestures: horizontal swipe = quote reply, double tap = heart reaction
  const touchStartRef = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0 });
  const suppressClickRef = useRef(0);
  // Swipe-to-reply.
  //
  // The whole gesture is driven by direct DOM mutation with zero React state —
  // neither the bubble offset nor the reply arrow touches React during the drag.
  // A state update per touchmove (or even per stage change) re-rendered the entire
  // loaded message history on every frame / stage flip, which was the single
  // biggest source of the jank and "stuck" feel on a long chat. Everything now
  // lives in refs and is painted straight onto the bubble's own node, so the drag
  // rides the GPU compositor at native speed with no render work at all.
  const swipeDxRef = useRef({ id: null, dx: 0, startX: 0, done: false, stage: 0 });
  const swipeAnimRef = useRef(null);

  const SWIPE_REPLY_THRESHOLD = 60;
  const SWIPE_ARROW_THRESHOLD = 20;
  const SWIPE_MAX = 90;

  // Rubber-band resistance past the max so the drag never slams into a hard
  // wall — beyond SWIPE_MAX each extra pixel moves the bubble a fraction less,
  // exactly like iOS/Android momentum-pull handles. Returns the eased offset.
  const resisted = (dx) => {
    const sign = dx < 0 ? -1 : 1;
    const abs = Math.abs(dx);
    if (abs <= SWIPE_MAX) return dx;
    return sign * (SWIPE_MAX + (abs - SWIPE_MAX) * 0.25);
  };

  // 0 = nothing shown, 1 = arrow visible, 2 = arrow armed. Anything between the
  // same two thresholds looks identical, so it needs no render.
  const stageFor = (dx) => {
    const distance = Math.abs(dx);
    if (distance >= SWIPE_REPLY_THRESHOLD) return 2;
    if (distance >= SWIPE_ARROW_THRESHOLD) return 1;
    return 0;
  };

  // Paint the current drag offset straight onto the bubble AND the reply arrow,
  // both via direct DOM writes. translate3d + a persistent will-change keep the
  // WebView on a dedicated compositor layer so the drag rides the GPU with no
  // layout, no repaint of the list, no React render. stageFor(0) == 0 makes the
  // arrow fully invisible at rest, so a persistent element costs nothing.
  const paintSwipe = (node, dx, stage, id) => {
    if (!node) return;
    const eased = resisted(dx);
    node.style.transform = `translate3d(${eased}px,0,0)`;
    node.style.willChange = "transform";

    const arrow = node.querySelector(".swipe-arrow");
    if (!arrow) return;
    const vis = stage >= 1 ? "1" : "0";
    arrow.style.opacity = vis;
    arrow.style.willChange = "opacity,transform";
    // Rightward drag (bubble moves right, arrow on the left) vs leftward drag
    // (bubble moves left, arrow on the right).
    const side = eased > 0 ? "left" : "right";
    arrow.style[side] = "-36px";
    arrow.style[eased > 0 ? "right" : "left"] = "auto";
    arrow.style.transform =
      `translateY(-50%) ${stage === 2 ? "scale(1.25)" : "scale(1)"}`;
    const inner = arrow.children[0];
    if (inner) {
      inner.style.background = stage === 2 ? "rgba(0,208,121,0.12)" : "";
      inner.style.color = stage === 2 ? "rgb(0,208,121)" : "";
    }
  };

  // Snap a bubble (and its arrow) back home after a swipe ends or is cancelled.
  const resetSwipe = (node) => {
    if (!node) return;
    node.style.transition = "transform 220ms cubic-bezier(0.25, 0.8, 0.25, 1)";
    node.style.transform = "translate3d(0,0,0)";
    const arrow = node.querySelector(".swipe-arrow");
    if (arrow) {
      arrow.style.transition = "opacity 150ms ease, transform 220ms ease";
      arrow.style.opacity = "0";
    }
    const clear = setTimeout(() => {
      node.style.transition = "";
      node.style.willChange = "";
      if (arrow) {
        arrow.style.transition = "";
        arrow.style.willChange = "";
        arrow.style.transform = "";
        arrow.style.left = "";
        arrow.style.right = "";
      }
    }, 240);
    swipeAnimRef.current = requestAnimationFrame(() => clearTimeout(clear));
  };

  const handleBubbleTouchStart = (message, e) => {
    if (isSelectionMode) return;
    if (e.target.closest(".mobile-action-bar")) return;

    const touch = e.touches[0];
    swipeDxRef.current = { id: message._id, dx: 0, startX: touch.clientX, done: false, stage: 0 };
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, id: message._id };

    longPressTimerRef.current = setTimeout(() => {
      setMobileEmojiId(message._id);
      // Groups get the same selection toolbar as DMs now that bulk delete
      // handles group messages (it used to 500 on them: a group message has
      // no receiverId and the controller dereferenced it unguarded).
      setSelectionMode(true);
      toggleMessageSelection(message._id);
      haptic("longPress");
      longPressTimerRef.current = null;
    }, 450);
  };

  const handleBubbleTouchMove = (message, e) => {
    if (isSelectionMode) return;
    const start = touchStartRef.current;
    if (!start || start.id !== message._id) return;

    const touch = e.touches[0];
    const rawDx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(rawDx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Only track a mostly-horizontal drag so vertical scrolling stays untouched.
    if (Math.abs(rawDx) > Math.abs(dy) * 1.5 && Math.abs(rawDx) > 4) {
      e.currentTarget.style.transition = "none";
      const eased = resisted(rawDx);
      const stage = stageFor(eased);
      const wasArmed = swipeDxRef.current.stage >= 1;
      swipeDxRef.current.dx = eased;
      swipeDxRef.current.startX = start.x;
      swipeDxRef.current.done = true;
      swipeDxRef.current.stage = stage;
      // Pure DOM paint — no React state, so the drag never re-renders the list.
      paintSwipe(e.currentTarget, eased, stage, message._id);
      // The arrow only fades through armed/unarmed mid-drag; everything else is
      // direct writes, so a re-render is not worth the hitch even when it flips.
      if (stage >= 1 !== wasArmed) {
        const arrow = e.currentTarget.querySelector(".swipe-arrow");
        if (arrow) arrow.style.transform = `translateY(-50%) ${stage === 2 ? "scale(1.25)" : "scale(1)"} translateX(${eased > 0 ? "-34px" : "34px"})`;
      }
    }
  };

  const handleBubbleTouchEnd = (message, e) => {
    if (isSelectionMode) return;
    if (e.target.closest(".mobile-action-bar")) return;

    const start = touchStartRef.current;
    touchStartRef.current = null;
    const wasDragging = swipeDxRef.current.done && swipeDxRef.current.id === message._id;
    const swiped = wasDragging
      ? Math.abs(swipeDxRef.current.dx) >= SWIPE_REPLY_THRESHOLD
      : false;

    if (swipeAnimRef.current) {
      cancelAnimationFrame(swipeAnimRef.current);
      swipeAnimRef.current = null;
    }

    const node = e.currentTarget;
    swipeDxRef.current = { id: null, dx: 0, startX: 0, done: false, stage: 0 };

    if (swiped) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Gentle, quick spring back — the message glides home on a short
      // ease-out curve rather than snapping, so a successful swipe reads as
      // one fluid gesture instead of a jump. The arrow fades with it.
      if (node) {
        node.style.transition = "transform 180ms cubic-bezier(0.2, 0.9, 0.3, 1.2)";
        node.style.transform = "translate3d(0,0,0)";
        const arrow = node.querySelector(".swipe-arrow");
        if (arrow) {
          arrow.style.transition = "opacity 150ms ease";
          arrow.style.opacity = "0";
        }
        const clear = setTimeout(() => {
          node.style.transition = "";
          node.style.willChange = "";
          if (arrow) {
            arrow.style.transition = "";
            arrow.style.willChange = "";
            arrow.style.transform = "";
          }
        }, 200);
        swipeAnimRef.current = requestAnimationFrame(() => clearTimeout(clear));
      }
      suppressClickRef.current = Date.now();
      haptic("impact");
      setReplyingToMessage(message);
      return;
    }

    // Not a commit — if there was any drag, glide the bubble home and hide the
    // arrow; a plain tap skips this entirely so no animation work is wasted.
    if (wasDragging) {
      resetSwipe(node);
      return;
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;

      const now = Date.now();
      const lastTap = lastTapRef.current;
      if (lastTap.id === message._id && now - lastTap.time < 320) {
        lastTapRef.current = { id: null, time: 0 };
        suppressClickRef.current = now;
        setMobileEmojiId(null);
        toggleReaction(message._id, "❤️");
        haptic("double");
        return;
      }
      lastTapRef.current = { id: message._id, time: now };
      // A plain quick tap does nothing special — Reply/Pin/Delete/Forward
      // now live in ChatHeader's selection toolbar, entered via long-press.
    }
  };

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      
      element.classList.add("msg-jump");
      setTimeout(() => {
        element.classList.remove("msg-jump");
      }, 1500);
    }
  };

  const highlightText = (text, query) => {
    if (!query || !query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded font-semibold">{part}</mark> 
            : part
        )}
      </span>
    );
  };

  const renderMessageContent = (message) => {
    if (message.poll) {
      return <PollMessage message={message} />;
    }

    if (message.isOneView) {
      const isSender = message.senderId === authUser._id;
      const isViewed = message.viewedBy?.includes(authUser._id) || (isSender && message.viewedBy?.length > 0);

      const playChime = () => {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc1 = audioCtx.createOscillator();
          const osc2 = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5

          gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(audioCtx.currentTime + 0.5);
          osc2.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
          console.error("Audio Synthesis Error:", e);
        }
      };

      const handleOpenViewOnce = () => {
        if (isViewed) return;
        playChime();
        // Screenshot-protected while open — see lib/secureScreen.js.
        setLightboxImage(message.image, { secure: true });
        if (!isSender || selectedUser?._id === authUser?._id) {
          viewOneViewMessage(message._id);
        }
      };

      if (isViewed) {
        return (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-lg max-w-[140px] select-none text-left">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
              <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
              <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">1</text>
            </svg>
            <span className="text-xs font-semibold select-none">Opened</span>
          </div>
        );
      }

      return (
        <div 
          onClick={handleOpenViewOnce}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg max-w-[140px] select-none cursor-pointer hover:bg-emerald-500/20 active:scale-95 transition-all shadow-sm text-left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
            <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
            <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">1</text>
          </svg>
          <span className="text-xs font-bold select-none">Photo</span>
        </div>
      );
    }

    // While a picture is uploading, the bubble is where the progress belongs. The
    // composer used to hold the thumbnails and show it there instead, which meant a
    // photo sent from a phone reported itself somewhere other than the conversation.
    // A confirmed message has isSending false (and no uploadProgress), so this
    // overlay disappears the instant delivery finishes.
    const sendingProgress =
      message.isSending && typeof message.uploadProgress === "number"
        ? message.uploadProgress
        : null;

    const withProgress = (children) =>
      sendingProgress === null ? (
        children
      ) : (
        <span className="relative block">
          {children}
          <span className="absolute inset-0 rounded-lg pointer-events-none bg-black/30" />
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              cancelAttachmentUpload(message.tempId);
            }}
            className="absolute grid -translate-x-1/2 -translate-y-1/2 rounded-full size-11 place-items-center left-1/2 top-1/2 bg-black/55 text-white"
            title="Cancel"
          >
            <X size={18} />
          </span>
          <span className="absolute left-2 right-2 bottom-2.5 pointer-events-none">
            <span className="block h-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full transition-all duration-200 bg-white rounded-full"
                style={{ width: `${sendingProgress}%` }}
              />
            </span>
            <span className="block mt-1 text-[10px] font-semibold text-white/95 tabular-nums">
              {sendingProgress}%
            </span>
          </span>
        </span>
      );

    return (
      <>
        {message.images && message.images.length > 0 ? (
          <div className={`grid gap-1 mb-1.5 max-w-[260px] sm:max-w-[320px] rounded-lg overflow-hidden ${
            message.images.length === 1 ? "grid-cols-1" :
            message.images.length === 2 ? "grid-cols-2" :
            message.images.length === 3 ? "grid-cols-2" : "grid-cols-2"
          }`}>
            {message.images.map((imgUrl, i) => (
              <SmoothImage
                key={i}
                src={imgUrl}
                alt={`Attachment ${i + 1}`}
                onClick={() => setLightboxImage(imgUrl)}
                onLoaded={handleMediaLoad}
                className={`w-full object-cover cursor-zoom-in hover:opacity-95 transition-opacity rounded ${
                  message.images.length === 3 && i === 0 ? "col-span-2 h-36 sm:h-44" : "h-28 sm:h-36"
                }`}
              />
            ))}
          </div>
        ) : message.image ? (
          withProgress(
            <SmoothImage
              src={message.image}
              alt="Attachment"
              onClick={() => sendingProgress === null && setLightboxImage(message.image)}
              onLoaded={handleMediaLoad}
              className="max-w-[220px] sm:max-w-[280px] max-h-[320px] w-auto object-cover rounded-xl mb-1.5 cursor-zoom-in hover:opacity-95 transition-opacity"
            />
          )
        ) : null}
        {(message.attachments || []).map((attachment, index) => (
          <MessageAttachment
            key={attachment.key || `${message.tempId}-${index}`}
            messageId={message._id}
            attachment={attachment}
            onOpenImage={setLightboxImage}
            progress={
              // Only while this message is still being sent — a confirmed one has
              // no progress and must not show a bar.
              message.isSending && typeof message.uploadProgress === "number"
                ? message.uploadProgress
                : undefined
            }
            onCancel={
              message.isSending ? () => cancelAttachmentUpload(message.tempId) : undefined
            }
          />
        ))}

        {message.contact?.user && (
          <button
            type="button"
            onClick={() => {
              // Opening the shared person's chat is the only useful thing to do
              // with a contact card, and the sidebar may not list them yet, so the
              // card's own details stand in until it does.
              const existing = users?.find((u) => u._id === String(message.contact.user));
              setSelectedUser(
                existing || {
                  _id: String(message.contact.user),
                  fullName: message.contact.name,
                  email: message.contact.email,
                  profilePic: message.contact.profilePic,
                }
              );
            }}
            className="flex items-center gap-3 px-3 py-2.5 mb-1.5 rounded-xl s-chip max-w-[240px] text-left active:scale-[0.98] transition-transform"
          >
            <img
              src={message.contact.profilePic || "/avatar.png"}
              alt=""
              className="object-cover rounded-full size-10 shrink-0"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[12.5px] font-medium truncate text-base-content">
                {message.contact.name || "Contact"}
              </span>
              <span className="block text-[10.5px] mt-0.5 truncate t-dim">
                Tap to open chat
              </span>
            </span>
          </button>
        )}

        {message.voice && (
          <>
            <VoiceNote
              src={message.voice}
              avatarUrl={
                message.isAnonymous
                  ? ""
                  : message.senderId?.profilePic ||
                    ((message.senderId?._id || message.senderId) === authUser._id
                      ? authUser.profilePic
                      : selectedUser?.profilePic) ||
                    ""
              }
            />
            {/* Below the player, not inside it, so playback and the waveform are
                untouched. Only voice notes render this. */}
            <VoiceTranscript message={message} />
          </>
        )}
        {message.text && (
          <div className="text-sm leading-loose break-words pr-10 select-text">
            <p>{renderWithMentions(message, highlightText(message.text, messageSearchQuery))}</p>
            {(() => {
              const urls = message.text.match(URL_REGEX);
              if (!urls) return null;
              return (
                <div className="flex flex-col gap-1.5 mt-2">
                  {urls.map((url, index) => {
                    const ytId = getYoutubeId(url);
                    if (ytId) {
                      return (
                        <div key={index} className="aspect-video w-full max-w-[280px] rounded-lg overflow-hidden border border-base-300 mt-1.5 shadow-sm">
                          <iframe 
                            src={`https://www.youtube.com/embed/${ytId}`}
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                            className="w-full h-full"
                          />
                        </div>
                      );
                    }
                    if (isDirectVideo(url)) {
                      return (
                        <video 
                          key={index}
                          src={url} 
                          controls 
                          className="w-full max-w-[280px] rounded-lg mt-1.5 border border-base-300"
                        />
                      );
                    }
                    return <LinkPreviewCard key={index} url={url} />;
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </>
    );
  };

  // Reactions store only a userId, so the name has to be resolved from
  // whoever is on screen: the two people in a DM, the sidebar list, or the
  // members of the open group.
  const resolveReactor = (rawId) => {
    const id = typeof rawId === "object" && rawId !== null ? rawId._id : rawId;
    if (!id) return null;
    if (id === authUser?._id) return { ...authUser, isMe: true };
    if (selectedUser?._id === id) return selectedUser;
    const fromList = users?.find((u) => u._id === id);
    if (fromList) return fromList;
    const member = selectedGroup?.members?.find((m) => (m.user?._id || m.user) === id);
    return member?.user || null;
  };

  // Highlights "@Name" for people actually recorded in message.mentions, so a
  // literal "@someone" in prose is never styled as if it notified anyone.
  // Falls back to the already-highlighted search output when there's nothing
  // to mark, keeping in-chat search working unchanged.
  const renderWithMentions = (message, fallback) => {
    const ids = message.mentions || [];
    if (ids.length === 0 || !message.text) return fallback;
    if (messageSearchQuery) return fallback; // don't fight the search highlighter

    const names = ids
      .map((id) => resolveReactor(id)?.fullName)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length); // longest first, so "Sai Praneeth" wins over "Sai"
    if (names.length === 0) return fallback;

    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`@(?:${escaped.join("|")})`, "g");
    const parts = message.text.split(pattern);
    const hits = message.text.match(pattern) || [];

    return parts.flatMap((part, i) => [
      part,
      hits[i] ? (
        <span key={`m-${i}`} className="font-semibold text-primary">
          {hits[i]}
        </span>
      ) : null,
    ]);
  };

  const renderReactions = (message) => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const counts = {};
    message.reactions.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });

    const myReaction = message.reactions.find(
      (r) => (r.userId === authUser._id || r.userId?._id === authUser._id)
    );

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          // Opens the who-reacted sheet. Removing your own reaction still
          // lives here — it's the first row of that sheet — so the old
          // one-tap-to-remove behaviour is preserved, just one step deeper
          // and now discoverable rather than hidden in a tooltip.
          setReactionsSheet(message);
        }}
        className={`absolute bottom-[-8px] right-[-4px] flex items-center gap-1 bg-base-200 rounded-full px-1.5 py-0.5 shadow-sm text-[10px] select-none z-10 text-base-content font-medium cursor-pointer hover:bg-base-300 transition-colors ${myReaction ? "ring-1" : ""}`}
        title="See who reacted"
      >
        <span className="flex gap-0.5">
          {Object.keys(counts).map((emoji) => (
            <span key={emoji}>{emoji}</span>
          ))}
        </span>
        {message.reactions.length > 1 && (
          <span className="opacity-70">{message.reactions.length}</span>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
    }
  }, [selectedUser?._id, getMessages]);

  // An edit leaves the list the same length, so the normal
  // new-message autoscroll never fires. Follow the store's explicit request.
  useEffect(() => {
    if (!scrollToBottomSignal) return;
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scrollToBottomSignal]);

  useEffect(() => {
    if (!isRecipientProfileOpen || !selectedUser?._id || selectedGroup) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await axiosInstance.get(`/messages/media/${selectedUser._id}`);
        if (cancelled) return;
        setSharedMedia({
          items: Array.isArray(res.data?.items) ? res.data.items : [],
          total: Number(res.data?.total) || 0,
        });
      } catch {
        // Leave whatever is on screen rather than emptying the gallery on a
        // failed request — the loaded page is still a truthful subset.
        if (!cancelled) setSharedMedia(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isRecipientProfileOpen, selectedUser?._id, selectedGroup]);

  // Opening a different conversation must not show the previous one's gallery.
  useEffect(() => {
    setSharedMedia(null);
  }, [selectedUser?._id]);

  // Selection mode can end from ChatHeader's toolbar (back button, or an
  // action that exits it) — drop the emoji row too so it doesn't linger.
  useEffect(() => {
    if (!isSelectionMode) setMobileEmojiId(null);
  }, [isSelectionMode]);

  // Once a second message is picked the gesture has become a multi-select, so
  // the reaction row is dismissed for good — clearing the id (rather than only
  // hiding it in render) stops it springing back if the count drops to one.
  useEffect(() => {
    if (selectedMessageIds.length >= 2) setMobileEmojiId(null);
  }, [selectedMessageIds.length]);

  useEffect(() => {
    prevMessagesLengthRef.current = 0;
    lastMessageIdRef.current = null;
    prevScrollHeightRef.current = 0;
    prevScrollTopRef.current = 0;
    isPrependingRef.current = false;
  }, [selectedUser?._id, selectedGroup?._id]);

  // Whether the reader is sitting at the newest message. Sampled from real scroll
  // events, so it is never measured after a late-loading image has already moved
  // things — by then the answer would be wrong.
  const isNearBottomRef = useRef(true);

  const handleScroll = async () => {
    const container = scrollableRef.current;
    if (!container) return;
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (selectedGroup) return; // groups don't support pagination yet

    if (container.scrollTop === 0 && !isPrependingRef.current && selectedUser?._id) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingRef.current = true;
      const prepended = await loadMoreMessages(selectedUser._id);
      // Nothing arrived, so no re-render is coming to release the flag.
      if (!prepended) isPrependingRef.current = false;
    }
  };

  // The read heuristic below needs "has this person written since?". Working that
  // out per message with a filter+pop was O(n^2) over the loaded history and ran
  // again on every re-render — a keystroke, a typing indicator, a selection — so
  // long chats stuttered. One pass, reused by every tick.
  const latestIncomingAt = useMemo(() => {
    const byUser = new Map();
    if (!Array.isArray(messages)) return byUser;
    for (const m of messages) {
      const sender = m.senderId?._id || m.senderId;
      if (!sender || sender === authUser?._id) continue;
      const at = new Date(m.createdAt).getTime();
      if (at > (byUser.get(sender) || 0)) byUser.set(sender, at);
    }
    return byUser;
  }, [messages, authUser?._id]);

  /**
   * Opens the day the calendar was tapped on.
   *
   * If that message is already on screen this is just a scroll. Otherwise the
   * conversation is reloaded as a window around it, which is what lets a day from
   * months ago be reached without paging through everything in between.
   */
  const handlePickDay = async (messageId) => {
    setIsRecipientProfileOpen(false);

    if (activeMessages?.some((m) => m._id === messageId)) {
      scrollToMessage(messageId);
      return;
    }
    if (selectedUser?._id) await jumpToMessage(selectedUser._id, messageId);
  };

  /** Keeps the newest message in view when a photo finishes decoding. */
  const handleMediaLoad = () => {
    if (!isNearBottomRef.current) return;
    messageEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  const renderTicks = (message) => {
    if (message.senderId !== authUser._id) return null;

    // Optimistic message not yet confirmed by the server — either still
    // sending, or queued in the offline outbox waiting to be retried.
    if (message.tempId && message._id === message.tempId) {
      return <Clock className="w-[13px] h-[13px] text-zinc-400 flex-shrink-0" />;
    }

    const receiverId = message.receiverId;
    const isOnline = onlineUsers.includes(receiverId);

    // Condition 1: Read by recipient
    const lastReadTime = lastReadTimestamps[receiverId] || 0;
    const messageTime = new Date(message.createdAt).getTime();

      if (messageTime <= lastReadTime) {
      return <DoubleCheck className={`w-[15px] h-[13px] ${privacyReadReceipts ? 'text-blue-500' : 'text-zinc-400'} flex-shrink-0`} />;
    }

    // Heuristic: If recipient has sent any message after this message, they have read it!
    if ((latestIncomingAt.get(receiverId) || 0) > messageTime) {
      return <DoubleCheck className={`w-[15px] h-[13px] ${privacyReadReceipts ? 'text-blue-500' : 'text-zinc-400'} flex-shrink-0`} />;
    }

    // Condition 2: Delivered (online)
    if (isOnline) {
      return <DoubleCheck className="w-[15px] h-[13px] text-zinc-400 flex-shrink-0" />;
    }

    // Condition 3: Sent (offline)
    return <SingleCheck className="w-[13px] h-[13px] text-zinc-400 flex-shrink-0" />;
  };

  useLayoutEffect(() => {
    if (!Array.isArray(activeMessages) || activeMessages.length === 0) {
      prevMessagesLengthRef.current = 0;
      lastMessageIdRef.current = null;
      return;
    }

    const latestMessage = activeMessages[activeMessages.length - 1];
    const latestMessageId = latestMessage ? latestMessage._id : null;
    const container = scrollableRef.current;

    // A jump landed. Go to the message that was asked for and take none of the
    // branches below: this list is a window from the past, and the newest-message
    // rule would yank the view to the bottom of it immediately.
    if (pendingScrollId && activeMessages.some((m) => m._id === pendingScrollId)) {
      const target = document.getElementById(`msg-${pendingScrollId}`);
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "center" });
        target.classList.add("msg-jump");
        setTimeout(() => target.classList.remove("msg-jump"), 1500);
      }
      prevMessagesLengthRef.current = activeMessages.length;
      lastMessageIdRef.current = latestMessageId;
      clearPendingScroll();
      return;
    }

    if (isPrependingRef.current && container && prevScrollHeightRef.current) {
      // Synchronously adjust scroll offset in the same layout pass before paint
      const deltaHeight = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = deltaHeight + prevScrollTopRef.current;
      isPrependingRef.current = false;
    } else if (prevMessagesLengthRef.current === 0) {
      // First render of this conversation's history: jump straight to the
      // bottom instead of visibly scrolling through the whole thing.
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ behavior: "auto" });
      }
    } else if (latestMessageId !== lastMessageIdRef.current) {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }

    prevMessagesLengthRef.current = activeMessages.length;
    lastMessageIdRef.current = latestMessageId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessages, pendingScrollId]);

  return (
    <div className="flex-1 flex h-full max-h-full overflow-hidden relative">
      {/* Left Column: Chat View */}
      <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden bg-base-100">
        <ChatHeader />

        {/* Pinned Message Sticky Banner */}
        {pinnedMessage && !pinnedMessage.isDeletedForEveryone && (
          <div 
            onClick={() => {
              const el = document.getElementById(`msg-${pinnedMessage._id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="hover:bg-base-200 border-b border-base-300 px-4 py-2 flex items-center justify-between cursor-pointer transition-colors z-30 shadow-sm text-left animate-in slide-in-from-top duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Pin size={14} className="text-amber-500 flex-shrink-0 fill-amber-500/20" />
              <div className="text-xs min-w-0">
                <span className="font-semibold text-amber-500 block text-[10px] uppercase tracking-wider">
                  Pinned Message
                </span>
                <p className="truncate font-medium max-w-[200px] sm:max-w-[400px]">
                  {pinnedMessage.text || (pinnedMessage.image || pinnedMessage.images?.length ? "📷 Photo" : pinnedMessage.voice ? "🎙️ Voice Message" : "Message")}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePinMessage(pinnedMessage._id);
              }}
              className="p-1 hover:bg-base-300 rounded-full transition-colors hover:text-red-500"
              title="Unpin message"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div 
          ref={scrollableRef}
          onScroll={handleScroll}
          onClick={() => setMobileEmojiId(null)}
          onTouchStart={(e) => {
            if (!e.target.closest(".chat-bubble")) {
              setMobileEmojiId(null);
            }
          }}
          className="flex-1 p-4 space-y-3 overflow-y-auto transition-all"
          role="list"
          aria-label="Conversation messages"
          style={getWallpaperStyle(activeWallpaper, theme)}
        >
          {activeLoading && (!Array.isArray(activeMessages) || activeMessages.length === 0) ? (
            <div className="h-full w-full flex items-center justify-center">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : (
            Array.isArray(activeMessages) && activeMessages.flatMap((message, index) => {
              const isNewDay = index === 0 ||
                new Date(activeMessages[index - 1].createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();

              if (message.isCallLog) {
                return [
                  isNewDay && <DateSeparator key={`sep-${message._id}`} date={message.createdAt} bare={index === 0} />,
                  <div key={message._id} className="flex justify-center my-3 select-none w-full animate-in fade-in duration-200">
                    <div className="border border-base-300 rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-medium shadow-sm">
                      {message.callType === "video" ? (
                        <Video size={13} className={message.callStatus === "missed" ? "text-red-500" : "text-emerald-500"} />
                      ) : (
                        <Phone size={13} className={message.callStatus === "missed" ? "text-red-500" : "text-emerald-500"} />
                      )}
                      <span className="capitalize">
                        {(message.senderId?._id || message.senderId) === authUser._id ? "Outgoing" : "Incoming"} {message.callType} call • {message.callStatus === "completed" ? `duration ${formatCallDuration(message.callDuration)}` : message.callStatus}
                      </span>
                      <span className="text-[10px] opacity-60">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                ].filter(Boolean);
              }

              return [
                isNewDay && <DateSeparator key={`sep-${message.tempId || message._id}-d`} date={message.createdAt} bare={index === 0} />,
                <div
                  key={message.tempId || message._id}
                  className={`flex items-center gap-2 group relative transition-colors duration-150 -mx-4 px-6 lg:mx-0 lg:px-2 ${
                    isSelectionMode && selectedMessageIds.includes(message._id)
                      ? "msg-selected"
                      : ""
                  }`}
                >
                  {/* Mobile selection is shown by tinting the whole row (above),
                      WhatsApp-style. The negative margin lets that tint bleed
                      through the scroll container's p-4 so the band spans the
                      full width; the matching px-6 keeps the bubble in exactly
                      the same place as the old px-2 did, so nothing moves.
                      Desktop keeps its checkbox unchanged — hence hidden lg:block
                      here and lg:bg-transparent above. */}
                  {isSelectionMode && !message.isCallLog && (
                    <input
                      type="checkbox"
                      checked={selectedMessageIds.includes(message._id)}
                      onChange={() => toggleMessageSelection(message._id)}
                      className="hidden lg:block checkbox checkbox-primary checkbox-sm select-none mr-2 cursor-pointer z-20"
                    />
                  )}
                  <div
                    id={`msg-${message._id}`}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`Message from ${message.senderId?.fullName || (message.senderId === authUser._id ? 'You' : 'Participant')}. ${message.text ? message.text : message.image ? 'Image attachment' : ''}`}
                    className={`chat ${(message.senderId?._id || message.senderId) === authUser._id ? "chat-end" : "chat-start"} flex-1 relative`}
                    onClick={(e) => {
                      if (isSelectionMode) {
                        e.stopPropagation();
                        haptic("tap");
                        toggleMessageSelection(message._id);
                      }
                    }}
                  >
                  {/* Chat Bubble Wrapper with group-hover reactions panel */}
                  <div 
                    onDoubleClick={() => !isSelectionMode && toggleReaction(message._id, "❤️")}
                    onClick={(e) => {
                      if (isSelectionMode) return;
                      if (e.target.closest(".mobile-action-bar") || e.target.closest("button") || e.target.closest("a") || e.target.closest("input") || e.target.closest("audio") || e.target.closest("video") || e.target.closest("iframe")) return;
                      if (Date.now() - suppressClickRef.current < 400) return;
                      // A plain tap no longer opens anything — long-press
                      // (handled via touch events below) is the only entry
                      // point into the emoji row / selection toolbar now.
                    }}
                    onTouchStart={(e) => handleBubbleTouchStart(message, e)}
                    onTouchEnd={(e) => handleBubbleTouchEnd(message, e)}
                    onTouchMove={(e) => handleBubbleTouchMove(message, e)}
                    onTouchCancel={(e) => {
                      // OS interrupted the gesture (notification, app switch,
                      // low battery). Snap the bubble and arrow home so it never
                      // stays stranded mid-drag.
                      swipeDxRef.current = { id: null, dx: 0, startX: 0, done: false, stage: 0 };
                      resetSwipe(e.currentTarget);
                      if (touchStartRef.current) touchStartRef.current = null;
                    }}
                    style={{ touchAction: "pan-y" }}
                    className={`flex flex-col py-2 px-2.5 chat-bubble relative min-w-[72px] pr-12 transition-colors duration-300 select-none cursor-default pb-3 ${(message.senderId?._id || message.senderId) === authUser._id ? "bubble-mine" : ""} ${isSelectionMode ? "cursor-pointer" : ""}`}
                  >
                  {/* Swipe-to-reply arrow. Always rendered, hidden by default
                      (opacity-0) and shown purely via direct DOM writes during a
                      horizontal drag — keeping it in JSX on every frame would
                      re-render the whole list mid-gesture. */}
                  <span
                    className="swipe-arrow absolute flex items-center justify-center select-none opacity-0 pointer-events-none -left-9"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  >
                    <span className="swipe-arrow-icon flex items-center justify-center rounded-full p-1.5 text-base-content/60 transition-all duration-150">
                      <CornerUpLeft size={16} />
                    </span>
                  </span>
                  {/* Group Message Sender Name Label.
                      An anonymous question arrives with no author — the server
                      strips it — so it always shows this label, including for the
                      person who asked. anonymousIsMine is the only hint they get,
                      and it is computed per viewer so it reveals nothing to
                      anyone else. */}
                  {selectedGroup && message.isAnonymous ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-primary mb-0.5 select-none">
                      <EyeOff size={11} />
                      Anonymous
                      {message.anonymousIsMine && (
                        <span className="font-medium t-dim">· you</span>
                      )}
                    </span>
                  ) : selectedGroup && (message.senderId?._id || message.senderId) !== authUser._id ? (
                    <span className="text-[11px] font-bold text-primary block mb-0.5 select-none">
                      {message.senderId?.fullName || "Member"}
                    </span>
                  ) : null}

                  {/* Reply Quote Display */}
                  {message.replyTo && (
                    <div 
                      onClick={() => scrollToMessage(message.replyTo._id)}
                      className="bg-black/15 dark:bg-white/10 border-l-4 border-primary px-2.5 py-1.5 rounded-r-md text-left mb-2 text-xs cursor-pointer select-none transition-all hover:bg-black/20 dark:hover:bg-white/15"
                    >
                      <span className="text-[10px] font-bold text-primary block mb-0.5">
                        {message.replyTo.senderId === authUser._id ? "You" : displayNameOf(selectedUser, nicknames)}
                      </span>
                      <p className="truncate opacity-80 max-w-[200px] sm:max-w-[300px]">
                        {message.replyTo.text || (message.replyTo.image || message.replyTo.images?.length ? "📷 Photo" : message.replyTo.voice ? "🎙️ Voice Message" : "Message")}
                      </p>
                    </div>
                  )}

                  {/* ── Mobile: emoji bar — long press (inline near message) ── */}
                  {mobileEmojiId === message._id && selectedMessageIds.length < 2 && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className={`mobile-action-bar absolute top-[-40px] lg:hidden animate-in zoom-in-95 duration-150 flex items-center bg-base-100 rounded-full px-2 py-1 shadow-xl z-30 gap-0.5 ${
                        (message.senderId?._id || message.senderId) === authUser._id
                          ? "right-0"
                          : "left-0"
                      }`}
                    >
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                        <button 
                          key={emoji} 
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic("tap");
                            toggleReaction(message._id, emoji);
                            setMobileEmojiId(null);
                            if (isSelectionMode) setSelectionMode(false);
                          }}
                          className="text-base active:scale-125 transition-transform px-1 py-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Desktop: full hover bar (emojis + actions) ── */}
                  {!isSelectionMode && (
                    <div
                      className={`absolute top-[-30px] opacity-0 group-hover:opacity-100 transition-all duration-200 hidden lg:flex items-center bg-base-200 rounded-full px-2 py-1 shadow-lg z-10 gap-1.5 pointer-events-auto ${
                        (message.senderId?._id || message.senderId) === authUser._id
                          ? "right-0"
                          : "left-0"
                      }`}
                    >
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(message._id, emoji)} className="hover:scale-125 transition-transform duration-100 text-sm">
                          {emoji}
                        </button>
                      ))}
                      <div className="w-[1px] h-3 bg-base-300 mx-1" />
                      <button onClick={() => setReplyingToMessage(message)} className="hover:text-primary transition-colors flex items-center" title="Reply"><CornerUpLeft size={13} /></button>
                      {!message.isDeletedForEveryone && (<button onClick={(e) => { e.stopPropagation(); setForwardingMessage(message); }} className="hover:text-primary transition-colors flex items-center" title="Forward"><Forward size={13} /></button>)}
                      {message.senderId === authUser?._id && !message.isDeletedForEveryone && message.text && (Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000) && (<button onClick={() => setEditingMessage(message)} className="hover:text-primary transition-colors flex items-center" title="Edit"><Pencil size={13} /></button>)}
                      {!message.isDeletedForEveryone && (<button onClick={() => togglePinMessage(message._id)} className={`transition-colors flex items-center ${message.isPinned ? "text-amber-500 hover:text-amber-600" : "hover:text-amber-500"}`} title={message.isPinned ? "Unpin" : "Pin"}><Pin size={13} /></button>)}
                      {!message.isDeletedForEveryone && (
                        <div className="dropdown dropdown-bottom dropdown-end flex items-center">
                          <div tabIndex={0} role="button" className="hover:text-red-500 transition-colors flex items-center p-0.5 cursor-pointer" title="Delete"><Trash2 size={13} /></div>
                          <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow-xl bg-base-100 border border-base-300 rounded-box w-36 text-xs text-base-content mt-1">
                            <li><button onClick={() => deleteMessage(message._id, "me")} className="hover:bg-base-200 py-1.5 text-left font-medium">Delete for me</button></li>
                            {(message.senderId?._id || message.senderId) === authUser._id && (<li><button onClick={() => deleteMessage(message._id, "everyone")} className="hover:bg-red-500 hover:text-white py-1.5 text-left font-medium text-red-500">Delete for everyone</button></li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {message.isDeletedForEveryone ? (
                    <p className="text-xs italic flex items-center gap-1 select-none py-1 pr-14">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      This message was deleted
                    </p>
                  ) : (
                    <>
                      {/* Forwarded label */}
                      {message.isForwarded && (
                        <span className="flex items-center gap-1 text-[9px] font-medium mb-1 select-none">
                          <Forward size={9} className="opacity-60" />
                          Forwarded
                        </span>
                      )}
                      {/* Message Content & Media */}
                      {renderMessageContent(message)}
                      {/* Inline AI: translation / script change / synthesized audio */}
                      <MessageAiPanel message={message} />
                    </>
                  )}
                  
                    <span className="absolute right-1 bottom-1 inline-flex items-center gap-0.5 text-[9px] opacity-95 select-none">
                    {message.scheduledAt ? (
                      <span className="inline-flex items-center gap-0.5 bg-amber-500/8 border border-amber-500/15 text-amber-600 px-1 py-[2px] rounded-md text-[9px] font-medium truncate">
                        <Clock size={10} />
                        <span className="whitespace-nowrap">{formatScheduledShort(message.scheduledAt)}</span>
                      </span>
                    ) : (
                      <span className={`${((message.senderId?._id || message.senderId) === authUser._id) ? 'bg-[#1f2937]/20 text-white/85' : 'bg-transparent'} inline-flex items-center gap-0.5 px-1 py-[2px] rounded-md text-[9px]`}>{formatMessageTime(message.createdAt)}</span>
                    )}

                    {(message.senderId?._id || message.senderId) === authUser._id && (
                      <span className="flex items-center">
                        {message.scheduledStatus === 'scheduled' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (selectedGroup) useGroupStore.getState().cancelScheduledMessage(message._id); else useChatStore.getState().cancelScheduledMessage(message._id); }}
                            className="ml-0.5 p-1 hover:bg-red-600/10 rounded-full text-red-500/80"
                            title="Cancel scheduled message"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : (
                          <span className="ml-0.5 scale-75 origin-bottom-right -mt-0.5">{renderTicks(message)}</span>
                        )}
                      </span>
                    )}
                  </span>

                  {/* Reaction Pill Overlay */}
                  {!message.isDeletedForEveryone && renderReactions(message)}
                </div>
              </div>
            </div>
              ].filter(Boolean);
            })
          )}
          <div ref={messageEndRef} />
        </div>

        {isViewingHistory && (
          <button
            type="button"
            onClick={() => selectedUser?._id && getMessages(selectedUser._id)}
            className="absolute z-20 flex items-center gap-1.5 px-3.5 h-9 -translate-x-1/2 rounded-full shadow-xl bottom-[86px] left-1/2 bg-primary text-primary-content text-[12.5px] font-semibold active:scale-95 transition-transform cg-fade"
          >
            <Clock size={13} />
            Back to latest
          </button>
        )}

        <MessageInput />

        {/* Selection-mode actions (DM) now live in ChatHeader's toolbar
            instead of a floating bottom bar — see ChatHeader.jsx. */}
      </div>

      {/* Right Column: Recipient Profile Info Sidebar */}
      {isRecipientProfileOpen && (
        <div className="absolute lg:relative top-0 right-0 z-50 w-full lg:w-80 h-full bg-base-100 flex flex-col shadow-2xl lg:shadow-none">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h3 className="font-semibold text-base text-base-content">Contact Info</h3>
            <button 
              onClick={() => setIsRecipientProfileOpen(false)}
              className="p-1.5 hover:bg-base-200 rounded-full transition-colors hover:text-base-content"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Cover banner + center avatar & name */}
            <div className="-mx-5 -mt-5">
              <div className="relative w-full h-24 overflow-hidden bg-gradient-to-r">
                {selectedUser.bannerPic && (
                  <img
                    src={selectedUser.bannerPic}
                    alt=""
                    onClick={() => setLightboxImage(selectedUser.bannerPic)}
                    className="object-cover w-full h-full cursor-zoom-in hover:opacity-90 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-base-100 to-transparent" />
              </div>
              {/* relative + z-10: the cover above is positioned, so without a
                  stacking context of its own this block paints *under* it and
                  the cover photo (and its fade) cut across the avatar. The
                  picture has to sit on top of the banner, as on LinkedIn. */}
              <div className="relative z-10 flex flex-col items-center text-center px-5 -mt-14">
                <img
                  src={selectedUser.profilePic || "/avatar.png"}
                  alt={displayNameOf(selectedUser, nicknames)}
                  onClick={() => setLightboxImage(selectedUser.profilePic || "/avatar.png")}
                  className="object-cover ring-4 ring-base-100 bg-base-200 rounded-full size-28 shadow-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                />
                <h2 className="font-semibold text-lg text-base-content mt-3">
                  {selectedUser._id === authUser._id ? "Personal Notes (You)" : displayNameOf(selectedUser, nicknames)}
                </h2>
                <span className="text-xs select-all">{selectedUser.email}</span>
                <div className="mt-2.5">
                  <SocialLinksRow user={selectedUser} variant="icons" emptyText="" />
                </div>

                {/* Chat streak — Snapchat-style fire + count */}
                {selectedUser._id !== authUser._id && (() => {
                  const streak = authUser?.chatStreaks?.[selectedUser._id];
                  if (!streak || !streak.count) return null;
                  const isHot = streak.count >= 3;
                  return (
                    <div className={`mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                      ${isHot
                        ? "bg-gradient-to-r from-orange-500/15 via-amber-500/15 to-yellow-500/15 text-orange-500"
                        : "bg-base-200 text-base-content/70"
                      }`}
                    >
                      <span className={isHot ? "animate-pulse" : ""}>&#x1F525;</span>
                      <span>{streak.count} day streak</span>
                      {streak.longestStreak > streak.count && (
                        <span className="text-[10px] opacity-50 ml-0.5">(best {streak.longestStreak})</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Media, links and docs gallery section (WhatsApp Desktop style) */}
            {(() => {
              // Until the request lands, the open page is used so the panel is
              // never blank; after it lands the full conversation's media replaces
              // it. Multi-image messages contribute each of their pictures.
              const fallback = Array.isArray(messages)
                ? messages
                    .filter((m) => !m.isDeletedForEveryone)
                    .flatMap((m) => {
                      const urls = m.image ? [m.image] : [];
                      if (Array.isArray(m.images)) urls.push(...m.images.filter(Boolean));
                      return urls.map((url, index) => ({ _id: `${m._id}-${index}`, url }));
                    })
                : [];
              const mediaMessages = sharedMedia ? sharedMedia.items : fallback;
              const mediaTotal = sharedMedia ? sharedMedia.total : mediaMessages.length;
              return (
                <div className="space-y-2.5 pt-2">
                  {/* The heading opens the full gallery; the eight tiles below
                      stay as the preview they were. */}
                  <button
                    type="button"
                    onClick={() => mediaTotal > 0 && setIsGalleryOpen(true)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="text-xs font-semibold flex items-center gap-1.5 select-none">
                      <Image size={14} className="text-primary" />
                      Media, links and docs
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium select-none">
                      {mediaTotal}
                      {mediaTotal > 0 && <ChevronRight size={13} className="t-dim" />}
                    </span>
                  </button>
                  {mediaMessages.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {(sharedMedia ? mediaMessages.slice(0, 8) : mediaMessages.slice(-8).reverse()).map((item) => (
                        <div 
                          key={item._id}
                          onClick={() => setLightboxImage(item.url)}
                          className="aspect-square rounded-xl overflow-hidden bg-base-200 cursor-zoom-in group relative hover:opacity-90 transition-all"
                        >
                          <img 
                            src={item.url} 
                            alt="Shared media" 
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" 
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-base-200 p-3 rounded-xl text-center">
                      <p className="text-xs italic">No media shared yet</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <MessageCalendar userId={selectedUser?._id} onPickDay={handlePickDay} />

            {/* Bio info */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <FileText size={12} />
                Bio
              </span>
              <p className="text-sm bg-base-200 p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed">
                {selectedUser.bio || <span className="text-zinc-500 italic">No bio added yet</span>}
              </p>
            </div>

            {/* Links website */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <Globe size={12} />
                Website / Social Link
              </span>
              <div className="text-sm bg-base-200 p-3.5 rounded-2xl truncate">
                {selectedUser.link ? (
                  <a 
                    href={selectedUser.link.startsWith("http") ? selectedUser.link : `https://${selectedUser.link}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline font-medium"
                  >
                    {selectedUser.link}
                  </a>
                ) : (
                  <span className="text-zinc-500 italic">No link added yet</span>
                )}
              </div>
            </div>

            {/* Social & portfolio links */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <Link2 size={12} />
                Social & Portfolio
              </span>
              <SocialLinksRow user={selectedUser} variant="list" />
            </div>

            {/* Disappearing Messages Section */}
            {selectedUser._id !== authUser._id && (
              <div className="space-y-1.5 pt-5 text-left">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1 select-none">
                  <Clock size={12} />
                  Disappearing Messages
                </span>
                <select
                  className="w-full h-11 px-3 rounded-2xl bg-base-200 border-0 text-xs text-base-content outline-none focus:ring-2 transition-shadow"
                  value={authUser?.disappearingTimers?.[selectedUser._id] || "off"}
                  onChange={(e) => setDisappearingTimer(selectedUser._id, e.target.value)}
                >
                  <option value="off">Off (Keep messages)</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
            )}

            {/* Per-contact read receipt hiding */}
            {selectedUser._id !== authUser._id && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-base-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-base-content">Hide read receipts</span>
                  <p className="text-[10px] text-base-content/50">
                    {authUser?.readReceiptsHidden?.[selectedUser._id]
                      ? `${selectedUser.fullName || "This contact"} won't see blue ticks from you`
                      : `${selectedUser.fullName || "This contact"} sees when you read their messages`}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={Boolean(authUser?.readReceiptsHidden?.[selectedUser._id])}
                  onChange={async (e) => {
                    const hidden = e.target.checked;
                    try {
                      const res = await axiosInstance.put(`/auth/read-receipts/${selectedUser._id}`, { hidden });
                      useAuthStore.setState({
                        authUser: { ...authUser, readReceiptsHidden: res.data.readReceiptsHidden },
                      });
                    } catch {
                      toast.error("Could not update read receipt setting");
                    }
                  }}
                />
              </div>
            )}

            {/* Meta details */}
            <div className="pt-5 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>Joined: {selectedUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-px shrink-0" />
                <span>Encryption: in transit only (TLS) — not end-to-end</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {isGalleryOpen && selectedUser && (
        <MediaGallerySheet
          userId={selectedUser._id}
          contactName={displayNameOf(selectedUser, nicknames)}
          onClose={() => setIsGalleryOpen(false)}
          onOpenImage={(url) => setLightboxImage(url)}
        />
      )}

      {/* Who reacted — grouped by emoji, your own row removes the reaction */}
      {reactionsSheet && (
        <div
          onClick={() => setReactionsSheet(null)}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[2px] cg-fade sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm max-h-[70dvh] bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col cg-sheet sm:cg-dialog"
          >
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
              <span className="w-9 h-1 rounded-full" />
            </div>
            <div className="flex items-center gap-3 px-5 pt-2 pb-3 flex-shrink-0">
              <button
                onClick={() => setReactionsSheet(null)}
                data-modal-close
                className="p-2 -ml-2 rounded-full hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <h3 className="font-semibold text-[17px] text-base-content">
                Reactions
                <span className="ml-2 text-sm font-normal">
                  {reactionsSheet.reactions?.length || 0}
                </span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {(reactionsSheet.reactions || []).map((reaction, i) => {
                const person = resolveReactor(reaction.userId);
                const isMe = person?.isMe;
                return (
                  <button
                    key={`${reaction.userId}-${i}`}
                    type="button"
                    onClick={() => {
                      if (!isMe) return;
                      toggleReaction(reactionsSheet._id, reaction.emoji);
                      setReactionsSheet(null);
                    }}
                    disabled={!isMe}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl text-left transition-colors ${
                      isMe ? "hover:bg-base-200 active:bg-base-300" : "cursor-default"
                    }`}
                  >
                    <img
                      src={person?.profilePic || "/avatar.png"}
                      alt=""
                      className="object-cover rounded-full size-10 flex-shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium text-base-content truncate">
                        {isMe ? "You" : displayNameOf(person, nicknames) || "Someone"}
                      </span>
                      {isMe && (
                        <span className="block text-xs">Tap to remove</span>
                      )}
                    </span>
                    <span className="text-xl flex-shrink-0">{reaction.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
          users={users || []}
          authUser={authUser}
        />
      )}

      {/* Multi-select forward, opened from the selection header */}
      {forwardingMessages.length > 0 && (
        <ForwardModal
          messages={forwardingMessages}
          onClose={() => setForwardingMessages([])}
          users={users || []}
          authUser={authUser}
        />
      )}
    </div>
  );
};
export default ChatContainer;