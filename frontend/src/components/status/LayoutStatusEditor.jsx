import { useCallback, useEffect, useRef, useState } from "react";
import { Images, Plus, X, Wand2, GripVertical } from "lucide-react";
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
 * The number of photos a layout can hold.
 *
 * A status is watched one screen at a time, so more than six turns the viewer
 * into a thumbnail grid and nobody reads it. The server enforces the same cap;
 * this is here so the picker stops you before the upload rather than after.
 */
const LAYOUTS = [
  { id: 2, label: "2 photos", slots: [[0, 0, 1, 1], [1, 0, 1, 1]] },
  { id: 3, label: "3 photos", slots: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
  { id: 4, label: "4 photos", slots: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
  { id: 6, label: "6 photos", slots: [
      [0, 0, 1, 1], [1, 0, 1, 1],
      [0, 1, 1, 1], [1, 1, 1, 1],
      [0, 2, 1, 1], [1, 2, 1, 1],
    ] },
];

const LayoutStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("layout");
  const [count, setCount] = useState(3);
  const [items, setItems] = useState([]); // { file, url, editedUrl }
  const [editingIndex, setEditingIndex] = useState(null);
  const [caption, setCaption] = useState("");
  const [dragging, setDragging] = useState(null);
  const inputRef = useRef(null);

  // Object URLs are ours to release: a layout holds up to six of them, and a
  // composer opened and abandoned a few times adds up. The live list is kept in
  // a ref so this runs on unmount only — revoking on every `items` change would
  // break the images still on screen.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        if (item?.url) URL.revokeObjectURL(item.url);
        if (item?.editedUrl) URL.revokeObjectURL(item.editedUrl);
      }
    },
    []
  );

  const pick = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length === 0) return;

      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        toast.error("Layouts use photos only");
        return;
      }

      haptic("tap");
      setItems((prev) => {
        const room = count - prev.length;
        if (room <= 0) return prev;
        const next = [
          ...prev,
          ...images.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) })),
        ];
        // Fewer photos than the chosen layout: drop to the nearest layout that
        // fits, so the preview never shows an empty grid the author did not ask
        // for.
        if (next.length < count) {
          const fitting = [...LAYOUTS].reverse().find((l) => l.id <= next.length);
          if (fitting) setCount(fitting.id);
        }
        return next;
      });
    },
    [count]
  );

  const removeAt = (index) => {
    haptic("tap");
    setItems((prev) => {
      const item = prev[index];
      if (item?.url) URL.revokeObjectURL(item.url);
      if (item?.editedUrl) URL.revokeObjectURL(item.editedUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const reorder = (from, to) => {
    if (from === to || to < 0 || to >= items.length) return;
    haptic("tap");
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handlePost = async () => {
    const filled = items.filter(Boolean);
    if (filled.length < 2) return;
    editor.setPosting(true);
    editor.setProgress(0);

    try {
      const uploaded = [];
      for (let i = 0; i < filled.length; i += 1) {
        const item = filled[i];
        const source = item.editedUrl
          ? await dataUrlToFile(item.editedUrl, item.file.name)
          : item.file;
        const metadata = await uploadStatusFile(source, {
          // Spread progress across the whole set, so the bar means something.
          onProgress: (p) => editor.setProgress(Math.round(((i + p / 100) / filled.length) * 100)),
        });
        uploaded.push({
          key: metadata.key,
          fileName: metadata.name,
          contentType: metadata.mime,
          size: metadata.size,
        });
      }

      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "layout",
          mediaItems: uploaded,
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

  const filled = items.filter(Boolean);
  const layout = LAYOUTS.find((l) => l.id === count) || LAYOUTS[1];
  const canPost = filled.length >= 2;

  return (
    <>
      <StatusEditorShell
        title="Layout"
        onClose={onClose}
        onDiscard={canPost ? editor.discardDraft : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={canPost}
        footerExtra={
          <>
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        {/* Layout picker */}
        <div className="px-4 pt-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {LAYOUTS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                haptic("tap");
                setCount(option.id);
                setItems((prev) => {
                  const kept = prev.slice(0, option.id);
                  // Choosing a smaller layout drops photos the author had already
                  // picked. Their blob URLs are ours to release — nothing else
                  // holds a reference, and a layout can be resized back and forth
                  // freely, so without this a few taps leaks every photo picked
                  // so far until the tab closes.
                  for (const dropped of prev.slice(option.id)) {
                    if (dropped?.url) URL.revokeObjectURL(dropped.url);
                    if (dropped?.editedUrl) URL.revokeObjectURL(dropped.editedUrl);
                  }
                  return kept;
                });
              }}
              className={`flex-shrink-0 w-[68px] rounded-xl p-1.5 border-2 transition-colors ${
                count === option.id ? "border-primary" : "border-transparent bg-base-200"
              }`}
            >
              <span
                className="grid gap-[2px] mb-1"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                {option.slots.map((_, i) => (
                  <span
                    key={i}
                    className={`aspect-square rounded-[3px] ${
                      items[i] ? "bg-primary/40" : "bg-base-300/70"
                    }`}
                  />
                ))}
              </span>
              <span className="block text-[10px] text-center text-base-content/60">
                {option.id}
              </span>
            </button>
          ))}
        </div>

        {/* Preview in the chosen grid */}
        <div className="px-4 py-2">
          <div
            className="relative mx-auto overflow-hidden rounded-2xl bg-black"
            style={{ maxWidth: "300px", aspectRatio: "9 / 16" }}
          >
            <div
              className="absolute inset-0 grid gap-0.5 p-0.5"
              style={{
                gridTemplateColumns: "repeat(2, 1fr)",
                gridTemplateRows: `repeat(${Math.ceil(count / 2)}, 1fr)`,
              }}
            >
              {Array.from({ length: count }).map((_, i) => {
                const item = items[i];
                return (
                  <div key={i} className="relative bg-base-300/40 overflow-hidden">
                    {item ? (
                      <>
                        <img
                          src={item.editedUrl || item.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeAt(i)}
                          className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white grid place-items-center"
                          aria-label={`Remove photo ${i + 1}`}
                        >
                          <X size={11} />
                        </button>
                        <button
                          onClick={() => setEditingIndex(i)}
                          className="absolute bottom-1 right-1 size-5 rounded-full bg-black/60 text-white grid place-items-center"
                          aria-label={`Edit photo ${i + 1}`}
                        >
                          <Wand2 size={11} />
                        </button>
                        <button
                          onClick={() => setDragging(i)}
                          className="absolute bottom-1 left-1 size-5 rounded-full bg-black/60 text-white grid place-items-center cursor-grab"
                          aria-label={`Reorder photo ${i + 1}`}
                        >
                          <GripVertical size={11} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => inputRef.current?.click()}
                        className="w-full h-full grid place-items-center text-base-content/30 hover:text-primary transition-colors"
                        aria-label="Add photo"
                      >
                        <Plus size={22} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reorder strip — tapping a handle then a target slot. Explicit on
            purpose: a drag on a phone this size is easy to misread as a swipe
            to the next status. */}
        {dragging !== null && (
          <div className="mx-4 mt-2 p-3 rounded-2xl bg-base-200">
            <p className="text-xs text-base-content/60 mb-2">
              Move photo {dragging + 1} to:
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {filled.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    reorder(dragging, i);
                    setDragging(null);
                  }}
                  className="size-9 rounded-xl bg-base-100 text-sm font-medium text-base-content hover:bg-primary hover:text-primary-content transition-colors"
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setDragging(null)}
                className="px-3 rounded-xl text-xs text-base-content/60 hover:text-base-content"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 h-10 rounded-xl bg-base-200 text-sm font-medium text-base-content flex items-center justify-center gap-2 hover:bg-base-300 transition-colors"
            >
              <Images size={15} />
              {filled.length ? "Add more photos" : `Choose ${count} photos`}
            </button>
            {canPost && (
              <button
                onClick={() => {
                  editor.saveDraft({}, { thumbnailFile: filled[0]?.file });
                  toast.success("Draft saved on this device");
                }}
                className="h-10 px-3 rounded-xl text-sm font-medium text-base-content/50 hover:bg-base-200 transition-colors"
              >
                Save draft
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

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={filled.length + 1 < count}
          onChange={pick}
          className="hidden"
        />
      </StatusEditorShell>

      {editingIndex !== null && items[editingIndex] && (
        <ImageEditorModal
          src={items[editingIndex].editedUrl || items[editingIndex].url}
          onCancel={() => setEditingIndex(null)}
          onSave={(dataUrl) => {
            setItems((prev) => {
              const next = [...prev];
              if (next[editingIndex]?.editedUrl) URL.revokeObjectURL(next[editingIndex].editedUrl);
              next[editingIndex] = { ...next[editingIndex], editedUrl: dataUrl };
              return next;
            });
            setEditingIndex(null);
          }}
        />
      )}

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
    </>
  );
};

const dataUrlToFile = async (dataUrl, name) => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const base = String(name || "photo.jpg").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: blob.type || "image/jpeg" });
};

export default LayoutStatusEditor;
