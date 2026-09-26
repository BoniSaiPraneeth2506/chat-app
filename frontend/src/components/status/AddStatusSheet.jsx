import { useEffect, useRef, useState } from "react";
import {
  X,
  Type,
  Music,
  LayoutGrid,
  Mic,
  BarChart3,
  HelpCircle,
  AtSign,
  Link2,
  MapPin,
  Timer,
  Image,
  Camera,
  Clock,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { useStatusStore } from "../../store/useStatusStore";
import { haptic } from "../../lib/haptics";
import { listStatusDrafts, deleteStatusDraft, onStatusDraftsChanged } from "../../lib/statusDrafts";
import PhotoStatusEditor from "./PhotoStatusEditor";
import TextStatusEditor from "./TextStatusEditor";
import VoiceStatusEditor from "./VoiceStatusEditor";
import LayoutStatusEditor from "./LayoutStatusEditor";
import MusicStatusEditor from "./MusicStatusEditor";
import PollStatusEditor from "./PollStatusEditor";
import QuestionStatusEditor from "./QuestionStatusEditor";
import MentionStatusEditor from "./MentionStatusEditor";
import LinkStatusEditor from "./LinkStatusEditor";
import LocationStatusEditor from "./LocationStatusEditor";
import CountdownStatusEditor from "./CountdownStatusEditor";

/**
 * The tools offered when someone taps "My Status".
 *
 * Each entry is a mode, and a mode is what an editor is asked for, what a draft
 * is filed under, and what the server is told the status `type` is. Keeping that
 * one string consistent is what stops "a layout" becoming three slightly
 * different concepts across the sheet, the store and the database.
 */
const TOOLS = [
  { mode: "text", label: "Text", icon: Type, tint: "text-primary" },
  { mode: "music", label: "Music", icon: Music, tint: "text-secondary" },
  { mode: "layout", label: "Layout", icon: LayoutGrid, tint: "text-accent" },
  { mode: "voice", label: "Voice", icon: Mic, tint: "text-secondary" },
  { mode: "poll", label: "Poll", icon: BarChart3, tint: "text-primary" },
  { mode: "question", label: "Question", icon: HelpCircle, tint: "text-accent" },
  { mode: "mention", label: "Mention", icon: AtSign, tint: "text-primary" },
  { mode: "link", label: "Link", icon: Link2, tint: "text-secondary" },
  { mode: "location", label: "Location", icon: MapPin, tint: "text-accent" },
  { mode: "countdown", label: "Countdown", icon: Timer, tint: "text-primary" },
];

const EDITORS = {
  photo: PhotoStatusEditor,
  text: TextStatusEditor,
  voice: VoiceStatusEditor,
  layout: LayoutStatusEditor,
  music: MusicStatusEditor,
  poll: PollStatusEditor,
  question: QuestionStatusEditor,
  mention: MentionStatusEditor,
  link: LinkStatusEditor,
  location: LocationStatusEditor,
  countdown: CountdownStatusEditor,
};

const AddStatusSheet = () => {
  const isCreateOpen = useStatusStore((s) => s.isCreateOpen);
  const createMode = useStatusStore((s) => s.createMode);
  const setCreateOpen = useStatusStore((s) => s.setCreateOpen);
  const setCreateMode = useStatusStore((s) => s.setCreateMode);
  const fetchStatusSettings = useStatusStore((s) => s.fetchStatusSettings);

  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  // The File a camera/gallery pick produced, handed to the photo editor.
  //
  // A File cannot be put in a store, and a URL is the wrong thing to pass (the
  // editor needs the bytes to upload, not something to show). So it is held here
  // and handed over as a prop on the render that follows.
  const [pickedFile, setPickedFile] = useState(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (isCreateOpen && !createMode) {
      fetchStatusSettings();
      setDrafts(listStatusDrafts());
    }
  }, [isCreateOpen, createMode, fetchStatusSettings]);

  // The draft list is written by editors on this device, so it has to be
  // re-read when one changes rather than snapshotted when the sheet opened.
  useEffect(() => onStatusDraftsChanged(() => setDrafts(listStatusDrafts())), []);

  // Leaving the sheet entirely clears the pending pick, so reopening it later
  // does not resurrect a photo from ten minutes ago.
  useEffect(() => {
    if (!isCreateOpen) setPickedFile(null);
  }, [isCreateOpen]);

  if (!isCreateOpen) return null;

  const ActiveEditor = createMode ? EDITORS[createMode] : null;

  const close = () => {
    setPickedFile(null);
    setCreateOpen(false);
  };

  const chooseTool = (mode) => {
    haptic("tap");
    setCreateMode(mode);
  };

  const openFilePicker = (inputRef) => {
    haptic("tap");
    inputRef.current?.click();
  };

  const handlePicked = (e) => {
    const file = e.target.files?.[0];
    // Cleared so re-picking the same file still fires a change event.
    e.target.value = "";
    if (!file) return;
    setPickedFile(file);
    setCreateMode("photo");
  };

  const discardDraft = (mode) => {
    deleteStatusDraft(mode);
    setDrafts(listStatusDrafts());
    haptic("tap");
  };

  // ── an editor is open ───────────────────────────────────────────────────────
  if (ActiveEditor) {
    return (
      <ActiveEditor
        onClose={() => {
          setPickedFile(null);
          setCreateMode(null);
        }}
        initialFile={createMode === "photo" ? pickedFile : null}
      />
    );
  }

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[1px] animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 flex-shrink-0">
          <h3 className="text-base font-semibold text-base-content">Add Status</h3>
          <button
            onClick={close}
            className="p-1 rounded-full hover:bg-base-200 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-base-content/60" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* Recent drafts, if any. They are this device's own, and never
              uploaded — a half-written status is private until posted. */}
          {drafts.length > 0 && !showDrafts && (
            <button
              onClick={() => {
                haptic("tap");
                setShowDrafts(true);
              }}
              className="w-full mb-4 flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-base-200/70 hover:bg-base-200 transition-colors text-left"
            >
              <Clock size={16} className="text-primary flex-shrink-0" />
              <span className="text-sm text-base-content flex-1">
                {drafts.length} draft{drafts.length > 1 ? "s" : ""}
              </span>
              <ChevronRight size={16} className="text-base-content/40" />
            </button>
          )}

          {showDrafts && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  Drafts on this device
                </h4>
                <button
                  onClick={() => setShowDrafts(false)}
                  className="text-xs text-primary font-medium"
                >
                  Hide
                </button>
              </div>
              <div className="space-y-2">
                {drafts.map((draft) => {
                  const tool = TOOLS.find((t) => t.mode === draft.mode);
                  const Icon = tool?.icon || Type;
                  return (
                    <div
                      key={draft.id}
                      className="flex items-center gap-3 p-2 rounded-2xl bg-base-200/60"
                    >
                      {draft.thumbnail ? (
                        <img
                          src={draft.thumbnail}
                          alt=""
                          className="size-10 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <span className="size-10 rounded-xl bg-base-300 grid place-items-center flex-shrink-0">
                          <Icon size={16} className="text-base-content/50" />
                        </span>
                      )}
                      <button
                        onClick={() => chooseTool(draft.mode)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="block text-sm font-medium text-base-content">
                          {tool?.label || "Draft"}
                        </span>
                        <span className="block text-[11px] text-base-content/50 truncate">
                          {draft.stale
                            ? "Older than a week"
                            : draft.summary || "Tap to continue"}
                        </span>
                      </button>
                      <button
                        onClick={() => discardDraft(draft.mode)}
                        className="p-2 rounded-full hover:bg-base-200 text-base-content/40 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Discard draft"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Camera / gallery — the original photo and video path, unchanged. */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => openFilePicker(cameraInputRef)}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors text-left"
            >
              <span className="size-10 rounded-xl bg-primary/12 text-primary grid place-items-center flex-shrink-0">
                <Camera size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-base-content">Camera</span>
                <span className="block text-[11px] text-base-content/50">Take a photo</span>
              </span>
            </button>

            <button
              onClick={() => openFilePicker(photoInputRef)}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors text-left"
            >
              <span className="size-10 rounded-xl bg-secondary/12 text-secondary grid place-items-center flex-shrink-0">
                <Image size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-base-content">Gallery</span>
                <span className="block text-[11px] text-base-content/50">Photo or video</span>
              </span>
            </button>
          </div>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-2.5">
            Status tools
          </h4>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.mode}
                  onClick={() => chooseTool(tool.mode)}
                  className="flex items-center gap-3 py-2.5 px-1.5 rounded-xl hover:bg-base-200/70 transition-colors text-left"
                >
                  <span className="size-9 rounded-xl bg-base-200 grid place-items-center flex-shrink-0">
                    <Icon size={17} className={tool.tint} />
                  </span>
                  <span className="text-sm font-medium text-base-content">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Camera and gallery inputs. The camera one carries `capture` so a
            phone offers the camera first, while still allowing a picked photo
            from the roll on a device that insists. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handlePicked}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePicked}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default AddStatusSheet;
