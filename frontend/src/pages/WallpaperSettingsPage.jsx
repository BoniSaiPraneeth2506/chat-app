import { useRef, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../store/useThemeStore";
import { getWallpaperStyle } from "./SettingsPage";
import { haptic } from "../lib/haptics";

const PRESETS = [
  { id: "default", name: "Default", color: "bg-base-200" },
  { id: "sage", name: "Sage", color: "bg-[#e5ddd5]" },
  { id: "sky", name: "Sky", color: "bg-[#d4e6f1]" },
  { id: "lavender", name: "Lavender", color: "bg-[#ebdef0]" },
  { id: "sunset", name: "Sunset", color: "bg-gradient-to-br from-amber-200 to-rose-200" },
];

const isImageWallpaper = (w) =>
  typeof w === "string" &&
  (w.startsWith("http://") || w.startsWith("https://") || w.startsWith("data:image"));

const WallpaperSettingsPage = () => {
  const { wallpaper, setWallpaper, theme } = useThemeStore();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pickFromGallery = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setWallpaper(reader.result);
      setUploading(false);
      haptic("success");
    };
    reader.onerror = () => setUploading(false);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // The chosen wallpaper applies to every chat — it is the universal chat
  // background. Image uploads from the gallery are stored inline so they work
  // offline and across all chats at once.
  const activePreview = wallpaper;

  return (
    <div className="container min-h-screen max-w-3xl px-4 pt-20 pb-12 mx-auto"
         style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back to settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <ImageIcon size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Chat Wallpaper</h1>
              <p className="text-xs opacity-60">Background for all your chats</p>
            </div>
          </div>
        </div>

        {/* From gallery */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            From gallery
          </span>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-base-200/60 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-base-200)/40" }}
            >
              <ImageIcon size={16} className="text-primary" />
              {uploading ? "Applying…" : "Choose from gallery"}
            </button>
            {isImageWallpaper(wallpaper) && (
              <button
                onClick={() => {
                  setWallpaper("default");
                  haptic("tap");
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-error transition-colors hover:bg-error/10"
                style={{ backgroundColor: "var(--color-base-200)/40" }}
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFromGallery} />
          </div>
          <p className="text-[10px] opacity-60 px-1">
            The image you pick becomes the wallpaper for every chat, saved on this device.
          </p>
        </div>

        {/* Preset wallpapers */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Default backgrounds
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PRESETS.map((wp) => {
              const active = wallpaper === wp.id;
              return (
                <button
                  key={wp.id}
                  onClick={() => {
                    setWallpaper(wp.id);
                    haptic("tap");
                  }}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                    active ? "border-primary bg-primary/10" : "hover:bg-base-200/50"
                  }`}
                  style={{
                    borderColor: active ? "var(--color-primary)" : "var(--color-base-300)",
                  }}
                >
                  <span className={`size-8 rounded-lg shrink-0 ${wp.color} border border-base-content/10`} />
                  <span className="text-sm font-medium">{wp.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Preview
          </span>
          <div className="overflow-hidden rounded-2xl border shadow-sm min-h-[150px] flex items-end"
               style={{ borderColor: "var(--color-base-300)", ...getWallpaperStyle(activePreview, theme) }}>
            <div className="w-full p-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="max-w-[220px] ml-auto rounded-t-2xl rounded-bl-2xl px-3.5 py-2 text-white text-sm shadow"
                   style={{ backgroundColor: "var(--color-primary)" }}>
                This is how your chat looks
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WallpaperSettingsPage;
