// Social/portfolio link definitions, shared by the profile editor and every
// read-only place a user's links are rendered, so the set of platforms and
// their icons/colors are defined exactly once.
import { Github, Twitter, Linkedin, Youtube, Globe } from "lucide-react";

export const SOCIAL_PLATFORMS = [
  {
    key: "github",
    label: "GitHub",
    icon: Github,
    // Brand black/white is unreadable on half the app's 30+ themes, so
    // platform accents stay theme-relative rather than literal brand hex.
    colorClass: "text-base-content",
    placeholder: "github.com/username",
  },
  {
    key: "twitter",
    label: "X / Twitter",
    icon: Twitter,
    colorClass: "text-sky-500",
    placeholder: "x.com/username",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    colorClass: "text-blue-600",
    placeholder: "linkedin.com/in/username",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: Youtube,
    colorClass: "text-red-600",
    placeholder: "youtube.com/@channel",
  },
  {
    key: "portfolio",
    label: "Portfolio",
    icon: Globe,
    colorClass: "text-primary",
    placeholder: "yourname.dev",
  },
];

/** Makes a user-typed value safe and clickable as an href, or "" if it isn't. */
export const toSafeHref = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    // The server sanitizes on save, but profiles saved before that existed
    // (and the legacy free-text `link` field) still flow through here.
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
};

/** Strips scheme/`www.`/trailing slash so links read as handles, not URLs. */
export const toDisplayHandle = (value) =>
  String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");

/**
 * The platforms this user actually filled in, ready to render. Tolerates a
 * missing `socialLinks` entirely — profiles created before the field existed
 * simply have no links to show.
 */
export const getFilledSocialLinks = (user) => {
  const links = user?.socialLinks || {};
  return SOCIAL_PLATFORMS.map((platform) => ({
    ...platform,
    href: toSafeHref(links[platform.key]),
    handle: toDisplayHandle(links[platform.key]),
  })).filter((platform) => platform.href);
};

/** An all-keys-present object suitable for a controlled form. */
export const toSocialLinksForm = (user) =>
  SOCIAL_PLATFORMS.reduce((acc, platform) => {
    acc[platform.key] = user?.socialLinks?.[platform.key] || "";
    return acc;
  }, {});
