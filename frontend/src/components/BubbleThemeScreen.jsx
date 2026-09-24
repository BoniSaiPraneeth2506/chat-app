import { ArrowLeft, Check, RotateCcw, Sparkles } from "lucide-react";
import { BUBBLE_STYLES } from "../store/useThemeStore";

const bubbleGradient = (style) =>
  style.id === "auto"
    ? "linear-gradient(165deg, var(--color-base-300), var(--color-base-200))"
    : `linear-gradient(165deg, ${style.primary}, ${style.accent})`;

const bubbleTextColor = (style) =>
  style.id === "auto" ? "var(--color-base-content)" : "#e8eefc";

const BubbleThemeScreen = ({ onClose, current, onSelect }) => {
  const activeLabel = BUBBLE_STYLES.find((s) => s.id === current)?.label || "Default";

  return (
    <div className="absolute inset-0 z-[100] bg-base-100 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-base-300 bg-base-100/90 backdrop-blur text-left">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-base-200 transition-colors"
          title="Close bubble theme"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="grid rounded-full place-items-center size-9 bg-primary/10">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">Bubble theme</h2>
          <p className="text-[11px] opacity-60 truncate">
            Your bubbles · <span className="text-primary font-medium">{activeLabel}</span>
          </p>
        </div>
        {current !== "auto" && (
          <button
            onClick={() => onSelect("auto")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0"
          >
            <RotateCcw className="size-3.5" />
            Default
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {BUBBLE_STYLES.map((style) => {
            const active = current === style.id;
            return (
              <button
                key={style.id}
                onClick={() => onSelect(style.id)}
                className={`group overflow-hidden rounded-2xl text-left transition-all ${
                  active ? "bg-primary/10" : "bg-base-200/50 hover:bg-base-200/80"
                }`}
              >
                <div className="h-24 bg-base-100 p-2.5 flex flex-col justify-end gap-1.5">
                  <div className="max-w-[75%] self-start px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-base-200 text-[10px] leading-snug text-base-content">
                    Hey
                  </div>
                  <div
                    className="max-w-[75%] self-end px-2.5 py-1.5 rounded-xl rounded-br-sm text-[10px] leading-snug"
                    style={{ background: bubbleGradient(style), color: bubbleTextColor(style) }}
                  >
                    Looks great!
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className={`text-xs font-medium truncate ${active ? "text-primary" : "text-base-content/90"}`}>
                    {style.id === "auto" ? "Default" : style.label}
                  </span>
                  {active && (
                    <span className="grid place-items-center size-4 rounded-full bg-primary text-primary-content shrink-0">
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
  );
};

export default BubbleThemeScreen;