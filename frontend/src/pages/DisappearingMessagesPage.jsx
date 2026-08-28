import { useState } from "react";
import { ArrowLeft, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";

const OPTIONS = [
  { value: "off", label: "Off", desc: "Never disappear" },
  { value: "1h", label: "1 hour", desc: "After 1 hour" },
  { value: "24h", label: "24 hours", desc: "After 1 day" },
  { value: "7d", label: "7 days", desc: "After 1 week" },
  { value: "30d", label: "30 days", desc: "After 1 month" },
];

const DisappearingMessagesPage = () => {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.authUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [messageTimer, setMessageTimer] = useState(authUser?.messageTimer || "off");

  const select = async (value) => {
    setMessageTimer(value);
    await updateProfile({ messageTimer: value });
    toast.success(value === "off" ? "Disappearing messages off" : `New chats disappear after ${value}`);
  };

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
              <Timer size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Disappearing Messages</h1>
              <p className="text-xs opacity-60">Default for all new conversations</p>
            </div>
          </div>
        </div>

        <p className="text-sm opacity-75">
          Messages in new chats will disappear after the selected time. You can still set a
          different timer for individual chats from the chat header.
        </p>

        <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
             style={{ backgroundColor: "var(--color-base-200)/40" }}>
          {OPTIONS.map((opt) => {
            const active = messageTimer === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => select(opt.value)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-4 transition-colors text-left ${
                  active ? "bg-primary/10" : "hover:bg-base-200/70"
                }`}
              >
                <span className="space-y-0.5">
                  <span className={`block text-sm font-medium ${active ? "text-primary" : ""}`}>{opt.label}</span>
                  {opt.desc && <span className="block text-[10px] opacity-50">{opt.desc}</span>}
                </span>
                {active && (
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DisappearingMessagesPage;
