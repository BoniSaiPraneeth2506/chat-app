import { useEffect, useState } from "react";
import { ChevronDown, Clock, X } from "lucide-react";
import axiosInstance from "../lib/axios";
import { formatMessageTime } from "../lib/utils";

const UnreadSummaryPill = ({ groupId, unreadCount = 0 }) => {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setOpen(false);
    setSummary(null);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || unreadCount < 15) return;
    let active = true;
    axiosInstance
      .get("/messages/unread-summary", { params: { groupId } })
      .then((res) => {
        if (active) setSummary(res.data || { bullets: [], unreadCount });
      })
      .catch(() => {
        if (active) setSummary({ bullets: [], unreadCount });
      });
    return () => {
      active = false;
    };
  }, [groupId, unreadCount]);

  if (!groupId || unreadCount < 15) return null;

  const bullets = Array.isArray(summary?.bullets) ? summary.bullets : [];
  const headline = summary?.summary;

  return (
    <div className="relative z-20 flex justify-center py-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11.5px] font-semibold text-primary"
      >
        <span>{unreadCount} unread · catch up</span>
        <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-[min(92vw,360px)] rounded-2xl border border-base-300 bg-base-100 p-3 shadow-2xl cg-dialog">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-base-content">Catch up</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-full hover:bg-base-200"
              aria-label="Close unread summary"
            >
              <X size={15} />
            </button>
          </div>
          {!summary ? (
            <div className="py-5 flex justify-center">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : (
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
              {headline && (
                <div className="rounded-xl bg-primary/10 px-3 py-2 text-[12px] text-base-content/80 leading-snug">
                  {headline}
                </div>
              )}
              {bullets.length === 0 ? (
                <p className="py-2 text-center text-xs t-dim">No highlights available.</p>
              ) : (
                bullets.map((bullet, index) => (
                  <div key={bullet._id || index} className="rounded-xl border border-base-300 s-chip px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-primary">
                        <Clock size={11} />
                      </span>
                      <span className="text-[11px] font-semibold text-base-content truncate">
                        {bullet.senderName || bullet.author || "Member"}
                      </span>
                      {bullet.createdAt && (
                        <span className="ml-auto text-[9px] t-dim shrink-0">{formatMessageTime(bullet.createdAt)}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-snug t-muted line-clamp-2">
                      {bullet.text || bullet.preview || bullet.summary || "Message"}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnreadSummaryPill;
