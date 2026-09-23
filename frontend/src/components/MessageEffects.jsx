import { useMemo } from "react";

// ── Celebratory message effects ────────────────────────────────────────────
//
// Special messages (party / love / new-year emoji or phrases) burst with a one
// shot confetti-and-fireworks spray when they appear on screen. Each burst is
// generated ONCE per message via useMemo, so the div renders identically on
// every re-render — React never replays the CSS animation because the elements
// are the same. Rebounding into view replays it naturally on remount.

const EFFECT_EMOJI = ["🎆", "🎇", "✨", "💫", "🎉", "🎊", "❤️", "💖", "⭐", "🌟"];
const PARTICLE_COUNT = 18;

const TRIGGER_PHRASES = [
  "happy new year", "new year", "merry christmas", "happy birthday", "congratulations",
  "congrats", "i love you", "love you", "miss you", "wedding", "engaged", "engagement",
  "well done", "awesome", "amazing", "beautiful", "diwali", "eid mubarak", "raise",
];

const TRIGGER_EMOJI = ["🎉", "🎊", "🥳", "🎆", "🎇", "🧨", "💥", "🎂"];

/**
 * True when a message deserves a burst. Lowercased, trimmed, punctuation-free.
 * Any single celebration emoji counts; a celebratory word inside any language
 * free-text check is best-effort and deliberately cheap.
 */
export function shouldBurst(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase().replace(/[.,!?;:'"…]/g, " ");
  for (const emoji of TRIGGER_EMOJI) {
    if (t.includes(emoji)) return true;
  }
  return TRIGGER_PHRASES.some((p) => t.includes(p));
}

export default function MessageEffects({ message }) {
  const particles = useMemo(() => {
    const total = PARTICLE_COUNT;
    return Array.from({ length: total }, (_, i) => {
      const left = (i * 5.3 + 10) % 88 + 2; // spread across the bubble width
      const drift = ((i % 3) - 1) * 26; // -26 / 0 / +26 px
      return {
        key: `fx-${message?._id || message?.tempId || "fx"}-${i}`,
        emoji: EFFECT_EMOJI[i % EFFECT_EMOJI.length],
        left,
        drift,
        delay: (Math.random() * 0.4).toFixed(2),
        dur: (1.6 + Math.random() * 1.1).toFixed(2),
        size: 12 + Math.round(Math.random() * 12),
      };
    });
  }, [message?._id, message?.tempId]);

  if (!message?.text) return null;
  if (!shouldBurst(message.text)) return null;
  if (message.isDeletedForEveryone) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-2xl" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.key}
          className="fx-particle"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            "--drift": `${p.drift}px`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}