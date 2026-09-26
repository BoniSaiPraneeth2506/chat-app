import { useState, useCallback, useEffect, useRef } from "react";
import { Image, Video, X, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  uploadStatusFile,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import ImageEditorModal from "../ImageEditorModal";
import { haptic } from "../../lib/haptics";

/**
 * The original photo and video status, unchanged in behaviour.
 *
 * Kept as its own editor rather than folded into the new tools because it is the
 * path people already know: pick a file, add a caption, post. The only additions
 * are the audience, the schedule and the optional crop — all of which the server
 * already understands and none of which change what happens if you just post.
 */
const PhotoStatusEditor = ({ onClose, initialFile }) => {
  const editor = useStatusEditor("photo");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [caption, setCaption] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [croppedDataUrl, setCroppedDataUrl] = useState("");
  const fileRef = useRef(null);
  const previewRef = useRef("");

  /**
   * Validates a picked file and turns it into the editor's state.
   *
   * Shared by the picker and the file handed over from the Add Status sheet, so
   * a photo chosen from Camera is validated exactly like one chosen here.
   */
  const adopt = useCallback(async (selected) => {
    if (!selected) return;

    const { fetchUploadLimits, validateFile, kindFor } = await import("../../lib/attachments");
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

    haptic("tap");
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(selected);
    previewRef.current = url;
    setFile(selected);
    setMediaType(kind);
    setPreview(url);
    setCroppedDataUrl("");
  }, []);

  // A camera or gallery pick on the Add Status sheet arrives here as a prop,
  // because a File cannot live in a store.
  useEffect(() => {
    if (initialFile) adopt(initialFile);
  }, [initialFile, adopt]);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  const choose = useCallback(
    (e) => {
      const selected = e.target.files?.[0];
      e.target.value = "";
      adopt(selected);
    },
    [adopt]
  );

  const measureDuration = (source) =>
    new Promise((resolve) => {
      if (mediaType !== "video") {
        resolve(0);
        return;
      }
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(source);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Number.isFinite(video.duration) ? video.duration : 0);
      };
      video.onerror = () => resolve(0);
      setTimeout(() => resolve(0), 3000);
    });

  const handlePost = async () => {
    if (!file) return;
    editor.setPosting(true);
    editor.setProgress(0);

    try {
      // A crop turns the picked file into a new file; everything else uploads the
      // original bytes so a status keeps the quality it was shot at.
      const toUpload = croppedDataUrl
        ? await dataUrlToFile(croppedDataUrl, file.name)
        : file;

      const metadata = await uploadStatusFile(toUpload, {
        onProgress: editor.setProgress,
      });

      const duration = await measureDuration(toUpload);

      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: mediaType === "video" ? "video" : "image",
          key: metadata.key,
          fileName: metadata.name,
          contentType: metadata.mime,
          size: metadata.size,
          duration,
          caption: caption.trim(),
          privacy: editor.privacy,
          scheduledFor: editor.scheduledFor,
          mentions: editor.mentions,
        },
        { onDone: editor.closeAll, draftMode: editor.mode }
      );
    } catch (err) {
      toast.error(err?.message || "Failed to post status");
    } finally {
      editor.setPosting(false);
    }
  };

  const clearFile = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setFile(null);
    setPreview("");
    setMediaType("");
    setCroppedDataUrl("");
  };

  const header = (
    <>
      <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
      <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
    </>
  );

  return (
    <>
      <StatusEditorShell
        title={file ? "New Status" : "Photo or video"}
        onClose={onClose}
        onDiscard={file ? () => editor.discardDraft() : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={Boolean(file)}
        footerExtra={header}
      >
        {!file ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors"
              >
                <Image size={28} className="text-primary" />
                <span className="text-xs font-medium text-base-content/70">Photo</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors"
              >
                <Video size={28} className="text-primary" />
                <span className="text-xs font-medium text-base-content/70">Video</span>
              </button>
            </div>
            <p className="text-xs text-base-content/40 px-8 text-center">
              Or pick Layout to post several photos together
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[52vh]">
              {croppedDataUrl ? (
                <img src={croppedDataUrl} alt="Preview" className="w-full h-full object-contain" />
              ) : mediaType === "video" ? (
                <video src={preview} className="w-full h-full object-contain" autoPlay muted loop playsInline />
              ) : (
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              )}

              <button
                onClick={clearFile}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Remove"
              >
                <X size={14} />
              </button>

              {mediaType === "image" && (
                <button
                  onClick={() => setEditorOpen(true)}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-md hover:bg-black/75 transition-colors"
                >
                  <Wand2 size={13} />
                  Edit
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={300}
              className="field-flat w-full h-10 px-4 rounded-full bg-base-200 text-sm text-base-content ph-dim border-0"
            />
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={choose} className="hidden" />
      </StatusEditorShell>

      {editor.privacyOpen && (
        <PrivacySheet
          open
          onClose={() => editor.setPrivacyOpen(false)}
          privacy={editor.privacy}
          onChange={editor.setPrivacy}
        />
      )}
      {editor.scheduleOpen && (
        <ScheduleSheet
          open
          onClose={() => editor.setScheduleOpen(false)}
          scheduledFor={editor.scheduledFor}
          onChange={editor.setScheduledFor}
        />
      )}

      {editorOpen && preview && (
        <ImageEditorModal
          src={croppedDataUrl || preview}
          onCancel={() => setEditorOpen(false)}
          onSave={(dataUrl) => {
            setCroppedDataUrl(dataUrl);
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
};

const dataUrlToFile = async (dataUrl, name) => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const base = String(name || "photo.jpg").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: blob.type || "image/jpeg" });
};

export default PhotoStatusEditor;
