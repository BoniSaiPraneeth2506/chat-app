import { ArrowLeft, Volume2, CheckCheck, Eye, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../store/useThemeStore";
import useAuthStore from "../store/useAuthStore";

const Toggle = ({ checked, onChange }) => (
  <input
    type="checkbox"
    className="toggle toggle-primary toggle-sm"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
  />
);

const Row = ({ icon: Icon, title, desc, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-3.5 transition-colors hover:bg-base-200/70">
    <div className="flex items-center gap-3">
      <div className="grid rounded-lg place-items-center size-9 bg-primary/10">
        <Icon size={17} className="text-primary" />
      </div>
      <div className="space-y-0.5">
        <span className="text-xs font-semibold block">{title}</span>
        <p className="text-[10px] opacity-70">{desc}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const AppPreferencesPage = () => {
  const navigate = useNavigate();
  const {
    soundEnabled,
    setSoundEnabled,
    privacyReadReceipts,
    setPrivacyReadReceipts,
  } = useThemeStore();
  const authUser = useAuthStore((s) => s.authUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const onlinePrivacy = authUser?.onlinePrivacy !== false;
  const typingPrivacy = authUser?.typingPrivacy !== false;

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
              <Volume2 size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">App Preferences</h1>
              <p className="text-xs opacity-60">Configure real-time alerts and privacy toggles</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Alerts
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            <Row
              icon={Volume2}
              title="Message Sounds"
              desc="Play audio ping when receiving new messages"
              checked={soundEnabled}
              onChange={setSoundEnabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Privacy
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            <Row
              icon={CheckCheck}
              title="Read Receipts"
              desc="Send and show double check blue read ticks"
              checked={privacyReadReceipts}
              onChange={setPrivacyReadReceipts}
            />
            <Row
              icon={Eye}
              title="Show Online Status"
              desc="Let others see when you're active"
              checked={onlinePrivacy}
              onChange={async (v) => await updateProfile({ onlinePrivacy: v })}
            />
            <Row
              icon={Type}
              title="Show Typing Status"
              desc="Let others see when you're typing"
              checked={typingPrivacy}
              onChange={async (v) => await updateProfile({ typingPrivacy: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppPreferencesPage;
