import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

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

const VoiceNote = ({ src }) => {
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

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        className="shrink-0 w-8 h-8 rounded-full vn-btn text-primary flex items-center justify-center hover:opacity-80 transition-opacity"
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          onClick={seek}
          className="relative flex items-end gap-[2px] h-7 cursor-pointer"
          role="presentation"
        >
          {bars.map((height, i) => (
            <span
              key={i}
              style={{ height: `${Math.round(height * 100)}%` }}
              className={`flex-1 rounded-full transition-colors ${
                i < playedBars ? "vn-fill" : "vn-track"
              } ${isPlaying && i === playedBars ? "animate-pulse" : ""}`}
            />
          ))}

          {/* Playhead. The filled bars alone read as progress only once you know
              to look for the colour change; a dot riding the track is what makes
              the position obvious at a glance, the way every messenger draws it. */}
          <span
            aria-hidden="true"
            style={{ left: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full vn-head ring-2 ring-base-100 pointer-events-none transition-[left] duration-150"
          />
        </div>
        <div className="flex items-center justify-between mt-0.5 text-[10px] vn-time">
          <span className="tabular-nums">
            {isPlaying || currentTime
              ? `${formatTime(currentTime)} / ${formatTime(duration)}`
              : formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="px-1.5 py-[1px] rounded-full vn-chip hover:opacity-80 font-semibold transition-opacity"
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
