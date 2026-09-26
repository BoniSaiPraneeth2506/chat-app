import { useEffect, useRef, useState } from "react";
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  ImagePlus,
  Smile,
  Bold,
  Italic,
  Palette,
  X,
  Check,
} from "lucide-react";
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
import EmojiPicker from "../EmojiPicker";
import { haptic } from "../../lib/haptics";

/**
 * A text status.
 *
 * Everything the author controls ends up as plain fields the viewer reads and
 * renders itself — font name, size, colours, alignment. Nothing is stored as
 * markup or a data URL. That is a deliberate constraint rather than a
 * limitation: a status is shown to people who did not choose to see it, so the
 * one thing that must be impossible is carrying script or an arbitrary
 * stylesheet into their viewer.
 */

// Only system font stacks. A "font" that could be a URL would be a remote
// stylesheet fetch on someone else's device.
const FONTS = [
  { id: "classic", label: "Classic", stack: "ui-sans-serif, system-ui, sans-serif" },
  { id: "serif", label: "Serif", stack: "ui-serif, Georgia, serif" },
  { id: "mono", label: "Mono", stack: "ui-monospace, SFMono-Regular, monospace" },
  { id: "rounded", label: "Rounded", stack: "ui-rounded, 'Segoe UI', system-ui, sans-serif" },
  { id: "condensed", label: "Condensed", stack: "'Arial Narrow', 'Helvetica Neue', sans-serif" },
];

const TEXT_COLORS = [
  "#ffffff",
  "#0b1b3a",
  "#e11d48",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

const BACKGROUNDS = [
  { id: "navy", label: "Navy", css: "#0b1b3a" },
  { id: "midnight", label: "Midnight", css: "linear-gradient(135deg, #0f2027, #2c5364)" },
  { id: "primary", label: "Primary", css: "var(--color-primary)" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(135deg, #f857a6, #ff5858)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(135deg, #2193b0, #6dd5ed)" },
  { id: "forest", label: "Forest", css: "linear-gradient(135deg, #134e5e, #71b280)" },
  { id: "grape", label: "Grape", css: "linear-gradient(135deg, #7f00ff, #e100ff)" },
  { id: "plain", label: "Plain", css: "#111827" },
];

const SIZES = [20, 26, 32, 40, 52, 64];

const ALIGNS = [
  { id: "left", icon: AlignLeft, label: "Left" },
  { id: "center", icon: AlignCenter, label: "Centre" },
  { id: "right", icon: AlignRight, label: "Right" },
];

const POSITIONS = [
  { id: "top", icon: AlignVerticalJustifyStart, label: "Top" },
  { id: "center", icon: AlignVerticalJustifyCenter, label: "Middle" },
  { id: "bottom", icon: AlignVerticalJustifyEnd, label: "Bottom" },
];

const EMPTY = {
  content: "",
  font: "classic",
  fontSize: 32,
  color: "#ffffff",
  backgroundColor: "#0b1b3a",
  backgroundGradient: "",
  align: "center",
  position: "center",
  emoji: "",
  mediaKey: "",
  mediaContentType: "",
  mediaUrl: "",
};

const TextStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("text", { summaryOf: (d) => d.text?.content });
  const [text, setText] = useState(EMPTY);
  const [showEmoji, setShowEmoji] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [restored, setRestored] = useState(false);
  const [panel, setPanel] = useState(null); // "font" | "color" | "background" | "size"
  const backgroundInputRef = useRef(null);
  const areaRef = useRef(null);

  // A saved draft is offered, not forced: reopening an editor should not silently
  // restore something the author may have moved on from.
  useEffect(() => {
    if (restored) return;
    import("../../lib/statusDrafts").then(({ getStatusDraft }) => {
      const draft = getStatusDraft("text");
      if (draft?.text?.content) {
        setText({ ...EMPTY, ...draft.text });
        toast("Draft restored", { icon: "📝" });
      }
      setRestored(true);
    });
  }, [restored]);

  // Releases the background photo's blob URL when it is replaced or when the
  // editor closes. Nothing here ever revokes a restored draft's URL, because a
  // draft is a plain string, not a blob this tab owns.
  useEffect(
    () => () => {
      if (text.mediaUrl) URL.revokeObjectURL(text.mediaUrl);
    },
    [text.mediaUrl]
  );

  const backgroundCss = text.backgroundGradient || text.backgroundColor;

  const handlePost = async () => {
    const content = text.content.trim();
    if (!content) return;
    editor.setPosting(true);
    editor.setProgress(0);

    try {
      const payload = {
        type: "text",
        caption: "",
        text: {
          content,
          font: text.font,
          fontSize: text.fontSize,
          color: text.color,
          backgroundColor: text.backgroundColor,
          backgroundGradient: text.backgroundGradient,
          align: text.align,
          position: text.position,
          emoji: text.emoji,
        },
        privacy: editor.privacy,
        scheduledFor: editor.scheduledFor,
        mentions: editor.mentions,
      };

      if (backgroundFile) {
        const metadata = await uploadStatusFile(backgroundFile, {
          onProgress: editor.setProgress,
        });
        payload.text.mediaKey = metadata.key;
        payload.text.mediaContentType = metadata.mime;
      }

      await postStatusWithFeedback(editor.createStatus, payload, {
        onDone: editor.closeAll,
        draftMode: editor.mode,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to post status");
    } finally {
      editor.setPosting(false);
    }
  };

  const saveDraft = () => {
    editor.saveDraft({ text }, { thumbnailFile: backgroundFile });
    toast.success("Draft saved on this device");
  };

  const pickBackground = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Background must be a photo");
      return;
    }
    haptic("tap");
    setBackgroundFile(file);
    // The effect below revokes the URL this replaces, so picking a second
    // background does not leave the first one's blob alive.
    setText((t) => ({ ...t, mediaUrl: URL.createObjectURL(file) }));
  };

  const fontStack = FONTS.find((f) => f.id === text.font)?.stack || FONTS[0].stack;

  const canPost = text.content.trim().length > 0;

  return (
    <>
      <StatusEditorShell
        title="Text status"
        onClose={onClose}
        onDiscard={canPost ? editor.discardDraft : null}
        onPost={handlePost}
        postLabel="Post"
        posting={editor.posting}
        progress={editor.progress}
        canPost={canPost}
        footerExtra={
          <>
            {canPost && (
              <button
                onClick={saveDraft}
                className="px-2.5 py-1.5 rounded-full text-xs font-medium text-base-content/50 hover:bg-base-200 transition-colors"
              >
                Save draft
              </button>
            )}
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        {/* The status as it will look. Full-bleed, because that is how it is
            shown — editing at sheet size would be editing a different thing. */}
        <div
          className="relative mx-4 my-4 rounded-2xl overflow-hidden min-h-[46vh] flex"
          style={{
            background: backgroundCss,
            alignItems:
              text.position === "top"
                ? "flex-start"
                : text.position === "bottom"
                ? "flex-end"
                : "center",
            padding: text.position === "top" ? "3rem 1.25rem" : "1.5rem 1.25rem",
          }}
        >
          {text.mediaUrl && (
            <img
              src={text.mediaUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {text.mediaUrl && (
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.35)" }}
            />
          )}

          <textarea
            ref={areaRef}
            value={text.content}
            onChange={(e) => setText((t) => ({ ...t, content: e.target.value }))}
            maxLength={500}
            placeholder="Type something..."
            rows={4}
            className="relative w-full bg-transparent border-0 outline-none resize-none text-center placeholder-white/40"
            style={{
              color: text.color,
              fontSize: Math.min(text.fontSize, 44),
              fontFamily: fontStack,
              textAlign: text.align,
              lineHeight: 1.25,
            }}
          />

          {text.emoji && (
            <div
              className="absolute top-4 right-4 text-4xl pointer-events-none"
              aria-hidden="true"
            >
              {text.emoji}
            </div>
          )}

          {backgroundFile && (
            <button
              onClick={() => {
                setBackgroundFile(null);
                setText((t) => ({ ...t, mediaUrl: "", mediaKey: "" }));
              }}
              className="absolute top-3 left-3 p-1.5 rounded-full bg-black/50 text-white"
              aria-label="Remove background"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Style controls */}
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <ToolChip active={panel === "font"} onClick={() => setPanel(panel === "font" ? null : "font")}>
              <Type size={15} />
              Font
            </ToolChip>
            <ToolChip active={panel === "size"} onClick={() => setPanel(panel === "size" ? null : "size")}>
              <Bold size={15} />
              Size
            </ToolChip>
            <ToolChip active={panel === "color"} onClick={() => setPanel(panel === "color" ? null : "color")}>
              <Palette size={15} />
              Text
            </ToolChip>
            <ToolChip
              active={panel === "background"}
              onClick={() => setPanel(panel === "background" ? null : "background")}
            >
              <Palette size={15} />
              Background
            </ToolChip>
            {ALIGNS.map((a) => {
              const Icon = a.icon;
              return (
                <ToolChip
                  key={a.id}
                  active={text.align === a.id}
                  onClick={() => setText((t) => ({ ...t, align: a.id }))}
                  label={a.label}
                >
                  <Icon size={15} />
                </ToolChip>
              );
            })}
            {POSITIONS.map((p) => {
              const Icon = p.icon;
              return (
                <ToolChip
                  key={p.id}
                  active={text.position === p.id}
                  onClick={() => setText((t) => ({ ...t, position: p.id }))}
                  label={p.label}
                >
                  <Icon size={15} />
                </ToolChip>
              );
            })}
            <ToolChip
              active={Boolean(text.mediaUrl)}
              onClick={() => backgroundInputRef.current?.click()}
              label="Background photo"
            >
              <ImagePlus size={15} />
            </ToolChip>
            <ToolChip active={showEmoji} onClick={() => setShowEmoji((s) => !s)} label="Emoji">
              <Smile size={15} />
            </ToolChip>
            <ToolChip
              active={false}
              onClick={() => {
                const next = text.font === "serif" ? "classic" : "serif";
                setText((t) => ({ ...t, font: next }));
              }}
              label="Italic style"
            >
              <Italic size={15} />
            </ToolChip>
          </div>

          {panel === "font" && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {FONTS.map((font) => (
                <button
                  key={font.id}
                  onClick={() => {
                    haptic("tap");
                    setText((t) => ({ ...t, font: font.id }));
                  }}
                  className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                    text.font === font.id
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 text-base-content/80 hover:bg-base-300"
                  }`}
                  style={{ fontFamily: font.stack }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}

          {panel === "size" && (
            <div className="flex items-center gap-1.5">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    haptic("tap");
                    setText((t) => ({ ...t, fontSize: size }));
                  }}
                  className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-colors ${
                    text.fontSize === size
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 text-base-content/70 hover:bg-base-300"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}

          {panel === "color" && (
            <div className="flex flex-wrap gap-2">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    haptic("tap");
                    setText((t) => ({ ...t, color }));
                  }}
                  className={`size-9 rounded-full border-2 transition-transform ${
                    text.color === color
                      ? "border-primary scale-110"
                      : "border-base-300"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Text colour ${color}`}
                />
              ))}
            </div>
          )}

          {panel === "background" && (
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((bg) => {
                const isGradient = bg.css.startsWith("linear");
                const active = isGradient
                  ? text.backgroundGradient === bg.css
                  : !text.backgroundGradient && text.backgroundColor === bg.css;
                return (
                  <button
                    key={bg.id}
                    onClick={() => {
                      haptic("tap");
                      if (isGradient) {
                        setText((t) => ({ ...t, backgroundGradient: bg.css, backgroundColor: "#0b1b3a" }));
                      } else {
                        setText((t) => ({ ...t, backgroundGradient: "", backgroundColor: bg.css }));
                      }
                    }}
                    className={`size-10 rounded-xl border-2 transition-transform ${
                      active ? "border-primary scale-105" : "border-base-300"
                    }`}
                    style={{ background: bg.css }}
                    aria-label={bg.label}
                  />
                );
              })}
            </div>
          )}

          {showEmoji && (
            <div className="rounded-2xl border border-base-200 overflow-hidden">
              <EmojiPicker
                onPick={(emoji) => {
                  setText((t) => ({ ...t, emoji: (t.emoji + emoji).slice(0, 8) }));
                  setShowEmoji(false);
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-base-content/40">
            <span>{text.content.length}/500</span>
            {text.emoji && (
              <button
                onClick={() => setText((t) => ({ ...t, emoji: "" }))}
                className="flex items-center gap-1 hover:text-base-content/70"
              >
                <Check size={11} />
                Clear emoji
              </button>
            )}
          </div>
        </div>

        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={pickBackground}
          className="hidden"
        />
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
    </>
  );
};

const ToolChip = ({ active, onClick, children, label }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
      active ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70 hover:bg-base-300"
    }`}
  >
    {children}
  </button>
);

export default TextStatusEditor;
