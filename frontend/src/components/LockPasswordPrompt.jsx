import { useEffect, useRef, useState } from "react";
import { X, Lock, Eye, EyeOff, Loader } from "lucide-react";

// In-app password prompt for chat lock actions.
//
// Replaces window.prompt, which was the quickest thing to write and the worst
// thing to look at: it renders as a bare OS dialog with the page URL in it,
// ignores the theme entirely, and on Android shows a keyboard over a grey box
// that looks nothing like the app.
//
// Rendered by whoever needs it and resolved through onSubmit, so it stays a plain
// controlled component with no global state.

const LockPasswordPrompt = ({
  title = "Confirm your lock password",
  description,
  confirmLabel = "Confirm",
  error = "",
  isBusy = false,
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focused on the next frame; focusing during the mount that reveals the sheet
    // fights the entrance animation on Android and the keyboard opens over a
    // half-drawn panel.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!value.trim() || isBusy) return;
    onSubmit(value);
  };

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm cg-fade"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <form
        onSubmit={submit}
        className="bg-base-100 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl cg-sheet sm:cg-dialog overflow-hidden"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="grid rounded-2xl size-10 place-items-center s-tile shrink-0">
            <Lock size={17} className="text-primary" />
          </span>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[15px] font-semibold text-base-content">{title}</h3>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed t-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-full t-dim hover:text-base-content"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Lock password"
              autoComplete="current-password"
              className="field-focus w-full h-12 px-4 pr-11 text-[15px] rounded-2xl bg-base-200 border-0 text-base-content ph-dim"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute -translate-y-1/2 right-3 top-1/2 p-1 rounded-full t-dim hover:text-base-content"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 pt-4 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-2xl s-chip text-[14px] font-semibold text-base-content"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isBusy || !value.trim()}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-content text-[14px] font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {isBusy && <Loader size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LockPasswordPrompt;
