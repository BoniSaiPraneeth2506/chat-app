import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Bell, Flag, X } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import { formatRemaining } from "../../lib/statusFormat";
import { haptic } from "../../lib/haptics";

/**
 * A countdown to a moment in the future.
 *
 * The target is stored as an absolute instant, never as "in 3 hours". A duration
 * recorded on the device means a viewer whose clock is wrong — or a post that
 * gets restored from a draft days later — would see a countdown to a different
 * moment than the one everyone else sees. One timestamp, one meaning.
 */
const MIN_AHEAD_MS = 60 * 1000;
const MAX_AHEAD_DAYS = 365;

// Rounded offers rather than a free date field: these are the ones people set,
// and a scroll-to-the-year date picker on a phone is miserable to use.
const PRESETS = [
  { label: "In 1 hour", ms: 60 * 60 * 1000 },
  { label: "In 3 hours", ms: 3 * 60 * 60 * 1000 },
  { label: "Tomorrow", ms: 24 * 60 * 60 * 1000 },
  { label: "In a week", ms: 7 * 24 * 60 * 60 * 1000 },
];

const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const CountdownStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("countdown");

  const [title, setTitle] = useState("");
  const [targetAt, setTargetAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [preview, setPreview] = useState(true);
  const [error, setError] = useState("");

  const parsed = useMemo(() => new Date(targetAt), [targetAt]);
  const valid = !Number.isNaN(parsed.getTime());
  const ahead = valid ? parsed.getTime() - Date.now() : 0;
  const canPost = valid && ahead >= MIN_AHEAD_MS && ahead <= MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!valid) {
      setError("Pick a date and time");
    } else if (ahead < MIN_AHEAD_MS) {
      setError("Pick a time in the future");
    } else if (ahead > MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000) {
      setError("Pick a time within the next year");
    } else {
      setError("");
    }
  }, [valid, ahead]);

  const applyPreset = (ms) => {
    haptic("tap");
    setTargetAt(toLocalInput(new Date(Date.now() + ms)));
  };

  const handlePost = async () => {
    if (!canPost) return;
    editor.setPosting(true);
    editor.setProgress(0);
    try {
      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "countdown",
          countdown: { title: title.trim(), targetAt: parsed.toISOString() },
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
        title="Countdown"
        onClose={onClose}
        onDiscard={title.trim() || canPost ? editor.discardDraft : null}
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
        <div className="mx-4 mt-4 rounded-3xl p-6 min-h-[32vh] flex flex-col items-center justify-center text-center bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/70">
          <CalendarClock size={26} className="text-primary-content/80 mb-3" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="What's happening?"
            className="field-flat w-full bg-transparent border-0 text-lg font-semibold text-primary-content placeholder-primary-content/50 text-center outline-none"
          />
          {preview && (
            <p className="mt-4 text-3xl font-bold text-primary-content tabular-nums">
              {valid && ahead > 0 ? formatRemaining(ahead) : "--:--:--"}
            </p>
          )}
          <p className="mt-2 text-[11px] text-primary-content/70">
            {valid ? readableWhen(parsed) : "Pick a date and time"}
          </p>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.ms)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-base-200 text-xs font-medium text-base-content/75 hover:bg-base-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={targetAt}
              min={toLocalInput(new Date(Date.now() + MIN_AHEAD_MS))}
              max={toLocalInput(new Date(Date.now() + MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000))}
              onChange={(e) => setTargetAt(e.target.value)}
              className="field-flat flex-1 h-11 px-3 rounded-2xl bg-base-200 text-sm border-0"
            />
            <button
              onClick={() => setPreview((p) => !p)}
              className={`h-11 px-3 rounded-2xl text-xs font-medium transition-colors ${
                preview ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
              }`}
            >
              Live
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <p className="text-[11px] text-base-content/40 text-center leading-relaxed">
            Everyone watching sees the same moment, and the countdown keeps running on their own
            screen.
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

const readableWhen = (date) =>
  date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default CountdownStatusEditor;
