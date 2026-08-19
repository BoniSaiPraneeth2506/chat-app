import { useEffect, useRef, useState } from "react";
import { Loader, X } from "lucide-react";
import axiosInstance from "../lib/axios";

/**
 * The GIF and sticker picker.
 *
 * Opens from a slash command in the composer and floats above it, the same way
 * the mention picker does, so the conversation never moves to make room.
 *
 * The account is on GIPHY's free tier, so every request is worth avoiding: the
 * query is debounced rather than sent per keystroke, a search does not start until
 * there are two characters to search for, and the server answers repeated lookups
 * from its own cache. Switching between /giphy and /stickers with the same word
 * costs one request each and nothing after that.
 */

const DEBOUNCE_MS = 450;
const MIN_QUERY = 2;

const GifPicker = ({ kind, query, onPick, onClose }) => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendingId, setSendingId] = useState(null);

  // The request this component last cared about. A slow answer to an older query
  // must not paint over a newer one.
  const requestRef = useRef(0);

  const effectiveQuery = query.trim().length >= MIN_QUERY ? query.trim() : "";

  useEffect(() => {
    const token = ++requestRef.current;
    setError("");
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await axiosInstance.get("/giphy", {
          params: { type: kind, q: effectiveQuery },
        });
        if (requestRef.current !== token) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch (err) {
        if (requestRef.current !== token) return;
        setItems([]);
        setError(
          err.response?.data?.message ||
            "Could not load GIFs just now. Try again in a moment."
        );
      } finally {
        if (requestRef.current === token) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [kind, effectiveQuery]);

  const heading = effectiveQuery
    ? `${kind === "stickers" ? "Stickers" : "GIFs"} for “${effectiveQuery}”`
    : kind === "stickers"
    ? "Trending stickers"
    : "Trending GIFs";

  const handlePick = async (item) => {
    if (sendingId) return;
    setSendingId(item.id);
    try {
      await onPick(item);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mx-3 mb-2 overflow-hidden shadow-2xl rounded-2xl bg-base-100">
      <div className="flex items-center gap-2 px-3.5 py-2.5 s-sep border-b-0">
        <span className="flex-1 text-[12px] font-semibold truncate text-base-content">
          {heading}
        </span>
        {/* GIPHY asks for attribution wherever their results are shown. */}
        <span className="text-[9px] uppercase tracking-wider t-dim shrink-0">
          via GIPHY
        </span>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn grid size-6 shrink-0 place-items-center rounded-full"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      <div className="max-h-[230px] overflow-y-auto px-2 pb-2">
        {isLoading && items.length === 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg aspect-square animate-pulse s-chip" />
            ))}
          </div>
        ) : error ? (
          <p className="px-2 py-6 text-[12.5px] leading-relaxed text-center t-muted">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-[12.5px] text-center t-muted">
            {effectiveQuery
              ? `Nothing found for “${effectiveQuery}”`
              : "Nothing to show right now"}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePick(item)}
                title={item.title || "GIF"}
                className="relative overflow-hidden transition-transform rounded-lg aspect-square s-chip active:scale-95 disabled:opacity-60"
                disabled={Boolean(sendingId)}
              >
                <img
                  src={item.thumb}
                  alt={item.title || "GIF"}
                  loading="lazy"
                  className="object-cover w-full h-full"
                />
                {sendingId === item.id && (
                  <span className="absolute inset-0 grid place-items-center bg-black/45">
                    <Loader size={15} className="text-white animate-spin" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GifPicker;
