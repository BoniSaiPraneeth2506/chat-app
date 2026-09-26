import { useState } from "react";
import { Plus, X, BarChart3 } from "lucide-react";
import StatusEditorShell, {
  useStatusEditor,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import { haptic } from "../../lib/haptics";

/**
 * A poll, 2–4 options.
 *
 * The option cap is not arbitrary. Past four, a phone-sized card cannot show
 * every option at a legible size, and the ones that get cut off are the ones
 * people wanted to pick. The server caps it too; this is here so the author
 * finds out before the audience does.
 */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

const BACKGROUNDS = [
  { id: "primary", css: "var(--color-primary)" },
  { id: "indigo", css: "linear-gradient(150deg, #4f46e5, #7c3aed)" },
  { id: "teal", css: "linear-gradient(150deg, #0d9488, #06b6d4)" },
  { id: "amber", css: "linear-gradient(150deg, #d97706, #f59e0b)" },
  { id: "rose", css: "linear-gradient(150deg, #e11d48, #f43f5e)" },
  { id: "slate", css: "linear-gradient(150deg, #1e293b, #334155)" },
];

const PollStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("poll");

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [background, setBackground] = useState(BACKGROUNDS[0].css);

  const updateOption = (index, value) => {
    haptic("tap");
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    haptic("tap");
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (index) => {
    if (options.length <= MIN_OPTIONS) return;
    haptic("tap");
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const filled = options.map((o) => o.trim()).filter(Boolean);

  const handlePost = async () => {
    if (filled.length < MIN_OPTIONS) return;
    editor.setPosting(true);
    editor.setProgress(0);
    try {
      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "poll",
          poll: {
            question: question.trim(),
            options: filled.map((text) => ({ text })),
            isClosed: false,
          },
          privacy: editor.privacy,
          scheduledFor: editor.scheduledFor,
          mentions: editor.mentions,
        },
        { onDone: editor.closeAll, draftMode: editor.mode }
      );
    } finally {
      editor.setPosting(false);
    }
  };

  const canPost = filled.length >= MIN_OPTIONS;

  return (
    <>
      <StatusEditorShell
        title="Poll"
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
        <div
          className="mx-4 mt-4 rounded-3xl p-5 min-h-[38vh] flex flex-col"
          style={{ background }}
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-white/70" />
            <span className="text-[11px] uppercase tracking-wide text-white/60">Poll</span>
          </div>

          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            placeholder="Ask a question..."
            className="field-flat w-full bg-transparent border-0 text-white placeholder-white/40 text-lg font-semibold mb-4 outline-none"
          />

          <div className="space-y-2 flex-1">
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="size-6 rounded-lg bg-white/15 text-white/80 grid place-items-center text-xs font-semibold flex-shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(i, e.target.value)}
                  maxLength={60}
                  placeholder={`Option ${i + 1}`}
                  className="field-flat flex-1 h-9 px-3 rounded-xl bg-white/12 border-0 text-sm text-white placeholder-white/35 outline-none"
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    onClick={() => removeOption(i)}
                    className="p-1.5 rounded-full text-white/50 hover:bg-white/15 hover:text-white transition-colors flex-shrink-0"
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < MAX_OPTIONS && (
            <button
              onClick={addOption}
              className="mt-3 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-xs font-medium text-white hover:bg-white/25 transition-colors"
            >
              <Plus size={13} />
              Add option
            </button>
          )}
        </div>

        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => {
                  haptic("tap");
                  setBackground(bg.css);
                }}
                className={`size-9 rounded-xl flex-shrink-0 border-2 transition-transform ${
                  background === bg.css ? "border-primary scale-105" : "border-transparent"
                }`}
                style={{ background: bg.css }}
                aria-label="Background"
              />
            ))}
          </div>
          <p className="text-[11px] text-base-content/40 text-center">
            {filled.length}/{MAX_OPTIONS} options · one answer each
          </p>
        </div>
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

export default PollStatusEditor;
