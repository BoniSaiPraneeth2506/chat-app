// ── Inline result of an AI action, rendered below the message bubble ───────
//
// Shows whatever the user asked for on a message: a translation, a script
// change, and/or a synthesized-audio player. Each section has an Undo (×) so
// the user can revert without going back into selection mode. State is kept in
// useAiStore keyed by message id.

import { Pause, Play, Volume2, X } from "lucide-react";
import { haptic } from "../../lib/haptics";
import { languageName } from "../../lib/sarvamApi";
import { useAiStore } from "../../store/useAiStore";
import { playAudio, stopAudio } from "../../lib/aiAudio";

const MessageAiPanel = ({ message }) => {
  const entry = useAiStore((s) => s.byMessage[message._id]);
  const clearTranslation = useAiStore((s) => s.clearTranslation);
  const clearTransliteration = useAiStore((s) => s.clearTransliteration);
  const setAudio = useAiStore((s) => s.setAudio);
  const clearAudio = useAiStore((s) => s.clearAudio);

  if (!entry) return null;
  const hasAny =
    entry.translatedText || entry.transliteratedText || entry.audioUrl;

  if (!hasAny) return null;

  const sourceName = (code) => {
    if (!code) return "";
    const n = languageName(code);
    return n && n !== code ? n : code;
  };

  const togglePlay = () => {
    haptic("tap");
    if (entry.audioPlaying) {
      stopAudio(message._id);
      setAudio(message._id, { audioPlaying: false });
    } else {
      setAudio(message._id, { audioPlaying: true });
      playAudio(
        message._id,
        entry.audioUrl,
        () => setAudio(message._id, { audioPlaying: false }),
        () => setAudio(message._id, { audioPlaying: false, audioUrl: null })
      );
    }
  };

  return (
    <div className="mt-1.5 space-y-1.5 select-none min-w-0">
      {entry.translatedText && (
        <div className="flex items-start gap-2 border-t border-base-300/40 pt-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium opacity-60 mb-0.5">
              {entry.translatedSource ? `Translated from ${sourceName(entry.translatedSource)}` : "Translated"}
            </div>
            <p className="text-[13px] leading-snug break-words whitespace-pre-wrap">
              {entry.translatedText}
            </p>
          </div>
          <button
            onClick={() => { haptic("tap"); clearTranslation(message._id); }}
            className="p-1 rounded-full hover:bg-base-200/60 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            title="Remove translation"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {entry.transliteratedText && (
        <div className="flex items-start gap-2 border-t border-base-300/40 pt-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium opacity-60 mb-0.5">
              {entry.transliteratedTarget ? `Script → ${languageName(entry.transliteratedTarget)}` : "Script changed"}
            </div>
            <p className="text-[13px] leading-snug break-words whitespace-pre-wrap">
              {entry.transliteratedText}
            </p>
          </div>
          <button
            onClick={() => { haptic("tap"); clearTransliteration(message._id); }}
            className="p-1 rounded-full hover:bg-base-200/60 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            title="Remove script change"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {entry.audioUrl && (
        <div className="flex items-center gap-2 border-t border-base-300/40 pt-1.5">
          <button
            onClick={togglePlay}
            className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
            title={entry.audioPlaying ? "Stop" : "Play"}
          >
            {entry.audioPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <span className="flex items-center gap-1.5 text-[11px] opacity-80">
            <Volume2 size={13} />
            AI voice
          </span>
          <button
            onClick={() => { haptic("tap"); stopAudio(message._id); clearAudio(message._id); }}
            className="ml-auto p-1 rounded-full hover:bg-base-200/60 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            title="Remove audio"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageAiPanel;
