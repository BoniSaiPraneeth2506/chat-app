import { useRef } from "react";
import { ArrowLeft, Check, ChevronRight, Image as ImageIcon, Palette, Trash2 } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { getWallpaperStyle } from "../pages/SettingsPage";

const THEMES = [
  { id: "default", name: "Default" },
  { id: "sage", name: "Sage" },
  { id: "sky", name: "Sky" },
  { id: "lavender", name: "Lavender" },
  { id: "sunset", name: "Sunset" },
];

const isCustomWallpaper = (w) =>
  Boolean(
    w &&
      typeof w === "string" &&
      (w.startsWith("data:") || w.startsWith("http://") || w.startsWith("https://"))
  );

const ChatThemePreview = ({ style }) => (
  <div
    className="relative w-full h-full p-2.5 flex flex-col justify-end gap-1.5 overflow-hidden"
    style={style}
  >
    <div className="max-w-[75%] self-start px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-base-100/90 text-[10px] leading-snug text-base-content shadow-sm">
      Hey, how are you?
    </div>
    <div className="max-w-[75%] self-end px-2.5 py-1.5 rounded-xl rounded-br-sm bg-primary text-[10px] leading-snug text-primary-content shadow-sm">
      Looks great!
    </div>
  </div>
);

const ChatThemeScreen = ({ onClose, activeWall, onPickTheme, onPickGalleryFile }) => {
  const { theme } = useThemeStore();
  const fileRef = useRef(null);
  const isCustom = isCustomWallpaper(activeWall);
  const isDefault = !activeWall || activeWall === "default";
  const customUrl = isCustom ? activeWall.split("#dim=")[0] : null;

  return (
    <div className="absolute inset-0 z-[100] bg-base-100 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-base-300 bg-base-100/90 backdrop-blur text-left">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-base-200 transition-colors"
          title="Close chat theme"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="grid rounded-full place-items-center size-9 bg-primary/10">
          <Palette className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Chat theme</h2>
          <p className="text-[11px] opacity-60 truncate">Pick a background for this chat</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* From gallery */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            From gallery
          </span>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-3 w-full py-2.5 px-3 rounded-2xl bg-base-200/50 text-sm font-medium hover:bg-base-200/80 transition-colors"
          >
            <span className="grid place-items-center size-9 rounded-xl bg-primary/10 text-primary shrink-0">
              <ImageIcon className="size-4" />
            </span>
            <span className="flex-1 text-left">Upload from gallery</span>
            <ChevronRight className="size-4 opacity-40" />
          </button>
          {isCustom && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-base-200/50 p-2.5">
              <div
                className="size-14 rounded-lg border border-base-content/10 shrink-0 bg-center bg-cover"
                style={{ backgroundImage: `url('${customUrl}')` }}
              />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold">Custom theme</p>
                <p className="text-[11px] opacity-60 truncate">Your uploaded picture</p>
              </div>
              <button
                onClick={() => onPickTheme("default")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onPickGalleryFile(file);
            }}
          />
        </div>

        {/* Preset themes */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Themes
          </span>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => {
              const active = activeWall === t.id || (t.id === "default" && isDefault && !isCustom);
              return (
                <button
                  key={t.id}
                  onClick={() => onPickTheme(t.id)}
                  className={`group overflow-hidden rounded-2xl text-left transition-all ${
                    active ? "bg-primary/10" : "bg-base-200/50 hover:bg-base-200/80"
                  }`}
                >
                  <div className="h-28 bg-base-100">
                    <ChatThemePreview style={getWallpaperStyle(t.id, theme)} />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className={`text-xs font-medium ${active ? "text-primary" : "text-base-content/90"}`}>
                      {t.name}
                    </span>
                    {active && (
                      <span className="grid place-items-center size-4 rounded-full bg-primary text-primary-content">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatThemeScreen;