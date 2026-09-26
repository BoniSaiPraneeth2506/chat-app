import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Trash2, Play, Pause, ImagePlus, X } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  uploadStatusFile,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
  useMyUser,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import { haptic } from "../../lib/haptics";

const MAX_SECONDS = 60;
const MIN_SECONDS = 1;

/**
 * Picks a container that every browser can actually play.
 *
 * MediaRecorder's output type varies by platform — webm on Chrome and Android,
 * mp4 on Safari — and Safari will not play the webm it did not record. So the
 * first supported type is chosen explicitly, and the duration is read back from
 * the finished blob rather than trusted from a timer, because a recorder that
 * reports a length the file does not have produces a status that will not play.
 */
const pickMimeType = () => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  return "";
};

/**
 * A compact waveform, measured from the recorded clip.
 *
 * Real amplitudes rather than a decorative bar pattern: the author is looking at
 * this to decide whether they spoke clearly, and a fake waveform always looks
 * fine. Peaks are taken over fixed windows so the shape is stable regardless of
 * clip length.
 */
const buildWaveform = (audioBuffer, buckets = 48) => {
  const data = audioBuffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(data.length / buckets));
  const peaks = [];
  for (let i = 0; i < buckets; i += 1) {
    let peak = 0;
    const start = i * bucketSize;
    for (let j = 0; j < bucketSize; j += 1) {
      const value = Math.abs(data[start + j] || 0);
      if (value > peak) peak = value;
    }
    peaks.push(Number(peak.toFixed(3)));
  }
  const max = Math.max(...peaks, 0.01);
  return peaks.map((p) => Math.max(0.04, p / max));
};

const VoiceStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("voice");
  const authUser = useMyUser();

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null); // { blob, url, duration, waveform }
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const backgroundInputRef = useRef(null);

  useEffect(
    () => () => {
      stopEverything();
      if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    },
    [backgroundUrl]
  );

  const stopEverything = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Recording is not available on this device");
      return;
    }
    try {
      haptic("tap");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size === 0) {
          toast.error("Nothing was recorded");
          return;
        }
        const url = URL.createObjectURL(blob);
        const duration = await readDuration(url);
        const waveform = await readWaveform(url);
        setClip({ blob, url, duration, waveform });
        setSeconds(Math.round(duration));
        setPlayhead(0);
      };

      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            recorderRef.current?.stop();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Could not start recording:", err);
      toast.error(
        err?.name === "NotAllowedError"
          ? "Microphone permission is needed"
          : "Could not start recording"
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  };

  const discardClip = () => {
    if (clip?.url) URL.revokeObjectURL(clip.url);
    setClip(null);
    setPlaying(false);
    setPlayhead(0);
    setSeconds(0);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
      return;
    }
    audio.play();
    setPlaying(true);
    const tick = () => {
      if (!audioRef.current) return;
      setPlayhead(audioRef.current.currentTime);
      if (!audioRef.current.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePost = async () => {
    if (!clip) return;
    editor.setPosting(true);
    editor.setProgress(0);

    try {
      const extension = clip.blob.type.includes("mp4") ? "m4a" : clip.blob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([clip.blob], `voice-status.${extension}`, {
        type: clip.blob.type,
      });

      const metadata = await uploadStatusFile(file, { onProgress: editor.setProgress });

      const payload = {
        type: "voice",
        voice: {
          key: metadata.key,
          contentType: metadata.mime,
          size: metadata.size,
          duration: clip.duration,
          waveform: clip.waveform,
        },
        privacy: editor.privacy,
        scheduledFor: editor.scheduledFor,
        mentions: editor.mentions,
      };

      if (backgroundFile) {
        const bg = await uploadStatusFile(backgroundFile, {
          onProgress: editor.setProgress,
        });
        payload.voice.backgroundKey = bg.key;
        payload.voice.backgroundContentType = bg.mime;
      }

      await postStatusWithFeedback(editor.createStatus, payload, { onDone: editor.closeAll, draftMode: editor.mode });
    } catch (err) {
      toast.error(err?.message || "Failed to post status");
    } finally {
      editor.setPosting(false);
    }
  };

  const duration = clip?.duration || 0;
  const progress = duration > 0 ? (playhead / duration) * 100 : 0;

  return (
    <>
      <StatusEditorShell
        title="Voice status"
        onClose={onClose}
        onDiscard={clip ? editor.discardDraft : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={Boolean(clip) && duration >= MIN_SECONDS}
        footerExtra={
          <>
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        <div className="px-5 py-6 flex flex-col items-center">
          <div className="relative size-24 rounded-full bg-base-200 grid place-items-center mb-5">
            <img
              src={authUser?.profilePic || "/avatar.png"}
              alt=""
              className="absolute inset-0 size-24 rounded-full object-cover opacity-90"
            />
            {backgroundUrl && (
              <img
                src={backgroundUrl}
                alt=""
                className="absolute inset-0 size-24 rounded-full object-cover"
              />
            )}
            {recording && (
              <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-pulse" />
            )}
            <span className="relative z-10 text-2xl font-semibold text-white drop-shadow">
              {formatClock(recording ? seconds : Math.round(duration))}
            </span>
          </div>

          {/* Waveform — the recording's own amplitudes, or a flat line while
              idle so the space does not jump when recording starts. */}
          <div className="w-full flex items-center justify-center gap-[3px] h-16 mb-5">
            {(clip?.waveform?.length
              ? clip.waveform
              : Array.from({ length: 32 }, () => 0.08)
            ).map((peak, i) => {
              const passed = (i / (clip?.waveform?.length || 32)) * 100 <= progress;
              return (
                <span
                  key={i}
                  className={`w-[3px] rounded-full transition-colors ${
                    passed ? "bg-primary" : recording ? "bg-red-500/60" : "bg-base-300"
                  }`}
                  style={{ height: `${Math.max(6, peak * 56)}px` }}
                />
              );
            })}
          </div>

          {clip ? (
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="size-12 rounded-full bg-primary text-primary-content grid place-items-center hover:opacity-90 transition-opacity"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                onClick={discardClip}
                className="size-11 rounded-full bg-base-200 text-base-content/70 grid place-items-center hover:bg-red-500 hover:text-white transition-colors"
                aria-label="Delete recording"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={startRecording}
                className="size-11 rounded-full bg-base-200 text-base-content/70 grid place-items-center hover:bg-base-300 transition-colors"
                aria-label="Re-record"
              >
                <RotateCcw size={18} />
              </button>
              <button
                onClick={() => backgroundInputRef.current?.click()}
                className="size-11 rounded-full bg-base-200 text-base-content/70 grid place-items-center hover:bg-base-300 transition-colors"
                aria-label="Background photo"
              >
                <ImagePlus size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {recording ? (
                <button
                  onClick={stopRecording}
                  className="size-16 rounded-full bg-red-500 text-white grid place-items-center hover:opacity-90 transition-opacity"
                  aria-label="Stop recording"
                >
                  <Square size={24} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="size-16 rounded-full bg-primary text-primary-content grid place-items-center hover:opacity-90 transition-opacity"
                  aria-label="Record"
                >
                  <Mic size={26} />
                </button>
              )}
              <button
                onClick={() => backgroundInputRef.current?.click()}
                className="size-11 rounded-full bg-base-200 text-base-content/70 grid place-items-center hover:bg-base-300 transition-colors"
                aria-label="Background photo"
              >
                <ImagePlus size={18} />
              </button>
            </div>
          )}

          {backgroundFile && (
            <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-200 text-xs text-base-content/70">
              <span className="max-w-[180px] truncate">Background photo</span>
              <button
                onClick={() => setBackgroundFile(null)}
                className="hover:text-red-500"
                aria-label="Remove background"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <p className="mt-5 text-xs text-base-content/40 text-center px-6">
            {recording
              ? `Up to ${MAX_SECONDS} seconds`
              : clip
              ? "Listen back, re-record, or post"
              : "Tap to record a voice status"}
          </p>
        </div>

        {clip && <audio ref={audioRef} src={clip.url} onEnded={() => setPlaying(false)} className="hidden" />}

        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file?.type?.startsWith("image/")) return;
            if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
            setBackgroundFile(file);
            setBackgroundUrl(URL.createObjectURL(file));
          }}
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

const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Duration from the finished blob.
 *
 * A timer is not used for this: a recorder can be stopped between ticks, and a
 * status whose stored length disagrees with its file is one that will not play
 * to the end for the people watching it.
 */
const readDuration = (url) =>
  new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      audio.removeAttribute("src");
      resolve(value);
    };
    const timer = setTimeout(() => finish(0), 4000);
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      finish(0);
    };
    audio.src = url;
  });

/** Amplitudes for the waveform, decoded through the Web Audio API. */
const readWaveform = async (url) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return [];
    const context = new Ctx();
    const buffer = await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const peaks = buildWaveform(buffer);
    context.close?.();
    return peaks;
  } catch {
    // No waveform is a cosmetic loss, not a reason to refuse to post.
    return [];
  }
};

export default VoiceStatusEditor;
