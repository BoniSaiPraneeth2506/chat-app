import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
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
 * An open question: one prompt, and answers only the author ever reads.
 *
 * There is deliberately no way to publish a question's answers and no way for a
 * viewer to see who answered. An answer to "how do you feel about…?" is often
 * something the person would not put under their name in public, so the audience
 * for answers is exactly one — and the server enforces the same rule, so this is
 * a UI decision rather than the security boundary.
 */
const BACKGROUNDS = [
  { id: "primary", css: "var(--color-primary)" },
  { id: "violet", css: "linear-gradient(150deg, #7c3aed, #c026d3)" },
  { id: "cyan", css: "linear-gradient(150deg, #0891b2, #22d3ee)" },
  { id: "green", css: "linear-gradient(150deg, #059669, #34d399)" },
  { id: "night", css: "linear-gradient(150deg, #111827, #374151)" },
];

const QuestionStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("question");
  const [prompt, setPrompt] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0].css);

  const handlePost = async () => {
    const text = prompt.trim();
    if (!text) return;
    editor.setPosting(true);
    editor.setProgress(0);
    try {
      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "question",
          question: { prompt: text, answers: [], answersVisibleToOwner: true },
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

  return (
    <>
      <StatusEditorShell
        title="Question"
        onClose={onClose}
        onDiscard={prompt.trim() ? editor.discardDraft : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={prompt.trim().length > 0}
        footerExtra={
          <>
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        <div className="mx-4 mt-4 rounded-3xl p-5 min-h-[34vh] flex flex-col" style={{ background }}>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircleQuestion size={16} className="text-white/70" />
            <span className="text-[11px] uppercase tracking-wide text-white/60">Ask me anything</span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={200}
            rows={4}
            placeholder="What would you like to be asked?"
            className="field-flat flex-1 w-full bg-transparent border-0 text-white placeholder-white/40 text-lg font-medium resize-none outline-none leading-snug"
          />

          <p className="text-[11px] text-white/55 mt-3 leading-relaxed">
            Only you can read the replies. Nobody else sees who answered or what they said.
          </p>
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
          <p className="text-[11px] text-base-content/40 text-center">{prompt.length}/200</p>
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

export default QuestionStatusEditor;
