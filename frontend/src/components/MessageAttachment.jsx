import { useState } from "react";
import { Play, FileText, Download, Loader, AlertCircle, X } from "lucide-react";
import { fetchAttachmentUrl, formatBytes, isLiveObjectUrl } from "../lib/attachments";

/**
 * One bucket-backed attachment inside a bubble.
 *
 * The bucket is private, so nothing here has a URL until it is asked for. That is
 * deliberate rather than awkward: a conversation full of videos would otherwise
 * mean signing a URL for every one of them on every render, and each signed URL is
 * a temporary grant that would be sitting in the page whether or not anyone
 * pressed play.
 *
 * So a video shows its poster and fetches on play; a document fetches on tap. An
 * image is the one exception — it has nothing to show until it loads, so it
 * resolves as soon as it appears.
 */

const DOC_LABELS = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/zip": "ZIP",
  "text/plain": "TXT",
  "text/csv": "CSV",
};

const MessageAttachment = ({ messageId, attachment, onOpenImage, progress, onCancel }) => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // The file being sent from this device is read straight off the disk. Checked
  // against the live set rather than trusted: this value is written onto the
  // confirmed message and therefore into the offline cache, where a blob: URL from
  // a previous session no longer resolves.
  const local = isLiveObjectUrl(attachment.localUrl) ? attachment.localUrl : "";
  const isUploading = typeof progress === "number";

  const resolve = async () => {
    if (local) return local;
    if (url) return url;
    setIsLoading(true);
    setError("");
    try {
      const next = await fetchAttachmentUrl(messageId, attachment.key);
      if (!next) throw new Error("No link");
      setUrl(next);
      return next;
    } catch (err) {
      setError(err.response?.data?.message || "Could not open that file");
      return "";
    } finally {
      setIsLoading(false);
    }
  };

  const uploadOverlay = isUploading ? (
    <>
      <span className="absolute inset-0 bg-black/35" />
      {onCancel && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 rounded-full size-11 place-items-center left-1/2 top-1/2 bg-black/55 text-white"
          title="Cancel"
        >
          <X size={18} />
        </span>
      )}
      <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/25">
        <span
          className="block h-full transition-all duration-200 bg-white"
          style={{ width: `${progress}%` }}
        />
      </span>
      <span className="absolute top-1.5 right-2 text-[10px] font-semibold text-white/95 tabular-nums">
        {progress}%
      </span>
    </>
  ) : null;

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-1.5 rounded-xl s-chip">
        <AlertCircle size={14} className="text-error shrink-0" />
        <span className="text-[11.5px] t-muted">{error}</span>
      </div>
    );
  }

  // ── Video ────────────────────────────────────────────────────────────────
  if (attachment.kind === "video") {
    if (isUploading) {
      return (
        <span className="relative block mb-1.5 w-[220px] sm:w-[280px] overflow-hidden rounded-xl bg-black">
          {attachment.posterUrl ? (
            <img
              src={attachment.posterUrl}
              alt=""
              className="object-cover w-full aspect-video opacity-80"
            />
          ) : (
            <video
              src={local || undefined}
              muted
              playsInline
              preload="metadata"
              className="w-full aspect-video object-cover opacity-80"
            />
          )}
          {uploadOverlay}
        </span>
      );
    }
    if (local || url) {
      return (
        <video
          src={local || url}
          controls
          autoPlay={!local}
          playsInline
          poster={attachment.posterUrl || undefined}
          preload="metadata"
          className="mb-1.5 max-w-[260px] sm:max-w-[320px] max-h-[320px] rounded-xl bg-black"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={resolve}
        className="relative mb-1.5 w-[220px] sm:w-[280px] overflow-hidden rounded-xl bg-black/60 aspect-video grid place-items-center active:scale-[0.98] transition-transform"
      >
        {attachment.posterUrl ? (
          <img
            src={attachment.posterUrl}
            alt={attachment.name || "Video"}
            className="absolute inset-0 object-cover w-full h-full opacity-80"
          />
        ) : local ? (
          // No captured frame — an older message, or a capture that failed. The
          // local file can still supply one.
          <video
            src={local}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 object-cover w-full h-full opacity-80"
          />
        ) : null}
        <span className="relative grid rounded-full size-12 place-items-center bg-black/55 text-white">
          {isLoading ? <Loader size={18} className="animate-spin" /> : <Play size={20} />}
        </span>
        <span className="absolute bottom-2 right-2.5 text-[10.5px] text-white/90">
          {formatBytes(attachment.size)}
        </span>
      </button>
    );
  }

  // ── Large image ──────────────────────────────────────────────────────────
  if (attachment.kind === "image") {
    if (!local && !url && !isLoading) resolve();
    const shown = local || url;
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && shown && onOpenImage?.(shown)}
        className="relative block mb-1.5 overflow-hidden rounded-xl bg-base-200 max-w-[220px] sm:max-w-[280px]"
        style={{ aspectRatio: attachment.width && attachment.height ? `${attachment.width}/${attachment.height}` : undefined }}
      >
        {shown ? (
          <img src={shown} alt={attachment.name || "Image"} className="object-cover w-full h-full" />
        ) : (
          <span className="grid w-[220px] sm:w-[280px] aspect-square place-items-center">
            <Loader size={16} className="animate-spin t-dim" />
          </span>
        )}
        {uploadOverlay}
      </span>
    );
  }

  // ── Document ─────────────────────────────────────────────────────────────
  const label = DOC_LABELS[attachment.mime] || "FILE";

  // A document has nothing to preview, so its progress runs under the row.
  if (isUploading) {
    return (
      <span className="block px-3 py-2.5 mb-1.5 rounded-xl s-chip max-w-[260px]">
        <span className="flex items-center gap-3">
          <span className="grid rounded-lg size-10 place-items-center s-tile shrink-0">
            <FileText size={17} className="text-primary" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-medium truncate text-base-content">
              {attachment.name || "Document"}
            </span>
            <span className="block text-[10.5px] mt-0.5 t-dim">
              {formatBytes(attachment.size)} · {progress}%
            </span>
          </span>
          {onCancel && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="icon-btn grid size-7 shrink-0 place-items-center rounded-full"
              title="Cancel"
            >
              <X size={13} />
            </span>
          )}
        </span>
        <span className="block h-1 mt-2 overflow-hidden rounded-full bg-base-300">
          <span
            className="block h-full transition-all duration-200 rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        const next = await resolve();
        // Opened rather than navigated to: this bubble sits inside a conversation
        // the reader is still in, and the signed link is short-lived either way.
        if (next) window.open(next, "_blank", "noopener,noreferrer");
      }}
      className="flex items-center gap-3 px-3 py-2.5 mb-1.5 rounded-xl s-chip max-w-[260px] text-left active:scale-[0.98] transition-transform"
    >
      <span className="relative grid rounded-lg size-10 place-items-center s-tile shrink-0">
        <FileText size={17} className="text-primary" />
        <span className="absolute -bottom-1 text-[8px] font-bold tracking-wide text-primary">
          {label}
        </span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-medium truncate text-base-content">
          {attachment.name || "Document"}
        </span>
        <span className="block text-[10.5px] mt-0.5 t-dim">
          {formatBytes(attachment.size)} · {label}
        </span>
      </span>
      {isLoading ? (
        <Loader size={14} className="animate-spin t-dim shrink-0" />
      ) : (
        <Download size={14} className="t-dim shrink-0" />
      )}
    </button>
  );
};

export default MessageAttachment;
