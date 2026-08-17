import { MessageSquare, Users, Phone, Shield, Cloud, Smartphone, Heart, Github, Linkedin, Mail } from "lucide-react";

// Static about screen.
//
// Same surface language as the profile, blocked and linked-devices screens:
// borderless panels one step lighter than the page, separated by spacing rather
// than dividers. Everything here is hard-coded on purpose — there is nothing to
// fetch, so the page renders instantly and works offline.

const cardClass = "rounded-2xl bg-base-200";
const sectionLabel = "text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1";

const APP_NAME = "Chatty";
const APP_VERSION = "1.0";

const CAPABILITIES = [
  {
    icon: MessageSquare,
    title: "Real-time messaging",
    body: "Replies, reactions, edits, forwarding, scheduled messages and messages that disappear on a timer.",
  },
  {
    icon: Users,
    title: "Groups",
    body: "Roles and per-action permissions, @mentions, polls, invite links and shared media.",
  },
  {
    icon: Phone,
    title: "Voice & video calls",
    body: "One-to-one and group calls over WebRTC, with screen sharing and a raise-hand.",
  },
  {
    icon: Shield,
    title: "Privacy controls",
    body: "Hide your online and typing status, block contacts, lock view-once media against screenshots.",
  },
  {
    icon: Cloud,
    title: "Works offline",
    body: "Conversations are cached on the device and queued messages send themselves once you reconnect.",
  },
  {
    icon: Smartphone,
    title: "One app, two places",
    body: "The same codebase runs in the browser and as a native Android app.",
  },
];

const STACK = [
  "React", "Vite", "TailwindCSS", "DaisyUI", "Zustand",
  "Node.js", "Express", "MongoDB", "Socket.IO", "WebRTC",
  "Cloudinary", "Capacitor", "Dexie",
];

const LINKS = [
  { icon: Github, label: "GitHub", href: "https://github.com/BoniSaiPraneeth2506" },
  { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/sai-praneeth-boni" },
  { icon: Mail, label: "Email", href: "mailto:chinthala@bellcorpstudio.com" },
];

const AboutPage = () => {
  return (
    <div className="min-h-screen pt-20 pb-14">
      <div className="max-w-2xl px-4 mx-auto space-y-5">

        {/* Identity */}
        <div className={`${cardClass} px-6 py-8 flex flex-col items-center text-center`}>
          <div className="grid rounded-2xl size-16 place-items-center bg-primary/10">
            <MessageSquare size={30} className="text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-base-content">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-base-content/50">Version {APP_VERSION}</p>
          <p className="mt-4 text-[15px] leading-relaxed text-base-content/70 max-w-md">
            A modern chat app for messaging, calling and sharing with the people
            who matter — built to feel fast whether you open it in a browser or
            on your phone.
          </p>
        </div>

        {/* What it does */}
        <div className="space-y-2">
          <span className={sectionLabel}>What it does</span>
          <div className="space-y-2.5">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <div key={title} className={`${cardClass} flex items-start gap-4 p-4`}>
                <div className="grid rounded-xl size-10 place-items-center bg-primary/10 flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium text-base-content">{title}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-base-content/55">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Creator */}
        <div className="space-y-2">
          <span className={sectionLabel}>Created by</span>
          <div className={`${cardClass} p-6 flex flex-col items-center text-center`}>
            <div className="grid rounded-full size-16 place-items-center bg-secondary/10 text-secondary text-xl font-semibold">
              SP
            </div>
            <h3 className="mt-3 text-lg font-semibold text-base-content">Sai Praneeth Boni</h3>
            <p className="mt-1 text-sm text-base-content/50">
              Designer &amp; developer of {APP_NAME}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-base-content/60 max-w-sm">
              Designed, built and shipped end to end — the interface, the
              real-time backend, and the Android app.
            </p>

            <div className="flex items-center gap-2 mt-5">
              {LINKS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  aria-label={label}
                  className="grid rounded-xl size-11 place-items-center bg-base-300/70 text-base-content/70 hover:text-primary hover:bg-base-300 active:scale-95 transition-all"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Stack */}
        <div className="space-y-2">
          <span className={sectionLabel}>Built with</span>
          <div className={`${cardClass} p-4 flex flex-wrap gap-2`}>
            {STACK.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-base-300/70 text-base-content/70"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-base-content/40">
          Made with <Heart size={12} className="text-error fill-error" /> in India
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
