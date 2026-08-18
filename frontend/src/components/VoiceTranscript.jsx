import { useEffect, useRef, useState } from "react";
import { FileText, Loader, ChevronUp, ChevronDown, AlertTriangle, RotateCw } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { haptic } from "../lib/haptics";

// Transcript control for a voice note.
//
// Sits below <VoiceNote> rather than inside it, so playback, the waveform and the
// speed control are untouched by this feature.
//
// Two separate things, deliberately not conflated:
//
//   * whether a transcript EXISTS — server state, on the message, permanent
//   * whether it is currently SHOWN — local state, per rendered message
//
// Hiding therefore never deletes anything and never calls the service again; it
// only closes this one message's panel. Each instance owns its own `isOpen`, so
// opening one transcript leaves every other one alone.

const VoiceTranscript = ({ message }) => {
  const { requestTranscript } = useChatStore();

  const status = message?.transcript?.status || "not_requested";
  const text = message?.transcript?.text || "";

  const [isOpen, setIsOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const wasProcessing = useRef(false);

  // Opens itself the moment a transcript this component asked for arrives, but
  // only on that transition — otherwise every already-transcribed note would
  // spring open on mount, and a note the user had deliberately collapsed would
  // reopen on the next re-render.
  useEffect(() => {
    if (status === "processing") wasProcessing.current = true;
    if (status === "completed" && wasProcessing.current) {
      wasProcessing.current = false;
      setIsOpen(true);
    }
  }, [status]);

  const start = async () => {
    // Guarded on both sides: the server refuses a second job, and this stops the
    // pointless requests that four rapid taps would otherwise send.
    if (isRequesting || status === "processing") return;
    haptic("tap");
    setIsRequesting(true);
    wasProcessing.current = true;
    await requestTranscript(message._id);
    setIsRequesting(false);
  };

  const busy = isRequesting || status === "processing";

  const label = () => {
    if (busy) return "Transcribing…";
    if (status === "completed") return isOpen ? "Hide transcript" : "Show transcript";
    if (status === "failed") return "Couldn't transcribe";
    return "Transcript";
  };

  const Icon = () => {
    if (busy) return <Loader size={12} className="animate-spin" />;
    if (status === "completed") return isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
    if (status === "failed") return <AlertTriangle size={12} />;
    return <FileText size={12} />;
  };

  const onClick = () => {
    if (busy) return;
    if (status === "completed") {
      haptic("tap");
      setIsOpen((v) => !v); // UI only — the text stays saved either way
      return;
    }
    start(); // not_requested, or a retry after failure
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
          status === "failed" ? "text-error" : "t-dim hover:text-primary"
        } ${busy ? "cursor-default" : ""}`}
        title={status === "completed" && !isOpen ? "Show the saved transcript" : undefined}
      >
        <Icon />
        {label()}
      </button>

      {status === "failed" && (
        <button
          type="button"
          onClick={start}
          className="flex items-center gap-1 mt-1 text-[11px] font-medium text-primary hover:opacity-80 transition-opacity"
        >
          <RotateCw size={11} />
          Retry
        </button>
      )}

      {/* whitespace-pre-wrap keeps the service's line breaks and wraps long
          transcripts inside the bubble instead of stretching it. */}
      {status === "completed" && isOpen && (
        <p className="mt-1.5 px-2.5 py-2 rounded-lg s-chip text-[12.5px] leading-relaxed text-base-content whitespace-pre-wrap break-words max-w-[260px] sm:max-w-[300px]">
          {text || "No speech was detected."}
        </p>
      )}
    </div>
  );
};

export default VoiceTranscript;
