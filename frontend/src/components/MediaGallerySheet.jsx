import { useEffect, useState } from "react";
import { Loader, X, Image as ImageIcon } from "lucide-react";
import axiosInstance from "../lib/axios";

/**
 * Everything shared in one conversation.
 *
 * The profile panel shows the eight most recent as a preview; this is what opens
 * behind it. Pages are requested as they are asked for rather than all at once —
 * a long conversation can hold hundreds of pictures, and loading them together
 * would stall the panel on open for the sake of tiles nobody has scrolled to.
 */

const PAGE = 60;

const MediaGallerySheet = ({ userId, contactName, onClose, onOpenImage }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (from) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get(`/messages/media/${userId}`, {
        params: { limit: PAGE, skip: from },
      });
      const page = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems((prev) => (from === 0 ? page : [...prev, ...page]));
      setTotal(Number(res.data?.total) || 0);
      setHasMore(Boolean(res.data?.hasMore));
      setSkip(from + PAGE);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the gallery");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // Reloads only when the conversation changes; paging is driven by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-base-100 cg-fade"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5 s-sep">
        <span className="grid rounded-xl size-9 place-items-center s-tile shrink-0">
          <ImageIcon size={16} className="text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15.5px] font-semibold truncate text-base-content">
            Shared media
          </h2>
          <p className="text-[12px] truncate t-dim">
            {total} {total === 1 ? "item" : "items"}
            {contactName ? ` · ${contactName}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn grid size-9 shrink-0 place-items-center rounded-full"
          aria-label="Close"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 min-h-0 px-3 py-3 overflow-y-auto">
        {error ? (
          <p className="px-8 py-16 text-[13.5px] leading-relaxed text-center t-muted">
            {error}
          </p>
        ) : items.length === 0 && isLoading ? (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-lg aspect-square animate-pulse s-chip" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-8 py-16 text-[13.5px] text-center t-muted">
            Nothing has been shared in this chat yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => onOpenImage(item.url)}
                  className="overflow-hidden transition-transform rounded-lg aspect-square bg-base-200 active:scale-95"
                >
                  <img
                    src={item.url}
                    alt="Shared media"
                    loading="lazy"
                    className="object-cover w-full h-full"
                  />
                </button>
              ))}
            </div>

            {hasMore && (
              <button
                type="button"
                onClick={() => load(skip)}
                disabled={isLoading}
                className="flex items-center justify-center w-full h-11 gap-2 mt-3 text-[13px] font-semibold rounded-2xl s-chip text-base-content disabled:opacity-50"
              >
                {isLoading && <Loader size={14} className="animate-spin" />}
                {isLoading ? "Loading" : "Show older"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MediaGallerySheet;
