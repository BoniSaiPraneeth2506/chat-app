import { useEffect, useState, useRef } from "react";
import { useUpdatesStore } from "../store/useUpdatesStore";
import { useChatStore } from "../store/useChatStore";
import { useChannelStore } from "../store/useChannelStore";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneCall,
  Video,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { haptic } from "../lib/haptics";

const CALL_FILTERS = [
  { id: "all", label: "All calls" },
  { id: "missed", label: "Missed" },
  { id: "outgoing", label: "Outgoing" },
  { id: "incoming", label: "Incoming" },
  { id: "video", label: "Video" },
];

const matchesFilter = (call, filter) => {
  switch (filter) {
    case "missed":
      return call.callStatus === "missed" || call.callStatus === "declined";
    case "outgoing":
      return call.callStatus === "outgoing";
    case "incoming":
      return call.callStatus === "incoming";
    case "video":
      return call.callType === "video";
    case "all":
    default:
      return true;
  }
};

const CallIcon = ({ call }) => {
  const isVideo = call.callType === "video";

  if (call.callStatus === "missed" || call.callStatus === "declined") {
    return <PhoneMissed size={16} className="text-red-500" />;
  }
  if (call.callStatus === "outgoing" || (call.isOutgoing && call.callStatus === "completed")) {
    return isVideo ? (
      <Video size={16} className="text-green-500" />
    ) : (
      <PhoneOutgoing size={16} className="text-green-500" />
    );
  }
  if (call.callStatus === "incoming") {
    return isVideo ? (
      <Video size={16} className="text-primary" />
    ) : (
      <PhoneIncoming size={16} className="text-primary" />
    );
  }
  return call.isOutgoing ? (
    <PhoneOutgoing size={16} className="text-green-500" />
  ) : (
    <PhoneIncoming size={16} className="text-primary" />
  );
};

const CallsTab = () => {
  const { callHistory, isCallHistoryLoading, fetchCallHistory, setActiveTab } =
    useUpdatesStore();
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredCalls = callHistory.filter((c) => matchesFilter(c, filter));
  const activeFilterLabel =
    CALL_FILTERS.find((f) => f.id === filter)?.label || "All calls";

  const fmtDuration = (sec) => {
    if (!Number.isFinite(sec) || sec <= 0) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const callLabel = (call) => {
    switch (call.callStatus) {
      case "missed":
        return "Missed call";
      case "declined":
        return "Declined call";
      case "outgoing":
        return "Outgoing call";
      case "incoming":
        return "Incoming call";
      default:
        return call.isOutgoing ? "Outgoing call" : "Incoming call";
    }
  };

  const timeLabel = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  const callBack = (event, call) => {
    event.stopPropagation();
    const id = call.user?.idValue || call.user?._id;
    const users = useChatStore.getState().users;
    const target = users?.find((u) => String(u._id) === String(id)) || call.user;
    if (!target) return;
    haptic("tap");
    useChatStore.getState().callUser(target, call.callType === "video" ? "video" : "audio");
  };

  const openCallTarget = (call) => {
    haptic("tap");
    if (call.isGroup) {
      setActiveTab("chats");
      return;
    }
    if (call.user?.idType === "user" && call.user.idValue) {
      setActiveTab("chats");
      const users = useChatStore.getState().users;
      const found = users?.find((u) => String(u._id) === String(call.user.idValue));
      if (found) {
        useChannelStore.getState().closeChannel();
        setSelectedUser(found);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
      <div className="px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-base-content">Call history</h2>
          </div>

          <div className="relative" ref={filterRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                haptic("tap");
                setFilterOpen((o) => !o);
              }}
              className={`relative p-2 rounded-full transition-colors ${
                filter !== "all"
                  ? "bg-primary/15 text-primary"
                  : "text-base-content/60 hover:bg-base-200/70 hover:text-base-content"
              }`}
              aria-label="Filter calls"
            >
              <SlidersHorizontal size={18} />
              {filter !== "all" && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 z-30 rounded-2xl border border-base-300 bg-base-100 shadow-xl py-1.5">
                {CALL_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic("tap");
                      setFilter(f.id);
                      setFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      filter === f.id
                        ? "text-primary font-medium"
                        : "text-base-content/80 hover:bg-base-200/60"
                    }`}
                  >
                    {f.label}
                    {filter === f.id && <Check size={16} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isCallHistoryLoading ? (
        <div className="px-4 py-8 flex justify-center">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : filteredCalls.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-base-content/40">
            {filter !== "all"
              ? "No calls match this filter"
              : "No calls yet"}
          </p>
        </div>
      ) : (
        <div className="pb-4">
          {filteredCalls.map((call) => (
            <div
              key={call._id}
              role="button"
              tabIndex={0}
              onClick={() => openCallTarget(call)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openCallTarget(call);
              }}
              className="w-full py-3 px-4 flex items-center gap-3 hover:bg-base-200/60 transition-colors text-left cursor-pointer"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={call.user?.picture || "/avatar.png"}
                  alt={call.user?.name || "Unknown"}
                  className="size-11 rounded-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-base-content truncate">
                    {call.user?.name || "Unknown"}
                  </span>
                  {call.callDuration > 0 && (
                    <span className="shrink-0 text-[11px] tabular-nums text-base-content/50">
                      {fmtDuration(call.callDuration)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CallIcon call={call} />
                  <span
                    className={`min-w-0 flex-1 text-sm truncate ${
                      call.callStatus === "missed" || call.callStatus === "declined"
                        ? "text-red-500"
                        : "text-base-content/60"
                    }`}
                  >
                    {callLabel(call)}
                    {call.callType === "video" ? " · video" : " · voice"}
                  </span>
                </div>
              </div>
              <div className="w-14 -mr-1.5 md:-mr-3 shrink-0 self-end flex flex-col items-center gap-0.5">
                {!call.isGroup && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Call back"
                    aria-label="Call back"
                    onClick={(e) => callBack(e, call)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" || e.key === " ") callBack(e, call);
                    }}
                    className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                  >
                    <PhoneCall size={16} />
                  </span>
                )}
                <span
                  className="max-w-full text-[10px] leading-none t-dim truncate"
                  title={new Date(call.createdAt).toLocaleString()}
                >
                  {timeLabel(call.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallsTab;
