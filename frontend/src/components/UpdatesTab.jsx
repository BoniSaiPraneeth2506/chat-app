import { useEffect } from "react";
import StatusRow from "./StatusRow";
import { useUpdatesStore } from "../store/useUpdatesStore";
import { useChatStore } from "../store/useChatStore";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import { haptic } from "../lib/haptics";

const CallIcon = ({ call }) => {
  const isVideo = call.callType === "video";

  // Color precedence: missed is the most urgent, then direction.
  if (call.callStatus === "missed") {
    return <PhoneMissed size={16} className="text-red-500" />;
  }
  if (isVideo) {
    return call.isOutgoing ? (
      <Video size={16} className="text-green-500" />
    ) : (
      <Video size={16} className="text-primary" />
    );
  }
  if (call.isOutgoing) {
    return <PhoneOutgoing size={16} className="text-green-500" />;
  }
  return <PhoneIncoming size={16} className="text-primary" />;
};

const CallHistoryList = () => {
  const { callHistory, isCallHistoryLoading, fetchCallHistory, setActiveTab } =
    useUpdatesStore();
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  const fmtDuration = (sec) => {
    if (!Number.isFinite(sec) || sec <= 0) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s} min`;
  };

  const callLabel = (call) => {
    if (call.callStatus === "missed") {
      return call.isOutgoing ? "Missed call" : "Missed call";
    }
    if (call.callType === "video") {
      return call.isOutgoing ? "Outgoing video call" : "Incoming video call";
    }
    return call.isOutgoing ? "Outgoing voice call" : "Incoming voice call";
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

  const openCallTarget = (call) => {
    haptic("tap");
    if (call.isGroup) {
      // Open group chat if we can via group store
      setActiveTab("chats");
      return;
    }
    if (call.user?.idType === "user" && call.user.idValue) {
      setActiveTab("chats");
      const users = useChatStore.getState().users;
      const found = users?.find((u) => String(u._id) === String(call.user.idValue));
      if (found) setSelectedUser(found);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
      <div className="px-4 py-3 flex-shrink-0">
        <h2 className="text-base font-semibold text-base-content">Updates</h2>
        <p className="text-xs text-base-content/50 mt-0.5">
          Statuses and call history
        </p>
      </div>

      <StatusRow />

      {/* Call history header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-base-content">Call History</h3>
      </div>

      {isCallHistoryLoading ? (
        <div className="px-4 py-8 flex justify-center">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : callHistory.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-base-content/40">No calls yet</p>
        </div>
      ) : (
        <div className="pb-4">
          {callHistory.map((call) => (
            <button
              key={call._id}
              onClick={() => openCallTarget(call)}
              className="w-full py-3 px-4 flex items-center gap-3 hover:bg-base-200/60 transition-colors text-left"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={call.user?.picture || "/avatar.png"}
                  alt={call.user?.name || "Unknown"}
                  className="size-11 rounded-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-base-content truncate">
                    {call.user?.name || "Unknown"}
                  </span>
                  <span className="text-xs t-dim flex-shrink-0 ml-2">
                    {timeLabel(call.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CallIcon call={call} />
                  <span
                    className={`text-sm truncate ${
                      call.callStatus === "missed"
                        ? "text-red-500"
                        : "text-base-content/60"
                    }`}
                  >
                    {callLabel(call)}
                    {call.callType === "video" ? " · video" : " · voice"}
                    {call.callStatus === "completed" && call.callDuration > 0
                      ? ` · ${fmtDuration(call.callDuration)}`
                      : ""}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallHistoryList;
