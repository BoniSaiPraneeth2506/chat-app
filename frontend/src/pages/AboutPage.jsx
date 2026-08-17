import { useState } from "react";
import {
  MessageSquare, Users, Phone, ShieldCheck, WifiOff, Sparkles,
  Github, Linkedin, Mail, ChevronRight, Check,
} from "lucide-react";

// About screen.
//
// Built around one accent surface at the top and quiet content beneath it, the
// way Instagram and WhatsApp handle their own about screens — the page has one
// focal point rather than a stack of equally loud cards, which is what made the
// first version feel flat.
//
// Everything is static, so it paints instantly and works offline. Colours come
// from theme tokens, so it follows whichever of the 30+ themes is active; the
// hero is the one place that commits to the icon's own violet, because it is
// showing the product's identity rather than the app's chrome.

const APP_NAME = "Chatty";
const APP_VERSION = "1.0";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Messaging that keeps up",
    body: "Replies, reactions, edits, forwarding, scheduled sends and messages that disappear on a timer.",
  },
  {
    icon: Users,
    title: "Groups with real controls",
    body: "Roles and per-action permissions, mentions, polls, invite links and a shared media gallery.",
  },
  {
    icon: Phone,
    title: "Calls, one to one or many",
    body: "Voice and video over WebRTC, with screen sharing, raise-hand and a grid for group calls.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy you control",
    body: "Hide your online and typing status, block contacts, and lock view-once photos against screenshots.",
  },
  {
    icon: WifiOff,
    title: "Works without signal",
    body: "Conversations are cached on the device, and anything you send while offline goes out on reconnect.",
  },
  {
    icon: Sparkles,
    title: "One app, two homes",
    body: "The same codebase runs in the browser and as a native Android app, with no feature left behind.",
  },
];

const STACK = [
  "React", "Vite", "Tailwind", "DaisyUI", "Zustand", "Node",
  "Express", "MongoDB", "Socket.IO", "WebRTC", "Capacitor", "Dexie",
];

const LINKS = [
  { icon: Github, label: "GitHub", value: "BoniSaiPraneeth2506", href: "https://github.com/BoniSaiPraneeth2506" },
  { icon: Linkedin, label: "LinkedIn", value: "Sai Praneeth Boni", href: "https://www.linkedin.com/in/sai-praneeth-boni" },
  { icon: Mail, label: "Email", value: "chinthala@bellcorpstudio.com", href: "mailto:chinthala@bellcorpstudio.com" },
];

const AboutPage = () => {
  // Tapping the version a few times is a small, discoverable flourish — the
  // kind of thing people expect to find on an about screen.
  const [taps, setTaps] = useState(0);

  return (
    <div className="min-h-screen pb-16 bg-base-100">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* The icon's own violet, as a soft wash rather than a hard block. */}
        <div
          className="absolute inset-0"
          style={{
            // Derived from the theme rather than hard-coded: the icon is
            // monochrome now, so a fixed violet wash would fight it, and this
            // follows whichever of the 30+ themes is active.
            background:
              "radial-gradient(120% 90% at 50% -10%, var(--color-primary) 0%, var(--color-secondary) 42%, transparent 78%)",
            opacity: 0.16,
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(to bottom, transparent, var(--color-base-100))" }}
        />

        <div className="relative max-w-2xl px-6 pt-24 pb-10 mx-auto text-center">
          <div className="inline-grid place-items-center">
            <img
              src="/app-icon.png"
              alt={`${APP_NAME} icon`}
              width={88}
              height={88}
              className="rounded-[22px] ab-ring"
            />
          </div>

          <h1 className="mt-6 text-[34px] font-bold leading-none tracking-tight text-base-content">
            {APP_NAME}
          </h1>

          <button
            type="button"
            onClick={() => setTaps((t) => t + 1)}
            className="mt-3 px-3 py-1 rounded-full ab-chip text-[11px] font-semibold tracking-wide ab-muted active:scale-95 transition-transform"
          >
            {taps >= 5 ? "Built one commit at a time ✦" : `Version ${APP_VERSION}`}
          </button>

          <p className="mt-6 text-[16px] leading-relaxed ab-muted max-w-md mx-auto">
            Messaging, calling and sharing with the people who matter — fast in a
            browser, at home on your phone.
          </p>
        </div>
      </div>

      <div className="max-w-2xl px-5 mx-auto space-y-10">

        {/* ── Features ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.12em] ab-faint">
            What it does
          </h2>

          {/* One panel with hairline separations rather than six floating cards —
              fewer edges reads calmer at this density. */}
          <div className="overflow-hidden rounded-3xl ab-panel">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className={`flex items-start gap-4 px-5 py-4 ${
                  i > 0 ? "ab-sep" : ""
                }`}
              >
                <div className="grid mt-0.5 rounded-2xl size-10 place-items-center ab-tile shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-base-content">{title}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed ab-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Creator ────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.12em] ab-faint">
            Created by
          </h2>

          <div className="p-6 rounded-3xl ab-panel">
            <div className="flex items-center gap-4">
              {/* Gradient ring, Instagram-style, around a monogram. */}
              <div
                className="grid p-[2.5px] rounded-full shrink-0 place-items-center"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-primary), var(--color-secondary) 55%, var(--color-accent))",
                }}
              >
                <div className="grid rounded-full size-16 place-items-center bg-base-200 text-[19px] font-bold tracking-tight text-base-content">
                  SP
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight text-base-content truncate">
                  Sai Praneeth Boni
                </h3>
                <p className="mt-0.5 text-[13.5px] ab-dim">
                  Designer &amp; developer
                </p>
              </div>
            </div>

            <p className="mt-5 text-[14.5px] leading-relaxed ab-muted">
              {APP_NAME} was designed, built and shipped end to end — the
              interface, the real-time backend, and the Android app.
            </p>

            <div className="mt-5 space-y-1.5">
              {LINKS.map(({ icon: Icon, label, value, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-3 -mx-1 rounded-2xl ab-row active:scale-[0.99] group"
                >
                  <Icon size={17} className="ab-dim shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] uppercase tracking-wider font-semibold ab-faint">
                      {label}
                    </span>
                    <span className="block text-[14px] text-base-content truncate">{value}</span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="ab-faint shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stack ──────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.12em] ab-faint">
            Built with
          </h2>
          <div className="flex flex-wrap gap-2 p-5 rounded-3xl ab-panel">
            {STACK.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 text-[12.5px] font-medium rounded-full ab-chip ab-muted"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        <div className="flex flex-col items-center gap-2 pt-2">
          <span className="flex items-center gap-1.5 text-[12px] ab-faint">
            <Check size={13} className="text-primary" />
            You&apos;re up to date
          </span>
          <span className="text-[12px] ab-faint">
            © {new Date().getFullYear()} {APP_NAME}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
