import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  MessageCircleQuestion,
  Link2,
  MapPin,
  Timer,
  Music4,
  Play,
  Pause,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Send,
  Sparkles,
} from "lucide-react";
import {
  formatRemaining,
  fontStackOf,
  alignItemsOf,
  textAlignOf,
  mapUrlOf,
  clockOf,
  pollTotal,
  votedOptionOf,
  resolveStatusType,
} from "../../lib/statusFormat";

/**
 * Renders one status, whatever kind it is.
 *
 * Everything here is decided by the author's stored fields and by the signed URLs
 * the server has already granted. There is no per-type branching in the viewer
 * itself, because the viewer also owns the progress bar, the tap zones and the
 * keyboard — and those have to work identically for a photo and for a poll.
 *
 * The one rule that shapes all of it: nothing renders an author-supplied string
 * as markup, and nothing fetches a remote stylesheet or font. A status is
 * content the author chose and other people are shown, so every value here is
 * treated as a value.
 */

const Frame = ({ style, children, className = "" }) => (
  <div
    className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
    style={style}
  >
    {children}
  </div>
);

/** The card fill used by every type that has no photo of its own. */
const THEME = {
  text: "#0b1b3a",
  voice: "linear-gradient(150deg, #0f2027, #2c5364)",
  music: "linear-gradient(150deg, #7f00ff, #e100ff)",
  poll: "linear-gradient(150deg, #4f46e5, #7c3aed)",
  question: "linear-gradient(150deg, #7c3aed, #c026d3)",
  link: "linear-gradient(150deg, #1e293b, #334155)",
  location: "linear-gradient(150deg, #0d9488, #06b6d4)",
  countdown: "linear-gradient(150deg, #d97706, #f59e0b)",
};

const typeLabel = (type) =>
  ({
    text: "Text",
    voice: "Voice",
    music: "Music",
    poll: "Poll",
    question: "Question",
    link: "Link",
    location: "Location",
    countdown: "Countdown",
    layout: "Layout",
  })[type] || "";

// ── text ─────────────────────────────────────────────────────────────────────

const TextBody = ({ text }) => (
  <Frame
    style={{
      background: text.backgroundGradient || text.backgroundColor || THEME.text,
      alignItems: alignItemsOf(text.position),
      padding: text.position === "top" ? "3.5rem 1.75rem" : "1.75rem",
    }}
  >
    {text.mediaUrl && (
      <img src={text.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
    )}
    {text.mediaUrl && <div className="absolute inset-0 bg-black/40" />}

    <p
      className="relative w-full whitespace-pre-wrap break-words"
      style={{
        color: text.color || "#ffffff",
        fontSize: text.fontSize || 32,
        fontFamily: fontStackOf(text.font),
        textAlign: textAlignOf(text.align),
        lineHeight: 1.25,
        textShadow: "0 1px 8px rgba(0,0,0,0.25)",
      }}
    >
      {text.content}
    </p>

    {text.emoji && (
      <span className="absolute top-5 right-5 text-4xl" aria-hidden="true">
        {text.emoji}
      </span>
    )}
  </Frame>
);

// ── voice ────────────────────────────────────────────────────────────────────

const VoiceBody = ({ voice, playing, onToggle }) => {
  const audioRef = useRef(null);
  const [playhead, setPlayhead] = useState(0);
  const duration = voice.duration || 0;
  const bars = voice.waveform?.length ? voice.waveform : Array.from({ length: 40 }, () => 0.08);
  const passed = duration > 0 ? (playhead / duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing]);

  return (
    <Frame style={{ background: voice.backgroundUrl ? "#0b1b3a" : THEME.voice }}>
      {voice.backgroundUrl && (
        <img
          src={voice.backgroundUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
      )}

      <div className="relative w-full px-7 flex flex-col items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="size-20 rounded-full bg-white/20 backdrop-blur grid place-items-center text-white hover:bg-white/30 transition-colors"
          aria-label={playing ? "Pause voice status" : "Play voice status"}
        >
          {playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
        </button>

        {/* Bars are the clip's own measured amplitudes, so the shape means
            something: a long silence in the recording is a gap here too. */}
        <div className="w-full flex items-center justify-center gap-[3px] h-20 my-6">
          {bars.map((peak, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${(i / bars.length) * 100 <= passed ? "bg-white" : "bg-white/35"}`}
              style={{ height: `${Math.max(4, peak * 64)}px` }}
            />
          ))}
        </div>

        <p className="text-sm text-white/70 tabular-nums">
          {clockOf(playhead)} / {clockOf(duration)}
        </p>
      </div>

      {voice.url && (
        <audio
          ref={audioRef}
          src={voice.url}
          onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
          onEnded={() => onToggle()}
          className="hidden"
        />
      )}
    </Frame>
  );
};

// ── music ────────────────────────────────────────────────────────────────────

const MusicBody = ({ music, playing, onToggle }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing]);

  return (
    <Frame style={{ background: "linear-gradient(150deg, #1a1035, #3b0764)" }}>
      {music.albumArtUrl && (
        <img
          src={music.albumArtUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
      )}

      <div className="relative w-full px-7 flex flex-col items-center text-center">
        <div className="size-40 rounded-3xl overflow-hidden bg-black/40 grid place-items-center shadow-2xl">
          {music.albumArtUrl ? (
            <img src={music.albumArtUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music4 size={40} className="text-white/50" />
          )}
        </div>

        <p className="mt-6 text-lg font-semibold text-white line-clamp-2">
          {music.title || "Untitled track"}
        </p>
        {music.artist && <p className="text-sm text-white/65 mt-0.5">{music.artist}</p>}

        {music.url && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-6 flex items-center gap-2.5 px-6 py-3 rounded-full bg-white/20 backdrop-blur text-white font-medium text-sm hover:bg-white/30 transition-colors"
          >
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {playing ? "Pause" : "Play clip"}
          </button>
        )}
        <p className="mt-3 text-[11px] text-white/45">
          {clockOf(music.startAt)} in · {clockOf(music.duration)}
        </p>
      </div>

      {music.url && <audio ref={audioRef} src={music.url} className="hidden" />}
    </Frame>
  );
};

// ── poll ─────────────────────────────────────────────────────────────────────

const PollBody = ({ poll, myVote, onVote, voting, isOwn }) => {
  const total = pollTotal(poll);
  const reveal = total > 0 || myVote >= 0;

  return (
    <Frame style={{ background: THEME.poll, alignItems: "flex-start" }}>
      <div className="w-full h-full px-5 py-16 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={15} className="text-white/70" />
          <span className="text-[11px] uppercase tracking-wide text-white/60">Poll</span>
          {poll.isClosed && (
            <span className="text-[10px] uppercase tracking-wide bg-white/20 text-white/80 px-1.5 py-0.5 rounded">
              Closed
            </span>
          )}
        </div>

        {poll.question && (
          <p className="text-white font-semibold text-lg leading-snug mb-4">{poll.question}</p>
        )}

        <div className="space-y-2 flex-1">
          {(poll.options || []).map((option, i) => {
            const votes = option.votes?.length || 0;
            const share = total > 0 ? (votes / total) * 100 : 0;
            const mine = myVote === i;
            return (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onVote(i);
                }}
                disabled={voting || poll.isClosed}
                className={`relative w-full h-11 rounded-xl overflow-hidden text-left transition-colors disabled:opacity-70 ${
                  mine ? "ring-2 ring-white" : ""
                }`}
              >
                {/* The bar is the tally, so a voter can see the shape of the
                    answer they just joined without a separate legend. */}
                {reveal && (
                  <span
                    className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-500"
                    style={{ width: `${share}%` }}
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-between px-3.5">
                  <span className="text-sm text-white font-medium truncate pr-2">{option.text}</span>
                  {reveal && (
                    <span className="text-xs text-white/85 tabular-nums flex-shrink-0">{votes}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-white/55 text-center">
          {total === 0
            ? "No votes yet"
            : `${total} vote${total === 1 ? "" : "s"}${myVote >= 0 ? " · your pick is outlined" : ""}`}
          {isOwn ? " · your poll" : ""}
        </p>
      </div>
    </Frame>
  );
};

// ── question ─────────────────────────────────────────────────────────────────

const QuestionBody = ({ question, onAnswer, answering, answered, isOwn, onTyping }) => {
  const [text, setText] = useState("");

  const submit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const value = text.trim();
    if (!value) return;
    onAnswer(value);
    setText("");
    onTyping?.(false);
  };

  // A question is usually worth more than five seconds of thought, and the timer
  // does not know that this status has its own input on it. Without this the
  // question advances out from under someone mid-sentence, taking the half-typed
  // answer with it. Focus and blur are the honest signal — they also cover
  // deleting, which a keystroke-count check would miss.
  useEffect(() => {
    return () => onTyping?.(false);
  }, [onTyping]);

  return (
    <Frame style={{ background: THEME.question, alignItems: "flex-start" }}>
      <div className="w-full h-full px-5 py-16 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircleQuestion size={15} className="text-white/70" />
          <span className="text-[11px] uppercase tracking-wide text-white/60">
            {isOwn ? "Your question" : "Ask me anything"}
          </span>
        </div>

        <p className="text-white font-semibold text-xl leading-snug flex-1">
          {question.prompt}
        </p>

        <form onSubmit={submit} className="mt-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onTyping?.(true);
              }}
              onFocus={() => onTyping?.(true)}
              onBlur={() => onTyping?.(false)}
              onClick={(e) => e.stopPropagation()}
              maxLength={300}
              placeholder="Your answer..."
              className="flex-1 h-11 px-4 rounded-full bg-white/15 border border-white/25 text-white placeholder-white/45 text-sm outline-none focus:border-white/60 transition-colors"
            />
            <button
              type="submit"
              disabled={!text.trim() || answering}
              className="size-11 rounded-full bg-white/20 text-white grid place-items-center disabled:opacity-40 hover:bg-white/30 transition-colors flex-shrink-0"
              aria-label="Send answer"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/50 text-center">
            {answered ? "Answered — you can change it" : "Only the person who posted this can read it"}
          </p>
        </form>
      </div>
    </Frame>
  );
};

// ── link ─────────────────────────────────────────────────────────────────────

const LinkBody = ({ link }) => {
  const href = link.url || "";

  return (
    <Frame style={{ background: THEME.link }}>
      <div className="w-full h-full px-5 py-16 flex items-center">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm ring-1 ring-white/20 hover:ring-white/40 transition-shadow"
        >
          <div className="h-32 bg-black/25 grid place-items-center">
            {link.imageUrl ? (
              <img src={link.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Link2 size={30} className="text-white/45" />
            )}
          </div>
          <div className="p-4">
            <p className="text-[11px] text-white/65 flex items-center gap-1.5">
              <Sparkles size={11} />
              {link.domain || hostOf(href)}
            </p>
            <p className="text-white font-semibold text-base mt-1 leading-snug line-clamp-2 break-words">
              {link.title || hostOf(href)}
            </p>
            {link.description && (
              <p className="text-white/65 text-xs mt-1.5 line-clamp-3 break-words">
                {link.description}
              </p>
            )}
            <p className="mt-3 text-[11px] text-white/50 flex items-center gap-1.5">
              Opens in your browser
              <ExternalLink size={11} />
            </p>
          </div>
        </a>
      </div>
    </Frame>
  );
};

const hostOf = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value || "Link";
  }
};

// ── location ─────────────────────────────────────────────────────────────────

const LocationBody = ({ location }) => {
  const href = mapUrlOf(location);
  // Faded coordinates rather than a map image: no tile requests, nothing that
  // can be fingerprinted, and the pin still reads as a place.
  const blurred = location.precision === "approximate";

  return (
    <Frame style={{ background: THEME.location }}>
      <div className="w-full h-full px-5 py-16 flex items-center">
        <a
          href={href || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            if (!href) e.preventDefault();
          }}
          className="w-full rounded-3xl overflow-hidden bg-white/10 backdrop-blur-sm ring-1 ring-white/20 hover:ring-white/40 transition-shadow"
        >
          <div className="relative h-36 grid place-items-center overflow-hidden">
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                backgroundSize: "30px 30px",
              }}
            />
            <div className="relative flex flex-col items-center gap-2">
              <span className="size-12 rounded-full bg-white/20 grid place-items-center">
                <MapPin size={24} className="text-white" />
              </span>
              {location.lat !== 0 || location.lng !== 0 ? (
                <p className="text-[11px] text-white/70 font-mono">
                  {Number(location.lat.toFixed(blurred ? 1 : 4))},{" "}
                  {Number(location.lng.toFixed(blurred ? 1 : 4))}
                </p>
              ) : null}
            </div>
            {blurred && (
              <span className="absolute bottom-2 right-3 text-[10px] bg-black/35 text-white/85 px-2 py-0.5 rounded-full">
                Approximate
              </span>
            )}
          </div>

          <div className="p-4">
            <p className="text-white font-semibold text-base break-words">
              {location.name || "A place"}
            </p>
            {location.address && (
              <p className="text-white/65 text-xs mt-1 break-words">{location.address}</p>
            )}
            <p className="mt-3 text-[11px] text-white/50 flex items-center gap-1.5">
              Open in Maps
              <ExternalLink size={11} />
            </p>
          </div>
        </a>
      </div>
    </Frame>
  );
};

// ── countdown ────────────────────────────────────────────────────────────────

const CountdownBody = ({ countdown }) => {
  const target = countdown.targetAt ? new Date(countdown.targetAt).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());

  // A countdown that only updates when the viewer taps something is a countdown
  // that lies, so it ticks on its own. One interval, not one per frame.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;
  const done = remaining <= 0;

  return (
    <Frame style={{ background: THEME.countdown }}>
      <div className="w-full h-full px-6 py-16 flex flex-col items-center justify-center text-center">
        <Timer size={30} className="text-white/80 mb-4" />
        {countdown.title && (
          <p className="text-white font-semibold text-lg leading-snug max-w-[80%]">
            {countdown.title}
          </p>
        )}
        <p
          className={`mt-5 font-bold tabular-nums ${done ? "text-3xl text-white" : "text-4xl text-white"}`}
        >
          {done ? "It's time" : formatRemaining(remaining)}
        </p>
        <p className="mt-3 text-xs text-white/60">
          {new Date(countdown.targetAt).toLocaleString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </Frame>
  );
};

// ── layout ───────────────────────────────────────────────────────────────────

/**
 * A multi-photo status, shown one photo at a time.
 *
 * Paged rather than gridded: a status fills the screen, and shrinking six photos
 * into one screen makes none of them legible. The dots are the only indication
 * of how many there are, and they only appear past the first.
 */
const LayoutBody = ({ items }) => {
  const [page, setPage] = useState(0);
  const list = (items || []).filter((item) => item?.url);
  const count = list.length;

  useEffect(() => {
    setPage(0);
  }, [count]);

  const go = (delta) => {
    setPage((p) => Math.min(count - 1, Math.max(0, p + delta)));
  };

  return (
    <Frame style={{ background: "#000" }}>
      {count > 0 && (
        <>
          <img
            src={list[Math.min(page, count - 1)]?.url}
            alt=""
            className="w-full h-full object-contain"
          />

          {count > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                disabled={page === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 size-9 rounded-full bg-black/45 text-white grid place-items-center disabled:opacity-25 transition-opacity"
                aria-label="Previous photo"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                disabled={page >= count - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 size-9 rounded-full bg-black/45 text-white grid place-items-center disabled:opacity-25 transition-opacity"
                aria-label="Next photo"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {count > 1 && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-10">
              {list.map((item, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPage(i);
                  }}
                  className={`size-1.5 rounded-full transition-all ${
                    i === page ? "bg-white w-4" : "bg-white/45"
                  }`}
                  aria-label={`Photo ${i + 1} of ${count}`}
                />
              ))}
            </div>
          )}

          {count > 1 && (
            <span className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 text-white/85 text-[11px]">
              <LayoutGrid size={11} />
              {page + 1}/{count}
            </span>
          )}
        </>
      )}
    </Frame>
  );
};

// ── the dispatcher ───────────────────────────────────────────────────────────

const StatusBody = ({
  status,
  mediaUrl,
  isOwn,
  myId,
  onVote,
  onAnswer,
  onToggleVideo,
  audioPlaying,
  onToggleAudio,
  voting,
  answering,
  hasAnswered,
  onQuestionTyping,
}) => {
  // Only one clip can play at a time, so "playing" is checked against the status
  // currently sounding rather than tracked per type. The type is passed in at the
  // call site instead of being derived here, because a status is exactly one type
  // and the button that was pressed already knows which.
  const isPlaying = Boolean(audioPlaying) && audioPlaying.type === status?._id;

  const toggleAudio = (type) => {
    onToggleAudio?.(isPlaying ? null : { _id: status._id, type });
  };

  // A legacy status may arrive with no `type` at all, and every branch below
  // switches on it — resolve once so photo/video and the typed kinds all land in
  // the right one.
  const type = resolveStatusType(status);

  switch (type) {
    case "text":
      return <TextBody text={status.text || { content: "" }} />;

    case "voice":
      return <VoiceBody voice={status.voice || {}} playing={isPlaying} onToggle={() => toggleAudio("voice")} />;

    case "music":
      return <MusicBody music={status.music || {}} playing={isPlaying} onToggle={() => toggleAudio("music")} />;

    case "poll":
      return (
        <PollBody
          poll={status.poll || { options: [] }}
          myVote={votedOptionOf(status.poll, myId)}
          onVote={onVote}
          voting={voting}
          isOwn={isOwn}
        />
      );

    case "question":
      return (
        <QuestionBody
          question={status.question || { prompt: "" }}
          onAnswer={onAnswer}
          answering={answering}
          answered={hasAnswered}
          isOwn={isOwn}
          onTyping={onQuestionTyping}
        />
      );

    case "link":
      return <LinkBody link={status.link || {}} />;

    case "location":
      return <LocationBody location={status.location || {}} />;

    case "countdown":
      return <CountdownBody countdown={status.countdown || {}} />;

    case "layout": {
      const items = [
        ...(status.media?.url ? [status.media] : []),
        ...(status.mediaItems || []),
      ];
      return <LayoutBody items={items} />;
    }

    case "image":
      return (
        <Frame className="bg-black">
          {mediaUrl ? (
            <img src={mediaUrl} alt="Status" className="w-full h-full object-contain" />
          ) : (
            <p className="text-white/60 text-sm">Failed to load photo</p>
          )}
        </Frame>
      );

    case "video":
      return (
        <Frame className="bg-black">
          {mediaUrl ? (
            // Rendered here rather than in the viewer so the video element sits
            // inside the same frame as every other type. The ref is the viewer's
            // — its progress bar follows the video's own clock, not a timer
            // running beside it.
            <video
              ref={onToggleVideo?.videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain pointer-events-auto"
              autoPlay
              playsInline
              onTimeUpdate={onToggleVideo?.onTimeUpdate}
              onEnded={onToggleVideo?.onEnded}
              onClick={onToggleVideo?.onClick}
            />
          ) : (
            <p className="text-white/60 text-sm">Failed to load video</p>
          )}
        </Frame>
      );

    default:
      return (
        <Frame style={{ background: "#111827" }}>
          <p className="text-white/60 text-sm">{typeLabel(status?.type) || "Status"}</p>
        </Frame>
      );
  }
};

export default StatusBody;
