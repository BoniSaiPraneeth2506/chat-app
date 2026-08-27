import { useState, useRef, useCallback } from "react";
import { useStatusStore } from "../store/useStatusStore";
import useAuthStore from "../store/useAuthStore";
import { fetchUploadLimits, validateFile, uploadAttachment, kindFor, captureVideoPoster } from "../lib/attachments";
import { X, Image, Video, Send } from "lucide-react";
import toast from "react-hot-toast";
import { haptic } from "../lib/haptics";

const CreateStatusSheet = () => {
  const { isCreateOpen, setCreateOpen, createStatus } = useStatusStore();
  const authUser = useAuthStore((s) => s.authUser);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaType, setMediaType] = useState("");
  const fileRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPreview("");
    setCaption("");
    setMediaType("");
    setProgress(0);
    setUploading(false);
  };

  const handleClose = () => {
    reset();
    setCreateOpen(false);
  };

  const handleFileSelect = useCallback(async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const limits = await fetchUploadLimits();
    const validation = validateFile(selected, limits);
    if (!validation.valid) {
      toast.error(validation.reason);
      return;
    }

    const kind = kindFor(selected, limits);
    if (kind !== "image" && kind !== "video") {
      toast.error("Only images and videos can be posted as status");
      return;
    }

    setFile(selected);
    setMediaType(kind);
    const url = URL.createObjectURL(selected);
    setPreview(url);
    haptic("tap");
  }, []);

  const handlePost = async () => {
    if (!file || !authUser) return;
    setUploading(true);
    setProgress(0);

    try {
      const limits = await fetchUploadLimits();
      const kind = kindFor(file, limits);

      const metadata = await uploadAttachment({
        file,
        kind,
        onProgress: setProgress,
      });

      let duration = 0;
      if (kind === "video") {
        const videoEl = document.createElement("video");
        videoEl.src = URL.createObjectURL(file);
        await new Promise((resolve) => {
          videoEl.onloadedmetadata = () => {
            duration = videoEl.duration;
            resolve();
          };
          videoEl.onerror = resolve;
          setTimeout(resolve, 3000);
        });
      }

      await createStatus({
        key: metadata.key,
        type: kind,
        fileName: metadata.name,
        contentType: metadata.mime,
        size: metadata.size,
        duration,
        caption: caption.trim(),
      });

      haptic("success");
      toast.success("Status posted!");
      handleClose();
    } catch (err) {
      console.error("Error posting status:", err);
      toast.error("Failed to post status");
    } finally {
      setUploading(false);
    }
  };

  if (!isCreateOpen) return null;

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[1px] animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
          <h3 className="text-base font-semibold text-base-content">
            New Status
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-base-200 transition-colors"
          >
            <X size={18} className="text-base-content/60" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {!file ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    fileRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors"
                >
                  <Image size={28} className="text-primary" />
                  <span className="text-xs font-medium text-base-content/70">
                    Photo
                  </span>
                </button>
                <button
                  onClick={() => {
                    fileRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors"
                >
                  <Video size={28} className="text-primary" />
                  <span className="text-xs font-medium text-base-content/70">
                    Video
                  </span>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[50vh]">
                {mediaType === "video" ? (
                  <video
                    src={preview}
                    className="w-full h-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                )}
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview("");
                    setMediaType("");
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Caption */}
              <input
                type="text"
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
                className="field-flat w-full h-10 px-4 rounded-full bg-base-200 text-sm text-base-content ph-dim border-0"
              />

              {/* Upload progress */}
              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs t-dim">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Post button */}
              <button
                onClick={handlePost}
                disabled={uploading}
                className="w-full h-11 rounded-2xl bg-primary text-primary-content font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {uploading ? "Posting..." : "Post Status"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateStatusSheet;
