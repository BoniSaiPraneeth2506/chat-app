import { useEffect, useMemo, useState } from "react";
import {
  EMOJI_CATEGORIES,
  SKIN_TONE_LABELS,
  SKIN_TONE_SUFFIXES,
  applySkinTone,
  searchEmojis,
  getFrequentEmojis,
  pushFrequentEmoji,
} from "../lib/emojiData";

/**
 * A lightweight emoji picker. Renders ONE category grid at a time (plus search
 * results or recents), so a full-open never mounts hundreds of buttons at once
 * and the app stays smooth on low-end Android devices.
 *
 * `onPick(emoji)` is called with the final (skin-toned) glyph. The picker
 * records frequent emoji in localStorage automatically. `onClose()` fires when
 * the backdrop is tapped so callers can hide it.
 */
export default function EmojiPicker({ onPick, onClose, tone = 0 }) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [skinTone, setSkinTone] = useState(tone);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [recent, setRecent] = useState(() => getFrequentEmojis(24));

  const results = useMemo(() => (query.trim() ? searchEmojis(query) : null), [query]);

  const pick = (emoji) => {
    const final = applySkinTone(emoji, skinTone);
    pushFrequentEmoji(final);
    setRecent(getFrequentEmojis(24));
    onPick(final);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const grid = results !== null ? results : tab === "recent" ? recent : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis || [];

  return (
    <>
      {/* Solid backdrop so a tap anywhere outside closes the picker. Covers the
          whole app even though the trigger lives inside a scrollable list. */}
      <div
        className="fixed inset-0 z-[1090] bg-black/35"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      />
      <div
        className="fixed left-1/2 bottom-[14vh] sm:bottom-[18vh] -translate-x-1/2 z-[1100] flex w-[min(92vw,340px)] flex-col rounded-2xl bg-base-200 shadow-2xl ring-1 ring-base-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-base-300 p-2">
          <input
            autoFocus={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="min-w-0 flex-1 rounded-lg bg-base-300 px-2.5 py-1.5 text-sm text-base-content outline-none placeholder:text-base-content/40"
          />
          <button
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base-content/60 hover:bg-base-300"
            aria-label="Close emoji picker"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-base-300 px-2 py-1.5">
          <button
            onClick={() => setTab("recent")}
            className={`shrink-0 rounded-full px-2 py-0.5 text-sm ${tab === "recent" ? "bg-primary text-white" : "text-black/60 dark:text-white/60"}`}
          >
            Recent
          </button>
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setTab("all");
                setActiveCategory(cat.id);
              }}
              aria-label={cat.label}
              className={`shrink-0 rounded-lg px-1.5 py-1 text-lg leading-none ${tab === "all" && activeCategory === cat.id ? "bg-primary/15" : "opacity-60 hover:opacity-100"}`}
              title={cat.label}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-b border-base-300 px-2 py-1.5">
          <span className="t-faint mr-1 text-[10px] font-semibold uppercase tracking-wide">Tone</span>
          {SKIN_TONE_SUFFIXES.map((suffix, i) => (
            <button
              key={i}
              onClick={() => setSkinTone(i)}
              title={SKIN_TONE_LABELS[i]}
              className={`grid h-6 w-6 place-items-center rounded-full text-base leading-none ${skinTone === i ? "ring-2 ring-primary" : ""}`}
            >
              {i === 0 ? <span className="text-[13px] text-black/60 dark:text-white/60">👋</span> : "👋" + suffix}
            </button>
          ))}
        </div>

        <div className="grid max-h-[240px] grid-cols-8 gap-0.5 overflow-y-auto p-2">
          {grid.length ? (
            grid.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => pick(emoji)}
                className="grid h-9 w-9 place-items-center rounded-lg text-[22px] leading-none hover:bg-black/5 dark:hover:bg-white/10"
              >
                {emoji}
              </button>
            ))
          ) : (
            <div className="col-span-8 py-6 text-center text-sm text-black/40 dark:text-white/40">
              No emoji found
            </div>
          )}
        </div>
      </div>
    </>
  );
}