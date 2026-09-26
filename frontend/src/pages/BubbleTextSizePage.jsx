import { ArrowLeft, Type, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useThemeStore, TEXT_SIZES } from "../store/useThemeStore";
import { THEME_COLORS } from "../constants";
import { getWallpaperStyle } from "./SettingsPage";

const BubbleTextSizePage = () => {
  const { theme, wallpaper, textSize, setTextSize } = useThemeStore();
  const navigate = useNavigate();

  const active =
    TEXT_SIZES.find((s) => s.id === textSize) || TEXT_SIZES.find((s) => s.id === "medium");

  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_COLORS[theme];
    if (colors) {
      root.style.setProperty("--color-primary", colors.primary);
      root.style.setProperty("--color-secondary", colors.secondary);
      root.style.setProperty("--color-accent", colors.accent);
      root.style.setProperty("--color-neutral", colors.neutral);
      root.style.setProperty("--color-base-100", colors.base100);
      root.style.setProperty("--color-base-200", colors.base200);
      root.style.setProperty("--color-base-300", colors.base300);
    }
  }, [theme]);

  const pxFor = (opt) => Math.round(14 * opt.scale);
  const samplePx = pxFor(active);

  return (
    <div className="container min-h-screen max-w-3xl px-4 pt-8 pb-12 mx-auto"
         style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back to settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <Type size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Bubble Text Size</h1>
              <p className="text-xs opacity-60">Pick a readable size for message text</p>
            </div>
          </div>
        </div>

        {/* Size options — one row per size, exactly like every other settings page */}
        <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
             style={{ backgroundColor: "var(--color-base-200)/40" }}>
          {TEXT_SIZES.map((opt) => {
            const isActive = textSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTextSize(opt.id)}
                className={`w-full flex items-center justify-between gap-4 px-4 py-4 text-left transition-colors ${
                  isActive ? "bg-primary/5" : "hover:bg-base-200/70"
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`grid rounded-xl place-items-center size-11 shrink-0 transition-colors ${
                      isActive ? "bg-primary text-primary-content" : "bg-primary/10"
                    }`}
                  >
                    <span className="font-bold leading-none" style={{ fontSize: pxFor(opt) }}>Aa</span>
                  </span>
                  <div className="min-w-0">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span
                      className="block text-base-content/60 truncate"
                      style={{ fontSize: Math.max(10, pxFor(opt) - 2) }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </span>
                  </div>
                </div>
                <span className={`grid rounded-full place-items-center size-6 shrink-0 ${isActive ? "bg-primary" : "bg-base-300"}`}>
                  {isActive && <Check size={14} className="text-white" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live preview — matches the real chat look */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Preview</h3>
          <div className="p-4 rounded-2xl border shadow-sm"
               style={{
                 borderColor: "var(--color-base-300)",
                 backgroundColor: "var(--color-base-100)",
                 ...getWallpaperStyle(wallpaper, theme),
               }}>
            <div className="space-y-4">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl p-3 shadow-sm"
                     style={{ backgroundColor: "var(--color-base-200)", color: "var(--color-neutral)" }}>
                  <p style={{ fontSize: samplePx }}>Hey! Happy birthday 🎂</p>
                  <p className="mt-1.5 opacity-70" style={{ fontSize: Math.round(samplePx * 0.7) }}>10:00 AM</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-xl p-3 shadow-sm"
                     style={{ backgroundColor: "var(--color-primary)", color: "#e8eefc" }}>
                  <p style={{ fontSize: samplePx }}>Congratulations on your new car 🎉</p>
                  <p className="mt-1.5 opacity-70" style={{ fontSize: Math.round(samplePx * 0.7) }}>10:02 AM</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] opacity-60 px-1">
            Applied to every conversation. Changing it here updates message bubbles app-wide.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BubbleTextSizePage;