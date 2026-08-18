import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";

const BAR_COUNT = 34;
const SPEEDS = [1, 1.5, 2];

// Deterministic fallback shape so a note always looks the same between renders.
const fallbackBars = (src) => {
  let seed = 0;
  for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) % 100000;
  return Array.from({ length: BAR_COUNT }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return 0.25 + (seed % 1000) / 1000 * 0.75;
  });
};

// Downsamples the decoded PCM into BAR_COUNT peaks, normalised to 0..1.
const peaksFromBuffer = (buffer) => {
  const data = buffer.getChannelData(0);
  const block = Math.floor(data.length / BAR_COUNT) || 1;
  const peaks = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    let peak = 0;
    for (let j = 0; j < block; j++) {
      const value = Math.abs(data[i * block + j] || 0);
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0.0001);
  return peaks.map((p) => Math.max(0.12, p / max));
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const VoiceNote = ({ src, avatarUrl = "" }) => {
  const audioRef = useRef(null);
  const [bars, setBars] = useState(() => fallbackBars(src || ""));
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBars(fallbackBars(src || ""));

    const decode = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        ctx.close();
        if (!cancelled) setBars(peaksFromBuffer(buffer));
      } catch {
        // Cross-origin or unsupported codec: the fallback shape stays.
      }
    };

    if (src) decode();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.playbackRate = SPEEDS[speedIndex];
      audio.play();
    } else {
      audio.pause();
    }
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const playedBars = Math.round(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-2.5 py-1 pr-10 select-none max-w-[240px] sm:max-w-[280px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          setCurrentTime(audio.currentTime);
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setProgress(audio.currentTime / audio.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        className="hidden"
      />

      {/* Sender's photo with a mic badge, as WhatsApp draws it. Omitted rather
          than substituted when there is no avatar to show — an anonymous
          question passes none, and a placeholder face would undo that. */}
      {avatarUrl && (
        <div className="relative shrink-0">
          <img
            src={avatarUrl}
            alt=""
            aria-hidden="true"
            className="object-cover rounded-full size-9"
          />
          <span className="absolute grid rounded-full -bottom-0.5 -right-0.5 size-4 place-items-center vn-badge">
            <Mic size={9} className="text-primary" />
          </span>
        </div>
      )}

      {/* A bare triangle rather than a filled circle — the reference has no
          button chrome, and the icon alone is the affordance. */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        className="shrink-0 grid size-7 place-items-center text-primary hover:opacity-70 active:scale-95 transition-all"
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>

      <div className="flex-1 min-w-0">
        {/* The dot leads the waveform: played bars behind it, upcoming audio
            ahead. Height is generous enough to drag on a phone without the row
            growing, which is why the hit area is padded rather than taller. */}
        <div
          onClick={seek}
          className="flex items-center h-6 cursor-pointer"
          role="presentation"
        >
          {/* No playhead marker. A dot sitting on top of the bars read as
              clutter, and the colour split between played and upcoming bars
              already shows the position.

              Uniform 2px bars rather than flex-1: stretching each bar to fill
              made the spacing depend on the bar count, which is what looked
              uneven inside the bubble. */}
          <div className="flex items-center justify-between w-full h-4">
            {bars.map((height, i) => (
              <span
                key={i}
                style={{ height: `${Math.max(22, Math.round(height * 100))}%` }}
                className={`w-[2px] shrink-0 rounded-full transition-colors ${
                  i < playedBars ? "vn-fill" : "vn-track"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 text-[11px] vn-time">
          <span className="tabular-nums">
            {isPlaying || currentTime ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="px-1.5 py-[1px] rounded-full vn-chip hover:opacity-80 font-semibold transition-opacity tabular-nums"
            title="Playback speed"
          >
            {SPEEDS[speedIndex]}x
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceNote;
