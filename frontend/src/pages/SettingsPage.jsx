import { Send, LogOut, AlertTriangle, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from '../store/useThemeStore';
import { useEffect, useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import ChatLockSettings from '../components/ChatLockSettings';
import { THEME_COLORS, THEMES } from "../constants";

const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going?", isSent: false },
  { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

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

const SettingsPage = () => {
  const { 
    theme, 
    setTheme, 
    wallpaper, 
    setWallpaper, 
    soundEnabled, 
    setSoundEnabled, 
    privacyReadReceipts, 
    setPrivacyReadReceipts 
  } = useThemeStore();

  const { authUser, logOut, deleteAccount, updateProfile } = useAuthStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState(null); // null = dialog closed
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const [messageTimer, setMessageTimer] = useState(authUser?.messageTimer || "off");
  const [onlinePrivacy, setOnlinePrivacy] = useState(authUser?.onlinePrivacy !== false);
  const [typingPrivacy, setTypingPrivacy] = useState(authUser?.typingPrivacy !== false);

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    logOut();
  };

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

  return (
    <div className="container min-h-screen max-w-5xl px-4 pt-20 pb-12 mx-auto" 
         style={{ backgroundColor: 'var(--color-base-100)', color: 'var(--color-neutral)' }}>
      <div className="space-y-8">
        {/* Themes Grid */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Theme</h2>
            <p className="text-sm opacity-70">Choose a theme for your chat interface</p>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {THEMES.map((t) => (
              <button
                key={t}
                className={`
                  group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors border
                  ${theme === t ? 'border-2' : 'border'}
                `}
                style={{
                  backgroundColor: theme === t ? 'var(--color-base-200)' : 'transparent',
                  borderColor: theme === t ? 'var(--color-primary)' : 'var(--color-base-300)'
                }}
                onClick={() => setTheme(t)}
              >
                <div className="relative w-full h-8 overflow-hidden border rounded-md">
                  <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
                    <div className="rounded" style={{ backgroundColor: THEME_COLORS[t].primary }}></div>
                    <div className="rounded" style={{ backgroundColor: THEME_COLORS[t].secondary }}></div>
                    <div className="rounded" style={{ backgroundColor: THEME_COLORS[t].accent }}></div>
                    <div className="rounded" style={{ backgroundColor: THEME_COLORS[t].neutral }}></div>
                  </div>
                </div>
                <span className="text-[11px] font-medium truncate w-full text-center">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Customization & Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t" style={{ borderColor: 'var(--color-base-300)' }}>
          {/* Chat Wallpaper Customization */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-base">Chat Wallpaper</h3>
              <p className="text-xs opacity-75">Personalize your message screen background</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                { id: "default", name: "Default", color: "bg-base-200" },
                { id: "sage", name: "Sage", color: "bg-[#e5ddd5]" },
                { id: "sky", name: "Sky", color: "bg-[#d4e6f1]" },
                { id: "lavender", name: "Lavender", color: "bg-[#ebdef0]" },
                { id: "sunset", name: "Sunset", color: "bg-gradient-to-br from-amber-200 to-rose-200" },
              ].map((wp) => (
                <button
                  key={wp.id}
                  onClick={() => setWallpaper(wp.id)}
                  className="px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: wallpaper === wp.id ? 'var(--color-base-200)' : 'transparent',
                    borderColor: wallpaper === wp.id ? 'var(--color-primary)' : 'var(--color-base-300)'
                  }}
                >
                  <span className={`size-3 rounded-full ${wp.color} border border-base-content/10`} />
                  {wp.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Privacy Preferences */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-base">App Preferences</h3>
              <p className="text-xs opacity-75">Configure real-time alerts and privacy toggles</p>
            </div>

            <div className="space-y-3">
              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                   style={{ backgroundColor: 'var(--color-base-200)/30', borderColor: 'var(--color-base-300)' }}>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold">Message Sounds</span>
                  <p className="text-[10px] opacity-70">Play audio ping when receiving new messages</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
              </div>

              {/* Privacy Read receipts Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                   style={{ backgroundColor: 'var(--color-base-200)/30', borderColor: 'var(--color-base-300)' }}>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold">Read Receipts</span>
                  <p className="text-[10px] opacity-70">Send and show double check blue read ticks</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={privacyReadReceipts}
                  onChange={(e) => setPrivacyReadReceipts(e.target.checked)}
                />
              </div>

              {/* Online Status Privacy */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                   style={{ backgroundColor: 'var(--color-base-200)/30', borderColor: 'var(--color-base-300)' }}>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold">Show Online Status</span>
                  <p className="text-[10px] opacity-70">Let others see when you're active</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={onlinePrivacy}
                  onChange={async (e) => {
                    setOnlinePrivacy(e.target.checked);
                    await updateProfile({ onlinePrivacy: e.target.checked });
                  }}
                />
              </div>

              {/* Typing Indicator Privacy */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                   style={{ backgroundColor: 'var(--color-base-200)/30', borderColor: 'var(--color-base-300)' }}>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold">Show Typing Status</span>
                  <p className="text-[10px] opacity-70">Let others see when you're typing</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={typingPrivacy}
                  onChange={async (e) => {
                    setTypingPrivacy(e.target.checked);
                    await updateProfile({ typingPrivacy: e.target.checked });
                  }}
                />
              </div>

              {/* Chat lock sits with the other privacy controls rather than in a
                  section of its own, since that is where someone looks for it. */}
              <ChatLockSettings />
            </div>
          </div>
        </div>

        {/* Disappearing Messages — global default for all new conversations.
            Per-chat overrides are set from the chat header, same as WhatsApp. */}
        <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--color-base-300)' }}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 opacity-60" />
              <h3 className="font-semibold text-base">Disappearing Messages</h3>
            </div>
            <p className="text-xs opacity-75">Messages in new chats will disappear after the selected time</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { value: "off", label: "Off", desc: "Never" },
              { value: "1h", label: "1 hour", desc: "" },
              { value: "24h", label: "24 hours", desc: "" },
              { value: "7d", label: "7 days", desc: "" },
              { value: "30d", label: "30 days", desc: "" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={async () => {
                  setMessageTimer(opt.value);
                  await updateProfile({ messageTimer: opt.value });
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border transition-all text-left ${
                  messageTimer === opt.value
                    ? "border-primary bg-primary/10"
                    : "hover:bg-base-200/50"
                }`}
                style={{
                  borderColor: messageTimer === opt.value ? 'var(--color-primary)' : 'var(--color-base-300)',
                }}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                {opt.desc && <span className="text-[10px] opacity-50 mt-0.5">{opt.desc}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--color-base-300)' }}>
          <h3 className="text-lg font-semibold">Preview</h3>
          <div className="overflow-hidden border shadow-lg rounded-xl" 
               style={{ borderColor: 'var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }}>
            <div className="p-4 bg-base-200/50">
              <div className="max-w-lg mx-auto">
                <div className="overflow-hidden shadow-sm rounded-xl" 
                     style={{ backgroundColor: 'var(--color-base-100)' }}>
                  {/* Chat Header */}
                  <div className="px-4 py-3 border-b" 
                       style={{ borderColor: 'var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 font-medium text-white rounded-full"
                           style={{ backgroundColor: 'var(--color-primary)' }}>
                        J
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">John Doe</h3>
                        <p className="text-xs opacity-70">Online</p>
                      </div>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="p-4 space-y-4 min-h-[200px] max-h-[200px] overflow-y-auto" 
                       style={{ 
                         backgroundColor: 'var(--color-base-100)',
                         ...getWallpaperStyle(wallpaper, theme)
                       }}>
                    {PREVIEW_MESSAGES.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isSent ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className="max-w-[80%] rounded-xl p-3 shadow-sm"
                          style={{
                            backgroundColor: message.isSent ? 'var(--color-primary)' : 'var(--color-base-200)',
                            color: message.isSent ? 'white' : 'var(--color-neutral)'
                          }}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-[10px] mt-1.5 opacity-70">
                            12:00 PM
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 border-t" 
                       style={{ borderColor: 'var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 h-10 px-3 text-sm border rounded-lg"
                        style={{ 
                          borderColor: 'var(--color-base-300)', 
                          backgroundColor: 'var(--color-base-100)',
                          color: 'var(--color-neutral)'
                        }}
                        placeholder="Type a message..."
                        value="This is a preview"
                        readOnly
                      />
                      <button 
                        className="h-10 px-4 font-medium text-white rounded-lg"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logout */}
        {authUser && (
          <div className="flex flex-wrap items-center gap-3 pt-6 border-t" style={{ borderColor: 'var(--color-base-300)' }}>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-error border-error/40 hover:bg-error/10 transition-colors font-medium text-sm"
            >
              <LogOut size={16} />
              Log out
            </button>
            {/* Sits beside Log out but reads as heavier: filled rather than
                outlined, since it's the one action here that can't be undone. */}
            <button
              onClick={() => setDeleteDraft("")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 hover:bg-error/20 text-error transition-colors font-medium text-sm"
            >
              <AlertTriangle size={16} />
              Delete my account
            </button>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {deleteDraft !== null && (
        <div
          onClick={() => !isDeleting && setDeleteDraft(null)}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-6 bg-base-100 rounded-2xl shadow-2xl text-left"
          >
            <h3 className="text-lg font-semibold text-error">Delete your account?</h3>
            <p className="mt-2 mb-1 text-sm text-base-content/60">
              This cannot be undone. Your profile, the messages you sent and their photos are
              permanently removed, and you leave every group.
            </p>
            <p className="mb-5 text-xs text-base-content/40">
              Messages other people sent you stay in their own chat history.
            </p>

            <input
              autoFocus
              type="password"
              value={deleteDraft}
              onChange={(e) => setDeleteDraft(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-12 px-1 text-[15px] bg-transparent border-0 border-b border-base-content/15 rounded-none text-base-content placeholder:text-base-content/30 outline-none transition-colors focus:border-error focus:ring-0"
            />
            <p className="mt-2 text-[11px] text-base-content/35">
              Signed in with Google and never set a password? Type DELETE instead.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteDraft(null)}
                className="h-10 px-4 rounded-xl bg-base-300/70 hover:bg-base-300 text-[13px] font-medium text-base-content transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || !deleteDraft.trim()}
                onClick={async () => {
                  setIsDeleting(true);
                  const ok = await deleteAccount({ password: deleteDraft, confirm: deleteDraft });
                  setIsDeleting(false);
                  if (ok) {
                    setDeleteDraft(null);
                    navigate("/login", { replace: true });
                  }
                }}
                className="h-10 px-5 rounded-xl bg-error text-error-content text-[13px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-40"
              >
                {isDeleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-base-100 border border-base-300 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-left mx-4">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <LogOut className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-base-content">Confirm Logout</h3>
            </div>
            <p className="text-sm text-base-content/75 mb-6">
              Are you sure you want to log out of your session? You will need to sign in again to access your messages.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg bg-base-200 hover:bg-base-300 text-base-content text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Yes, Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;