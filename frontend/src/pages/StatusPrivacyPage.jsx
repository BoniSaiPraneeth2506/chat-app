import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Eye, Archive } from "lucide-react";
import { useStatusStore } from "../store/useStatusStore";
import { PRIVACY_META, PRIVACY_OPTIONS } from "../components/status/StatusEditorShell";
import { haptic } from "../lib/haptics";

/**
 * The default audience for every new status, and the archive switch.
 *
 * This is the owner-level privacy — what a freshly opened status editor is
 * pre-filled with, and whether expired statuses are kept. It is global on
 * purpose, the same way the chat app treats account settings: one choice that
 * applies from then on, overridable per status inside the editor.
 *
 * The "only" and "except" audiences are a mode here, not a list. A global
 * default cannot sensibly pin a list of people for every future status, so
 * those two modes are chosen here and the *who* is picked per status at post
 * time — which is exactly how the editor already works.
 */

const ModeRow = ({ mode, selected, onPick }) => {
  const meta = PRIVACY_META[mode];
  const Icon = meta.icon;
  return (
    <button
      onClick={() => onPick(mode)}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors text-left ${
        selected ? "bg-primary/10" : "hover:bg-base-200/70"
      }`}
    >
      <span
        className={`size-9 rounded-xl grid place-items-center flex-shrink-0 ${
          selected ? "bg-primary text-primary-content" : "bg-base-200"
        }`}
      >
        <Icon size={16} className={selected ? "" : "text-base-content/50"} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-base-content">{meta.label}</span>
        <span className="block text-[11px] text-base-content/50 leading-snug mt-0.5">
          {meta.hint}
        </span>
      </span>
      <span
        className={`size-5 rounded-full border-2 grid place-items-center flex-shrink-0 transition-colors ${
          selected ? "border-primary bg-primary" : "border-base-300"
        }`}
      >
        {selected && <span className="size-1.5 rounded-full bg-primary-content" />}
      </span>
    </button>
  );
};

const StatusPrivacyPage = () => {
  const navigate = useNavigate();
  const {
    defaultPrivacy,
    keepArchived,
    fetchStatusSettings,
    updateStatusSettings,
  } = useStatusStore();

  // Refresh on entry, so a change made on another device or in a previous
  // session is reflected before the author edits anything.
  useEffect(() => {
    fetchStatusSettings();
  }, [fetchStatusSettings]);

  const pickMode = (mode) => {
    haptic("tap");
    void updateStatusSettings({ defaultPrivacy: mode });
  };

  const toggleArchive = () => {
    haptic("tap");
    void updateStatusSettings({ keepArchived: !keepArchived });
  };

  return (
    <div
      className="container min-h-screen max-w-5xl px-4 pt-6 pb-12 mx-auto"
      style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <ShieldCheck size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Status privacy</h1>
              <p className="text-xs opacity-60">The audience for all your new statuses</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Eye size={14} className="opacity-40" />
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-40">
              Default audience for new statuses
            </p>
          </div>

          <div className="space-y-1">
            {PRIVACY_OPTIONS.map((option) => (
              <ModeRow
                key={option.mode}
                mode={option.mode}
                selected={defaultPrivacy === option.mode}
                onPick={pickMode}
              />
            ))}
          </div>

          <div className="space-y-1 border-t border-base-200 pt-3">
            <button
              onClick={toggleArchive}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-base-200/70 transition-colors text-left"
            >
              <span className="size-9 rounded-xl bg-base-200 grid place-items-center flex-shrink-0">
                <Archive size={16} className="text-base-content/50" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-base-content">
                  Keep archived statuses
                </span>
                <span className="block text-[11px] text-base-content/50 leading-snug mt-0.5">
                  Expired statuses are kept in your archive instead of being deleted
                </span>
              </span>
              <span
                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors flex-shrink-0 ${
                  keepArchived ? "bg-primary" : "bg-base-300"
                }`}
                aria-checked={keepArchived}
                role="switch"
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    keepArchived ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPrivacyPage;