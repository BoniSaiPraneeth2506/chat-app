import { useEffect, useState } from "react";
import {
  Image as ImageIcon,
  Video,
  Mic,
  Music,
  BarChart3,
  HelpCircle,
  Link2,
  MapPin,
  Timer,
  Type,
  Clock,
} from "lucide-react";
import axiosInstance from "../../lib/axios";

const TYPE_LABEL = {
  image: "Photo",
  video: "Video",
  text: "Text status",
  layout: "Status",
  voice: "Voice status",
  music: "Music",
  poll: "Poll",
  question: "Question",
  link: "Link",
  location: "Location",
  countdown: "Countdown",
};

const TYPE_ICON = {
  image: ImageIcon,
  video: Video,
  text: Type,
  layout: Type,
  voice: Mic,
  music: Music,
  poll: BarChart3,
  question: HelpCircle,
  link: Link2,
  location: MapPin,
  countdown: Timer,
};

/**
 * A reply written from inside the status viewer, shown in the chat as a
 * WhatsApp-style quoted card: a small status preview on top, the reply text
 * underneath. The bucket is private, so the thumbnail is signed on demand via
 * the status media grant; a status that has since expired (or is no longer
 * shared with the viewer) falls back to the type placeholder instead.
 */
const StatusReplyCard = ({ statusRef }) => {
  const [previewState, setPreviewState] = useState("loading");
  const [previewUrl, setPreviewUrl] = useState("");

  const type = statusRef.statusType || "image";
  const label = TYPE_LABEL[type] || "Status";
  const Icon = TYPE_ICON[type] || ImageIcon;
  const showImage = statusRef.mediaKey && String(statusRef.mediaContentType || "").startsWith("image/");

  useEffect(() => {
    let alive = true;
    if (!showImage) {
      setPreviewState("none");
      return () => { alive = false; };
    }
    setPreviewState("loading");
    axiosInstance
      .get(`/status/media/${statusRef.statusId}`)
      .then((res) => {
        if (!alive) return;
        const status = res.data?.status;
        const url =
          status?.media?.url ||
          (status?.mediaItems && status.mediaItems.length > 0 && status.mediaItems[0].url) ||
          status?.text?.mediaUrl ||
          "";
        setPreviewUrl(url);
        setPreviewState("ready");
      })
      .catch(() => {
        if (!alive) return;
        setPreviewState("expired");
      });
    return () => { alive = false; };
  }, [statusRef?.statusId, statusRef?.mediaKey, showImage]);

  return (
    <div className="flex items-stretch mb-2 rounded-l-md overflow-hidden bg-black/15 dark:bg-white/10 border-l-4 border-emerald-500 text-left select-none">
      <div className="relative grid place-items-center size-11 bg-base-200/80 shrink-0">
        {previewState === "ready" && previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : previewState === "expired" ? (
          <span className="flex flex-col items-center gap-0.5 text-base-content/45 px-1 text-center">
            <Clock size={14} />
            <span className="text-[8px] font-semibold leading-none">Expired</span>
          </span>
        ) : previewState === "loading" ? (
          <span className="size-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        ) : (
          <Icon size={18} className="text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      <div className="flex flex-col justify-center min-w-0 py-1 pr-3 pl-2.5">
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
          Reply to status
        </span>
        {statusRef.caption ? (
          <span className="text-[11.5px] opacity-80 leading-snug mt-1 truncate max-w-[180px] sm:max-w-[260px]">
            {statusRef.caption}
          </span>
        ) : (
          <span className="text-[10.5px] opacity-45 leading-snug mt-1">{label}</span>
        )}
      </div>
    </div>
  );
};

export default StatusReplyCard;