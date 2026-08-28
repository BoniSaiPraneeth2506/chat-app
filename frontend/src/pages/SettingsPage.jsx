import {
  Timer,
  Lock,
  ChevronRight,
  Palette,
  BellRing,
  Image as ImageIcon,
  Volume2,
  User,
  Ban,
  BookOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from '../store/useThemeStore';
import { useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import { THEME_COLORS } from "../constants";

export const getWallpaperStyle = (wallpaper, theme) => {
  if (wallpaper && (wallpaper.startsWith("http://") || wallpaper.startsWith("https://") || wallpaper.startsWith("data:image"))) {
    let dim = 0.35;
    let cleanUrl = wallpaper;
    if (wallpaper.includes("#dim=")) {
      const parts = wallpaper.split("#dim=");
      cleanUrl = parts[0];
      const parsedDim = Number(parts[1]);
      if (!isNaN(parsedDim)) {
        dim = parsedDim / 100;
      }
    }
    return {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url('${cleanUrl}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    };
  }

  const isDarkTheme = ["dark", "halloween", "forest", "luxury", "dracula", "synthwave", "black", "business", "night", "coffee"].includes(theme);
  
  if (isDarkTheme) {
    switch (wallpaper) {
      case "sage": 
        return { 
          backgroundColor: "#0b141a", 
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", 
          backgroundBlendMode: "overlay" 
        };
      case "sky": 
        return { backgroundColor: "#15202b" };
      case "lavender": 
        return { backgroundColor: "#1e1e24" };
      case "sunset": 
        return { backgroundImage: "linear-gradient(to bottom right, #0f172a, #1e293b)" };
      default: 
        return {};
    }
  } else {
    switch (wallpaper) {
      case "sage": 
        return { 
          backgroundColor: "#e5ddd5", 
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", 
          backgroundBlendMode: "overlay" 
        };
      case "sky": 
        return { backgroundColor: "#d4e6f1" };
      case "lavender": 
        return { backgroundColor: "#ebdef0" };
      case "sunset": 
        return { backgroundImage: "linear-gradient(to bottom right, #fef08a, #fca5a5)" };
      default: 
        return {};
    }
  }
};

// A Settings row rendered *inside* a grouped card. Rows carry no border — the
// card's thin divider is enough, and hover is the only affordance (WhatsApp
// style). Keeps the desktop look clean instead of "noob" boxed rows.
const SettRow = ({ icon: Icon, title, subtitle, onClick, trailing, danger }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-base-200/70 text-left"
  >
    <div className="flex items-center gap-4 min-w-0">
      <div className={`grid rounded-xl place-items-center size-11 shrink-0 ${danger ? "bg-error/10" : "bg-primary/10"}`}>
        <Icon size={20} className={danger ? "text-error" : "text-primary"} />
      </div>
      <div className="min-w-0">
        <span className={`block text-sm font-medium truncate ${danger ? "text-error" : ""}`}>{title}</span>
        {subtitle && <span className="block text-xs opacity-60 truncate">{subtitle}</span>}
      </div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      {trailing}
      <ChevronRight size={18} className="opacity-40" />
    </div>
  </button>
);

const SectionHeading = ({ title }) => (
  <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-2">{title}</span>
);

// One rounded card holding a heading and grouped rows, separated by thin
// dividers. Rows melt into the same themed background (no boxed borders).
const SettSection = ({ title, children }) => (
  <div className="space-y-2">
    <SectionHeading title={title} />
    <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
         style={{ backgroundColor: "var(--color-base-200)/40" }}>
      {children}
    </div>
  </div>
);

const SettingsPage = () => {
  const { theme, wallpaper } = useThemeStore();
  const { authUser } = useAuthStore();
  const navigate = useNavigate();

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_COLORS[theme];
    
    if (colors) {
      root.style.setProperty('--color-primary', colors.primary);
      root.style.setProperty('--color-secondary', colors.secondary);
      root.style.setProperty('--color-accent', colors.accent);
      root.style.setProperty('--color-neutral', colors.neutral);
      root.style.setProperty('--color-base-100', colors.base100);
      root.style.setProperty('--color-base-200', colors.base200);
      root.style.setProperty('--color-base-300', colors.base300);
    }
  }, [theme]);

  const wallpaperLabel =
    wallpaper && (wallpaper.startsWith("http") || wallpaper.startsWith("data:image"))
      ? "Custom"
      : wallpaper.charAt(0).toUpperCase() + wallpaper.slice(1);

  return (
    <div className="container min-h-screen max-w-2xl px-3 pt-20 pb-12 mx-auto" 
         style={{ backgroundColor: 'var(--color-base-100)', color: 'var(--color-neutral)' }}>
      <div className="space-y-7">
        <SettSection title="Appearance">
          <SettRow
            icon={Palette}
            title="Theme"
            subtitle={`${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
            onClick={() => navigate('/settings/theme')}
            trailing={
              <div className="flex overflow-hidden rounded-full border" style={{ borderColor: 'var(--color-base-300)' }}>
                <div className="w-3 h-3" style={{ backgroundColor: THEME_COLORS[theme]?.primary }} />
                <div className="w-3 h-3" style={{ backgroundColor: THEME_COLORS[theme]?.secondary }} />
                <div className="w-3 h-3" style={{ backgroundColor: THEME_COLORS[theme]?.accent }} />
              </div>
            }
          />
          <SettRow
            icon={ImageIcon}
            title="Chat Wallpaper"
            subtitle={wallpaperLabel}
            onClick={() => navigate('/settings/wallpaper')}
          />
          <SettRow
            icon={BellRing}
            title="Notifications"
            subtitle="Choose what you're notified about"
            onClick={() => navigate('/settings/notifications')}
          />
        </SettSection>

        <SettSection title="App Preferences">
          <SettRow
            icon={Volume2}
            title="App Preferences"
            subtitle="Sounds, read receipts, online & typing status"
            onClick={() => navigate('/settings/app-preferences')}
          />
        </SettSection>

        <SettSection title="Privacy & Security">
          <SettRow
            icon={Lock}
            title="Locked Chats"
            subtitle="Hide chosen chats behind a password"
            onClick={() => navigate('/settings/locked-chats')}
          />
          <SettRow
            icon={Timer}
            title="Disappearing Messages"
            subtitle="Default timer for new chats"
            onClick={() => navigate('/settings/disappearing-messages')}
          />
          <SettRow
            icon={Ban}
            title="Blocked Contacts"
            subtitle="Manage contacts you've blocked"
            onClick={() => navigate('/blocked')}
          />
        </SettSection>

        {authUser && (
          <SettSection title="Account">
            <SettRow
              icon={User}
              title="Account"
              subtitle={authUser.fullName}
              onClick={() => navigate('/settings/account')}
            />
          </SettSection>
        )}

        <SettSection title="Features">
          <SettRow
            icon={BookOpen}
            title="Features"
            subtitle="How to use every part of Chatty"
            onClick={() => navigate('/settings/features')}
          />
        </SettSection>
      </div>
    </div>
  );
};

export default SettingsPage;
