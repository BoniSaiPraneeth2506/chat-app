import { useEffect, useState } from "react";
import {
  Loader,
  X,
  Image as ImageIcon,
  FileText,
  Link2,
  Mic,
  ExternalLink,
  Download,
  Play,
} from "lucide-react";
import axiosInstance from "../lib/axios";
import { fetchAttachmentUrl } from "../lib/attachments";
import { formatBytes } from "../lib/attachments";

/**
 * Everything shared in one conversation.
 *
 * The profile panel shows the eight most recent as a preview; this is what opens
 * behind it. Pages are requested as they are asked for rather than all at once —
 * a long conversation can hold hundreds of pictures, and loading them together
 * would stall the panel on open for the sake of tiles nobody has scrolled to.
 *
 * The same endpoint backs four tabs — Media, Docs, Links, Audio — each asking
 * for a different content kind. Tabs keep their own page counters so switching
 * never loses the scroll position of the one before.
 */

const PAGE = 60;

const TABS = [
  { id: "media", label: "Media", Icon: ImageIcon },
  { id: "docs", label: "Docs", Icon: FileText },
  { id: "links", label: "Links", Icon: Link2 },
  { id: "audio", label: "Audio", Icon: Mic },
];

const MediaGallerySheet = ({ userId, contactName, onClose, onOpenImage, initialTab = "media" }) => {
  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = async (from) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get(`/messages/media/${userId}`, {
        params: { limit: PAGE, skip: from, type: tab },
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
    // Reloads only when the conversation or the active tab changes; paging is
    // driven by the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab]);

  const openDocument = async (item) => {
    if (busyKey) return;
    setBusyKey(item._id);
    try {
      const url = await fetchAttachmentUrl(item.messageId, item.key);
      if (!url) throw new Error("no url");
      window.open(url, "_blank", "noopener");
    } catch {
      setError("This file is no longer available");
      setTimeout(() => setError(""), 2500);
    } finally {
      setBusyKey("");
    }
  };

  const emptyLabel =
    tab === "docs"
      ? "No documents shared here yet."
      : tab === "links"
      ? "No links shared here yet."
      : tab === "audio"
      ? "No voice messages shared here yet."
      : "Nothing has been shared in this chat yet.";

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

      {/* Tab bar */}
      <div className="flex items-center gap-2 px-3 pb-2.5 s-sep">
        {TABS.map((t) => {
          const Icon = t.Icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold rounded-full transition-colors select-none ${
                active
                  ? "bg-primary text-white"
                  : "s-chip text-base-content/70 hover:text-base-content"
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 px-3 py-3 overflow-y-auto">
        {error ? (
          <p className="px-8 py-16 text-[13.5px] leading-relaxed text-center t-muted">
            {error}
          </p>
        ) : items.length === 0 && isLoading ? (
          tab === "media" ? (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-lg aspect-square animate-pulse s-chip" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl s-chip" />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <p className="px-8 py-16 text-[13.5px] text-center t-muted">{emptyLabel}</p>
        ) : tab === "media" ? (
          <>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {items.map((item) =>
                item.kind === "video" ? (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => openDocument(item)}
                    title="Play video"
                    className="relative overflow-hidden transition-transform rounded-lg aspect-square bg-black active:scale-95 group"
                  >
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt="Shared video"
                        loading="lazy"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="w-full h-full grid place-items-center bg-base-200">
                        <Play size={16} className="text-base-content/50" />
                      </span>
                    )}
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid place-items-center size-8 rounded-full bg-black/55 backdrop-blur-sm text-white">
                        <Play size={15} className="ml-0.5" />
                      </span>
                    </span>
                  </button>
                ) : (
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
                )
              )}
            </div>
          </>
        ) : (
          <>
            {/* Docs / Links / Audio share the list layout */}
            <div className="flex flex-col divide-y divide-base-200">
              {items.map((item) => {
                if (tab === "docs") {
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => openDocument(item)}
                      className="flex items-center gap-3 py-3 px-1 text-left w-full transition-colors rounded-lg hover:bg-base-200/60"
                    >
                      <span className="grid rounded-xl size-11 place-items-center s-tile shrink-0">
                        <FileText size={18} className="text-sky-500" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium truncate text-base-content">
                          {item.name}
                        </span>
                        <span className="block text-[11.5px] t-dim">
                          {item.size ? formatBytes(item.size) : "File"} ·{" "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      {busyKey === item._id ? (
                        <Loader size={16} className="animate-spin text-base-content/40 shrink-0" />
                      ) : (
                        <ExternalLink
                          size={15}
                          className="text-base-content/40 shrink-0"
                        />
                      )}
                    </button>
                  );
                }
                if (tab === "links") {
                  const host = (() => {
                    try {
                      return new URL(item.url).hostname.replace(/^www\./, "");
                    } catch {
                      return item.url;
                    }
                  })();
                  return (
                    <a
                      key={item._id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 py-3 px-1 w-full transition-colors rounded-lg hover:bg-base-200/60"
                    >
                      <span className="grid rounded-xl size-11 place-items-center s-tile shrink-0">
                        <Link2 size={18} className="text-violet-500" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-[13.5px] font-medium truncate text-base-content">
                          {host}
                        </span>
                        <span className="block text-[11.5px] text-base-content/60 truncate">
                          {item.text || item.url}
                        </span>
                        <span className="block text-[11px] t-dim">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      <ExternalLink
                        size={15}
                        className="text-base-content/40 shrink-0"
                      />
                    </a>
                  );
                }
                // Audio
                return (
                  <div key={item._id} className="flex items-center gap-3 py-2.5 px-1 w-full">
                    <span className="grid rounded-xl size-11 place-items-center s-tile shrink-0">
                      <Mic size={17} className="text-amber-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <audio
                        controls
                        preload="metadata"
                        src={item.voice}
                        className="w-full h-9"
                      />
                      <span className="block text-[11px] t-dim mt-0.5">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

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
        {tab === "docs" && (
          <div className="mt-2 text-center text-[11px] t-dim">
            <Download size={11} className="inline -mt-0.5 mr-1" />
            Tapping a file signs a temporary link and opens it
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaGallerySheet;