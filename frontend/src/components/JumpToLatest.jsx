import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown } from "lucide-react";

// Jump-to-latest floating button with unread pill (Feature 6).
// Reads the chat's own scroll state (isNearBottomRef) - no parallel scroll system.
// Pill shows how many messages landed while the user was scrolled up reading
// older history; tapping the button returns to the newest message and clears it.

export default function JumpToLatest({ scrollableRef, isNearBottomRef, messages = [] }) {
  const [show, setShow] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomIdRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const near = isNearBottomRef.current;
    if (near) {
      if (bottomIdRef.current !== last._id) {
        bottomIdRef.current = last._id;
        setUnread(0);
      }
      setShow(false);
    } else {
      setShow(true);
      if (bottomIdRef.current) {
        const idx = messages.findIndex((m) => m._id === bottomIdRef.current);
        const arrived = idx === -1 ? 0 : messages.length - 1 - idx;
        setUnread(arrived > 0 ? arrived : 0);
      }
    }
  }, [messages, isNearBottomRef]);

  useEffect(() => {
    if (Array.isArray(messages) && messages.length > 0 && bottomIdRef.current === null) {
      bottomIdRef.current = messages[messages.length - 1]._id;
    }
  }, [messages]);

  const jump = useCallback(() => {
    const el = scrollableRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnread(0);
    if (messages.length > 0) bottomIdRef.current = messages[messages.length - 1]._id;
  }, [scrollableRef, messages]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={jump}
      title={unread > 0 ? "Jump to latest" : "Back to latest"}
      aria-label="Jump to latest message"
      className="jump-latest absolute z-20 right-3 bottom-[86px] flex items-center bg-primary text-primary-content rounded-full pl-1.5 pr-1.5 py-1.5 hover:scale-105 active:scale-95 transition-transform"
    >
      <span className="grid place-items-center relative">
        <ArrowDown size={16} strokeWidth={2.6} />
        {unread > 0 && (
          <span className="absolute -top-2.5 -right-2.5 min-w-4 h-4 px-0.5 grid place-items-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </span>
      {unread > 0 && (
        <span className="ml-1.5 pr-1 text-[12px] font-semibold leading-none">
          {unread === 1 ? "1 new" : `${unread} new`}
        </span>
      )}
    </button>
  );
}