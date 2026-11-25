import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Send, X } from "lucide-react";
import { createLocalUrl, formatBytes, releaseLocalUrl } from "../lib/attachments";

const AttachmentPreviewModal = ({ files = [], onClose, onSend }) => {
  const list = useMemo(() => Array.from(files), [files]);
  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const file = list[index];

  const previewUrl = useMemo(() => {
    if (!file || file.type === "application/pdf" || file.type.startsWith("application/") || file.type.startsWith("text/")) return "";
    return createLocalUrl(file);
  }, [file]);

  useEffect(() => () => {
    if (previewUrl) releaseLocalUrl(previewUrl);
  }, [previewUrl]);

  if (!file) return null;

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onSend(list, caption);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-3xl bg-base-100 shadow-2xl cg-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="font-semibold text-base text-base-content">
            {list.length > 1 ? `${index + 1} of ${list.length}` : "Attach file"}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-base-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="rounded-2xl border border-base-300 bg-base-200/50 overflow-hidden grid place-items-center min-h-56">
            {file.type.startsWith("image/") && previewUrl ? (
              <img src={previewUrl} alt={file.name} className="max-h-[46vh] w-full object-contain" />
            ) : file.type.startsWith("video/") && previewUrl ? (
              <video src={previewUrl} controls playsInline className="max-h-[46vh] w-full bg-black" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-12">
                <span className="grid size-14 place-items-center rounded-2xl s-tile">
                  <FileText size={24} className="text-primary" />
                </span>
                <span className="text-sm font-medium text-base-content max-w-[260px] truncate">{file.name}</span>
                <span className="text-[11px] t-dim">{formatBytes(file.size)}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium truncate">{file.name}</span>
              <span className="block text-[10.5px] t-dim">{formatBytes(file.size)}</span>
            </span>
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => setIndex((current) => (current + 1) % list.length)}
                className="size-9 grid place-items-center rounded-full hover:bg-base-200"
                aria-label="Next file"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            rows={2}
            className="field-flat mt-3 w-full px-3 py-2 rounded-2xl bg-base-200 text-sm text-base-content resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-base-300">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full hover:bg-base-200 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-content text-sm font-semibold disabled:opacity-50"
          >
            <Send size={15} />
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttachmentPreviewModal;
