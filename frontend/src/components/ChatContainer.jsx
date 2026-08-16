import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useEffect, useRef, useLayoutEffect, useState } from "react";
import { X, Globe, FileText, Calendar, ShieldCheck, Clock, CornerUpLeft, Trash2, Pencil, Phone, Video, Pin, Forward, Image, Link2 } from "lucide-react";
import ForwardModal from "./ForwardModal";
import SocialLinksRow from "./SocialLinksRow";
import { useNicknames, displayNameOf } from "../lib/contacts";
import PollMessage from "./PollMessage";
import VoiceNote from "./VoiceNote";
import { useThemeStore } from "../store/useThemeStore";
import { getWallpaperStyle } from "../pages/SettingsPage";


import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import useAuthStore from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

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
      <div className="flex items-center gap-2.5 mt-2 p-2.5 bg-base-200/70 border border-base-300/50 rounded-xl animate-pulse w-full max-w-[280px] select-none">
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
          className="flex items-center gap-2 mt-2 p-2 bg-base-200/60 hover:bg-base-200 border border-base-300 rounded-lg transition-colors text-left w-full max-w-[280px] text-xs"
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
      className="flex flex-col mt-2 bg-base-200/80 hover:bg-base-200 border border-base-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left w-full max-w-[280px] group block"
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
          <span className="text-[10px] text-base-content/60 font-semibold truncate uppercase tracking-wider">
            {hostname}
          </span>
        </div>
        {title && (
          <h4 className="text-xs font-bold text-base-content leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h4>
        )}
        {description && (
          <p className="text-[11px] text-base-content/70 leading-snug line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </a>
  );
};

const MessageCalendar = ({ messages, scrollToMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Find all message dates
  const messageDates = {};
  if (Array.isArray(messages)) {
    messages.forEach((msg) => {
      if (msg.createdAt) {
        const d = new Date(msg.createdAt);
        const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!messageDates[dateStr]) {
          messageDates[dateStr] = msg._id;
        }
      }
    });
  }

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
        <span className="text-xs text-base-content/50 font-medium">
          {isOpen ? "Hide" : "Show"}
        </span>
      </div>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top duration-200 space-y-3 mt-2 text-left">
          <div className="flex items-center justify-between">
            <button 
              onClick={prevMonth} 
              className="p-1 hover:bg-base-200 rounded text-base-content/60"
              type="button"
            >
              &lt;
            </button>
            <span className="text-[10px] font-bold text-base-content/85 min-w-[70px] text-center select-none">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={nextMonth} 
              className="p-1 hover:bg-base-200 rounded text-base-content/60"
              type="button"
            >
              &gt;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="font-bold text-base-content/40 py-0.5 select-none">{d}</div>
            ))}
            {days.map((day, i) => {
              if (day === null) return <div key={i} />;
              
              const dateStr = `${year}-${month}-${day}`;
              const targetMsgId = messageDates[dateStr];
              const hasMessage = !!targetMsgId;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!hasMessage}
                  onClick={() => targetMsgId && scrollToMessage(targetMsgId)}
                  className={`py-1 rounded-md transition-all font-semibold
                    ${hasMessage 
                      ? "bg-primary/20 text-primary hover:bg-primary/30 hover:scale-105 cursor-pointer font-bold border border-primary/20" 
                      : "text-base-content/30 disabled:opacity-50 pointer-events-none"
                    }
                  `}
                  title={hasMessage ? "Click to view chat history from this day" : ""}
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

const DateSeparator = ({ date }) => (
  <div className="flex items-center gap-3 my-3 select-none px-2">
    <div className="flex-1 h-px bg-base-300/50" />
    <span className="text-[10px] font-medium text-base-content/40 bg-base-200/50 px-3 py-1 rounded-full whitespace-nowrap">
      {getDateLabel(date)}
    </span>
    <div className="flex-1 h-px bg-base-300/50" />
  </div>
);

// Tiny heavily blurred Cloudinary derivative, used as a placeholder while the
// full image downloads so the bubble keeps its size instead of jumping.
const blurPlaceholder = (url) => {
  if (typeof url !== "string" || !url.includes("/upload/")) return null;
  return url.replace("/upload/", "/upload/w_24,e_blur:1200,q_10,f_auto/");
};

const SmoothImage = ({ src, alt, className, onClick }) => {
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
      onLoad={() => setIsLoaded(true)}
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
    isSelectionMode,
    selectedMessageIds,
    toggleMessageSelection,
    setSelectionMode,
    viewOneViewMessage,
    forwardingMessage,
    setForwardingMessage,
  } = useChatStore();

  const {
    selectedGroup,
    groupMessages,
    isGroupMessagesLoading,
  } = useGroupStore();

  const { authUser, onlineUsers } = useAuthStore();
  const { theme, wallpaper, privacyReadReceipts } = useThemeStore();

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
  const [swipe, setSwipe] = useState({ id: null, dx: 0 });

  const SWIPE_REPLY_THRESHOLD = 60;

  const buzz = (pattern) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Haptics are best effort.
    }
  };

  const handleBubbleTouchStart = (message, e) => {
    if (isSelectionMode) return;
    if (e.target.closest(".mobile-action-bar")) return;

    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, id: message._id };

    longPressTimerRef.current = setTimeout(() => {
      setMobileEmojiId(message._id);
      // Group message selection isn't wired to a backend action yet, so
      // scope the WhatsApp-style header toolbar to DMs for now.
      if (!selectedGroup) {
        setSelectionMode(true);
        toggleMessageSelection(message._id);
      }
      buzz(15);
      longPressTimerRef.current = null;
    }, 450);
  };

  const handleBubbleTouchMove = (message, e) => {
    if (isSelectionMode) return;
    const start = touchStartRef.current;
    if (!start || start.id !== message._id) return;

    const touch = e.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Only track a mostly-horizontal drag so vertical scrolling stays untouched.
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 10) {
      const clamped = Math.max(-90, Math.min(90, dx));
      setSwipe({ id: message._id, dx: clamped });
      start.swiping = true;
    }
  };

  const handleBubbleTouchEnd = (message, e) => {
    if (isSelectionMode) return;
    if (e.target.closest(".mobile-action-bar")) return;

    const start = touchStartRef.current;
    touchStartRef.current = null;
    const swiped = start?.swiping && Math.abs(swipe.dx) >= SWIPE_REPLY_THRESHOLD;
    setSwipe({ id: null, dx: 0 });

    if (swiped) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setReplyingToMessage(message);
      suppressClickRef.current = Date.now();
      buzz(25);
      return;
    }
    if (start?.swiping) return;

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
        buzz([15, 40, 15]);
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
      
      element.classList.add("bg-primary/20", "rounded-lg");
      setTimeout(() => {
        element.classList.remove("bg-primary/20", "rounded-lg");
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
        setLightboxImage(message.image);
        if (!isSender || selectedUser?._id === authUser?._id) {
          viewOneViewMessage(message._id);
        }
      };

      if (isViewed) {
        return (
          <div className="flex items-center gap-2 px-3 py-2 bg-base-200/50 text-base-content/40 border border-base-300/30 rounded-lg max-w-[140px] select-none text-left">
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
                className={`w-full object-cover cursor-zoom-in hover:opacity-95 transition-opacity rounded ${
                  message.images.length === 3 && i === 0 ? "col-span-2 h-36 sm:h-44" : "h-28 sm:h-36"
                }`}
              />
            ))}
          </div>
        ) : message.image ? (
          <SmoothImage
            src={message.image}
            alt="Attachment"
            onClick={() => setLightboxImage(message.image)}
            className="sm:max-w-[180px] rounded-md mb-1.5 cursor-zoom-in hover:opacity-95 transition-opacity"
          />
        ) : null}
        {message.voice && <VoiceNote src={message.voice} />}
        {message.text && (
          <div className="text-sm leading-loose break-words pr-10 select-text">
            <p>{highlightText(message.text, messageSearchQuery)}</p>
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
          if (myReaction) {
            toggleReaction(message._id, myReaction.emoji);
          }
        }}
        className={`absolute bottom-[-8px] right-[-4px] flex items-center gap-1 bg-base-200 border border-base-300 rounded-full px-1.5 py-0.5 shadow-sm text-[10px] select-none z-10 text-base-content font-medium cursor-pointer hover:bg-base-300 transition-colors ${myReaction ? "border-primary/50" : ""}`}
        title={myReaction ? "Click to remove reaction" : ""}
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

  // Selection mode can end from ChatHeader's toolbar (back button, or an
  // action that exits it) — drop the emoji row too so it doesn't linger.
  useEffect(() => {
    if (!isSelectionMode) setMobileEmojiId(null);
  }, [isSelectionMode]);

  useEffect(() => {
    prevMessagesLengthRef.current = 0;
    lastMessageIdRef.current = null;
    prevScrollHeightRef.current = 0;
    prevScrollTopRef.current = 0;
    isPrependingRef.current = false;
  }, [selectedUser?._id, selectedGroup?._id]);

  const handleScroll = async () => {
    const container = scrollableRef.current;
    if (!container || selectedGroup) return; // groups don't support pagination yet

    if (container.scrollTop === 0 && !isPrependingRef.current && selectedUser?._id) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingRef.current = true;
      await loadMoreMessages(selectedUser._id);
    }
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
    const latestReplyFromReceiver = Array.isArray(messages)
      ? messages.filter((m) => m.senderId === receiverId).pop()
      : null;
    if (latestReplyFromReceiver && new Date(latestReplyFromReceiver.createdAt).getTime() > messageTime) {
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
  }, [activeMessages]);

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
            className="bg-base-200/90 hover:bg-base-200 border-b border-base-300 px-4 py-2 flex items-center justify-between cursor-pointer transition-colors z-30 shadow-sm text-left animate-in slide-in-from-top duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Pin size={14} className="text-amber-500 flex-shrink-0 fill-amber-500/20" />
              <div className="text-xs min-w-0">
                <span className="font-semibold text-amber-500 block text-[10px] uppercase tracking-wider">
                  Pinned Message
                </span>
                <p className="text-base-content/80 truncate font-medium max-w-[200px] sm:max-w-[400px]">
                  {pinnedMessage.text || (pinnedMessage.image || pinnedMessage.images?.length ? "📷 Photo" : pinnedMessage.voice ? "🎙️ Voice Message" : "Message")}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePinMessage(pinnedMessage._id);
              }}
              className="p-1 hover:bg-base-300 rounded-full transition-colors text-base-content/50 hover:text-red-500"
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
              <span className="loading loading-spinner loading-md text-primary/60"></span>
            </div>
          ) : (
            Array.isArray(activeMessages) && activeMessages.flatMap((message, index) => {
              const isNewDay = index === 0 ||
                new Date(activeMessages[index - 1].createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();

              if (message.isCallLog) {
                return [
                  isNewDay && <DateSeparator key={`sep-${message._id}`} date={message.createdAt} />,
                  <div key={message._id} className="flex justify-center my-3 select-none w-full animate-in fade-in duration-200">
                    <div className="bg-base-200/80 border border-base-300 rounded-full px-4 py-1.5 flex items-center gap-2 text-xs text-base-content/75 font-medium shadow-sm">
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
                isNewDay && <DateSeparator key={`sep-${message.tempId || message._id}-d`} date={message.createdAt} />,
                <div key={message.tempId || message._id} className="flex items-center gap-2 w-full group relative px-2">
                  {isSelectionMode && !message.isCallLog && (
                    <input 
                      type="checkbox" 
                      checked={selectedMessageIds.includes(message._id)}
                      onChange={() => toggleMessageSelection(message._id)}
                      className="checkbox checkbox-primary checkbox-sm border-base-content/30 select-none mr-2 cursor-pointer z-20"
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
                    style={swipe.id === message._id ? {
                      transform: `translateX(${swipe.dx}px)`,
                    } : undefined}
                    className={`flex flex-col py-2 px-2.5 chat-bubble relative min-w-[72px] pr-12 transition-colors duration-300 select-none cursor-default ${message.reactions?.length > 0 ? "pb-4" : "pb-3"} ${isSelectionMode ? "cursor-pointer hover:bg-base-200/20" : ""} ${swipe.id === message._id ? "" : "transition-transform"}`}
                  >
                  {swipe.id === message._id && Math.abs(swipe.dx) >= 20 && (
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 ${swipe.dx > 0 ? "-left-8" : "-right-8"} ${
                        Math.abs(swipe.dx) >= SWIPE_REPLY_THRESHOLD ? "text-primary" : "text-base-content/30"
                      }`}
                    >
                      <CornerUpLeft size={16} />
                    </span>
                  )}
                  {/* Group Message Sender Name Label */}
                  {selectedGroup && (message.senderId?._id || message.senderId) !== authUser._id && (
                    <span className="text-[11px] font-bold text-primary block mb-0.5 select-none">
                      {message.senderId?.fullName || "Member"}
                    </span>
                  )}

                  {/* Reply Quote Display */}
                  {message.replyTo && (
                    <div 
                      onClick={() => scrollToMessage(message.replyTo._id)}
                      className="bg-black/15 dark:bg-white/10 border-l-4 border-primary px-2.5 py-1.5 rounded-r-md text-left mb-2 text-xs cursor-pointer select-none transition-all hover:bg-black/20 dark:hover:bg-white/15"
                    >
                      <span className="text-[10px] font-bold text-primary block mb-0.5">
                        {message.replyTo.senderId === authUser._id ? "You" : displayNameOf(selectedUser, nicknames)}
                      </span>
                      <p className="truncate opacity-80 text-base-content/90 max-w-[200px] sm:max-w-[300px]">
                        {message.replyTo.text || (message.replyTo.image || message.replyTo.images?.length ? "📷 Photo" : message.replyTo.voice ? "🎙️ Voice Message" : "Message")}
                      </p>
                    </div>
                  )}

                  {/* ── Mobile: emoji bar — long press (inline near message) ── */}
                  {mobileEmojiId === message._id && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="mobile-action-bar absolute right-0 top-[-44px] lg:hidden animate-in zoom-in-95 duration-150 flex items-center bg-base-100 border border-base-300 rounded-full px-3 py-1.5 shadow-xl z-30 gap-2"
                    >
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                        <button 
                          key={emoji} 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleReaction(message._id, emoji);
                            setMobileEmojiId(null);
                            if (isSelectionMode) setSelectionMode(false);
                          }}
                          className="text-xl active:scale-125 transition-transform p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Desktop: full hover bar (emojis + actions) ── */}
                  {!isSelectionMode && (
                    <div className="absolute right-0 top-[-30px] opacity-0 group-hover:opacity-100 transition-all duration-200 hidden lg:flex items-center bg-base-200 border border-base-300 rounded-full px-2 py-1 shadow-md z-10 gap-1.5 pointer-events-auto">
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(message._id, emoji)} className="hover:scale-125 transition-transform duration-100 text-sm">
                          {emoji}
                        </button>
                      ))}
                      <div className="w-[1px] h-3 bg-base-300 mx-1" />
                      <button onClick={() => setReplyingToMessage(message)} className="text-base-content/60 hover:text-primary transition-colors flex items-center" title="Reply"><CornerUpLeft size={13} /></button>
                      {!message.isDeletedForEveryone && (<button onClick={(e) => { e.stopPropagation(); setForwardingMessage(message); }} className="text-base-content/60 hover:text-primary transition-colors flex items-center" title="Forward"><Forward size={13} /></button>)}
                      {message.senderId === authUser?._id && !message.isDeletedForEveryone && message.text && (Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000) && (<button onClick={() => setEditingMessage(message)} className="text-base-content/60 hover:text-primary transition-colors flex items-center" title="Edit"><Pencil size={13} /></button>)}
                      {!message.isDeletedForEveryone && (<button onClick={() => togglePinMessage(message._id)} className={`transition-colors flex items-center ${message.isPinned ? "text-amber-500 hover:text-amber-600" : "text-base-content/60 hover:text-amber-500"}`} title={message.isPinned ? "Unpin" : "Pin"}><Pin size={13} /></button>)}
                      {!message.isDeletedForEveryone && (
                        <div className="dropdown dropdown-bottom dropdown-end flex items-center">
                          <div tabIndex={0} role="button" className="text-base-content/60 hover:text-red-500 transition-colors flex items-center p-0.5 cursor-pointer" title="Delete"><Trash2 size={13} /></div>
                          <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow-xl bg-base-100 border border-base-300 rounded-box w-36 text-xs text-base-content mt-1">
                            <li><button onClick={() => deleteMessage(message._id, "me")} className="hover:bg-base-200 py-1.5 text-left font-medium">Delete for me</button></li>
                            {message.senderId === authUser._id && (<li><button onClick={() => deleteMessage(message._id, "everyone")} className="hover:bg-red-500 hover:text-white py-1.5 text-left font-medium text-red-500">Delete for everyone</button></li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {message.isDeletedForEveryone ? (
                    <p className="text-xs italic text-base-content/40 flex items-center gap-1 select-none py-1 pr-14">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      This message was deleted
                    </p>
                  ) : (
                    <>
                      {/* Forwarded label */}
                      {message.isForwarded && (
                        <span className="flex items-center gap-1 text-[9px] font-medium text-base-content/45 mb-1 select-none">
                          <Forward size={9} className="opacity-60" />
                          Forwarded
                        </span>
                      )}
                      {/* Message Content & Media */}
                      {renderMessageContent(message)}
                    </>
                  )}
                  
                    <span className="absolute right-1 bottom-1 inline-flex items-center gap-0.5 text-[9px] opacity-95 select-none">
                    {message.scheduledAt ? (
                      <span className="inline-flex items-center gap-0.5 bg-amber-500/8 border border-amber-500/15 text-amber-600 px-1 py-[2px] rounded-md text-[9px] font-medium truncate">
                        <Clock size={10} />
                        <span className="whitespace-nowrap">{formatScheduledShort(message.scheduledAt)}</span>
                      </span>
                    ) : (
                      <span className={`${((message.senderId?._id || message.senderId) === authUser._id) ? 'bg-[#1f2937]/20 text-white/85' : 'bg-transparent text-base-content/60'} inline-flex items-center gap-0.5 px-1 py-[2px] rounded-md text-[9px]`}>{formatMessageTime(message.createdAt)}</span>
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
              className="p-1.5 hover:bg-base-200 rounded-full transition-colors text-base-content/60 hover:text-base-content"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Cover banner + center avatar & name */}
            <div className="-mx-5 -mt-5">
              <div className="relative w-full h-24 overflow-hidden bg-gradient-to-r from-primary/25 via-secondary/20 to-accent/25">
                {selectedUser.bannerPic && (
                  <img
                    src={selectedUser.bannerPic}
                    alt=""
                    onClick={() => setLightboxImage(selectedUser.bannerPic)}
                    className="object-cover w-full h-full cursor-zoom-in hover:opacity-90 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-base-100 via-base-100/10 to-transparent" />
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
                <span className="text-xs text-base-content/50 select-all">{selectedUser.email}</span>
                <div className="mt-2.5">
                  <SocialLinksRow user={selectedUser} variant="icons" emptyText="" />
                </div>
              </div>
            </div>

            {/* Media, links and docs gallery section (WhatsApp Desktop style) */}
            {(() => {
              const mediaMessages = Array.isArray(messages) ? messages.filter((m) => m.image && !m.isDeletedForEveryone) : [];
              return (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-base-content/80 flex items-center gap-1.5 select-none">
                      <Image size={14} className="text-primary" />
                      Media, links and docs
                    </span>
                    <span className="text-xs text-base-content/50 font-medium select-none">
                      {mediaMessages.length}
                    </span>
                  </div>
                  {mediaMessages.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {mediaMessages.slice(-8).reverse().map((msg) => (
                        <div 
                          key={msg._id}
                          onClick={() => setLightboxImage(msg.image)}
                          className="aspect-square rounded-xl overflow-hidden bg-base-200 cursor-zoom-in group relative hover:opacity-90 transition-all"
                        >
                          <img 
                            src={msg.image} 
                            alt="Shared media" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" 
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-base-200 p-3 rounded-xl text-center">
                      <p className="text-xs text-base-content/40 italic">No media shared yet</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <MessageCalendar messages={messages} scrollToMessage={scrollToMessage} />

            {/* Bio info */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <FileText size={12} />
                Bio
              </span>
              <p className="text-sm bg-base-200 p-3.5 rounded-2xl text-base-content/80 whitespace-pre-wrap leading-relaxed">
                {selectedUser.bio || <span className="text-zinc-500 italic">No bio added yet</span>}
              </p>
            </div>

            {/* Links website */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <Globe size={12} />
                Website / Social Link
              </span>
              <div className="text-sm bg-base-200 p-3.5 rounded-2xl text-base-content/80 truncate">
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
                  className="w-full h-11 px-3 rounded-2xl bg-base-200 border-0 text-xs text-base-content outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                  value={authUser?.disappearingTimers?.[selectedUser._id] || "off"}
                  onChange={(e) => setDisappearingTimer(selectedUser._id, e.target.value)}
                >
                  <option value="off">Off (Keep messages)</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                </select>
              </div>
            )}

            {/* Meta details */}
            <div className="pt-5 space-y-3 text-xs text-base-content/60">
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>Joined: {selectedUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-green-500" />
                <span className="text-green-500 font-medium">Encryption: End-to-End Encrypted</span>
              </div>
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
    </div>
  );
};
export default ChatContainer;