import { ArrowLeft, BellRing, MessageSquare, Users, Phone, Eye, Music, Vibrate } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotificationsStore } from "../store/useNotificationsStore";

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

const NotificationSettingsPage = () => {
  const navigate = useNavigate();
  const {
    messageNotifications,
    groupNotifications,
    callNotifications,
    statusNotifications,
    showPreview,
    notificationSound,
    vibration,
    setMessageNotifications,
    setGroupNotifications,
    setCallNotifications,
    setStatusNotifications,
    setShowPreview,
    setNotificationSound,
    setVibration,
  } = useNotificationsStore();

  return (
    <div className="container min-h-screen max-w-3xl px-4 pt-20 pb-12 mx-auto"
         style={{ backgroundColor: 'var(--color-base-100)', color: 'var(--color-neutral)' }}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back to settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <BellRing size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Notifications</h1>
              <p className="text-xs opacity-60">Choose what you want to be notified about</p>
            </div>
          </div>
        </div>

        {/* Receive notifications */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Receive notifications
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: 'var(--color-base-200)/40' }}>
            <Row
              icon={MessageSquare}
              title="Message notifications"
              desc="New messages in your chats"
              checked={messageNotifications}
              onChange={setMessageNotifications}
            />
            <Row
              icon={Users}
              title="Group notifications"
              desc="New messages in your groups"
              checked={groupNotifications}
              onChange={setGroupNotifications}
            />
            <Row
              icon={Phone}
              title="Call notifications"
              desc="Incoming and missed calls"
              checked={callNotifications}
              onChange={setCallNotifications}
            />
            <Row
              icon={BellRing}
              title="Status notifications"
              desc="When someone posts a status"
              checked={statusNotifications}
              onChange={setStatusNotifications}
            />
          </div>
        </div>

        {/* Notify me about */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            Alert style
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: 'var(--color-base-200)/40' }}>
            <Row
              icon={Eye}
              title="Show message previews"
              desc="Show the message text in notifications"
              checked={showPreview}
              onChange={setShowPreview}
            />
            <Row
              icon={Music}
              title="Sound"
              desc="Play a sound when you get a notification"
              checked={notificationSound}
              onChange={setNotificationSound}
            />
            <Row
              icon={Vibrate}
              title="Vibration"
              desc="Vibrate when you get a notification"
              checked={vibration}
              onChange={setVibration}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
