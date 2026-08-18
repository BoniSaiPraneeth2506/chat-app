import { Laptop, Smartphone, Tablet, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import useAuthStore from "../store/useAuthStore";

// Same surface language as the profile screen: borderless panels one step
// lighter than the page, separated by spacing rather than rules.
const cardClass = "rounded-2xl bg-base-200";
const sectionLabel = "text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1";

const deviceIconFor = (device) =>
  device === "Mobile" ? Smartphone : device === "Tablet" ? Tablet : Laptop;

/**
 * "Active now" reads as a live session; a raw locale timestamp reads as a log
 * entry. Falls back to a date once the gap stops being meaningful in hours.
 */
const relativeTime = (value) => {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "Unknown";

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "Active now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(value).toLocaleDateString();
};

const DeviceSkeleton = () => (
  <div className={`${cardClass} flex items-center gap-4 p-4`}>
    <div className="rounded-full size-11 bg-base-300 animate-pulse flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 rounded-full bg-base-300 animate-pulse w-2/5" />
      <div className="h-3 rounded-full bg-base-300 animate-pulse w-3/5" />
    </div>
  </div>
);

const LinkedDevicesPage = () => {
  const {
    authUser,
    sessions,
    isLoadingSessions,
    getSessions,
    revokeSession,
    revokeOtherSessions,
  } = useAuthStore();

  // Keyed on the id: authUser is replaced whenever anything about the account
  // changes, and refetching the session list each time flashed its loading state
  // for data that had not moved.
  useEffect(() => {
    if (authUser?._id) getSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?._id]);

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="min-h-screen pt-20 pb-14">
      <div className="max-w-2xl px-4 mx-auto space-y-5">

        {/* ── Header ── */}
        <div className={`${cardClass} px-6 py-7 flex flex-col items-center text-center`}>
          <div className="grid rounded-full size-14 place-items-center bg-primary/10">
            <MonitorSmartphone size={26} className="text-primary" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-base-content">Linked devices</h1>
          <p className="mt-1 text-sm text-base-content/50 max-w-sm">
            You&apos;re signed in on {sessions.length || "no"} device
            {sessions.length === 1 ? "" : "s"}. Log out any you don&apos;t recognise.
          </p>
        </div>

        {/* ── Device list ── */}
        <div className="space-y-2">
          <span className={sectionLabel}>
            {isLoadingSessions ? "Checking devices" : "Signed in"}
          </span>

          {isLoadingSessions ? (
            <div className="space-y-2.5">
              <DeviceSkeleton />
              <DeviceSkeleton />
            </div>
          ) : sessions.length === 0 ? (
            <div className={`${cardClass} px-6 py-10 text-center`}>
              <p className="text-[15px] text-base-content/60">No devices recorded yet</p>
              <p className="mt-1 text-xs text-base-content/35">
                Sign in again and this device will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((session) => {
                const DeviceIcon = deviceIconFor(session.device);
                return (
                  <div key={session.sid} className={`${cardClass} flex items-center gap-4 p-4`}>
                    <div
                      className={`grid rounded-full size-11 place-items-center flex-shrink-0 ${
                        session.isCurrent ? "bg-primary/15 text-primary" : "bg-base-300 text-base-content/60"
                      }`}
                    >
                      <DeviceIcon size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-base-content truncate">
                          {session.browser} on {session.os}
                        </span>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/15 text-primary flex-shrink-0">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-base-content/45">
                        {session.isCurrent && (
                          <span className="rounded-full size-1.5 bg-green-500 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {relativeTime(session.lastActive)}
                          {session.ip ? ` · ${session.ip}` : ""}
                        </span>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeSession(session.sid)}
                        className="px-3 h-9 rounded-xl bg-base-300/70 hover:bg-error/15 hover:text-error text-[13px] font-medium text-base-content/70 active:scale-[0.97] transition-all flex-shrink-0"
                      >
                        Log out
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bulk action ── */}
        {otherSessions.length > 0 && (
          <button
            onClick={revokeOtherSessions}
            className="w-full h-12 rounded-2xl bg-error/10 hover:bg-error/15 text-error font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <LogOut size={17} />
            Log out all other devices
          </button>
        )}

        <p className="flex items-start gap-2 px-1 text-xs text-base-content/35">
          <ShieldCheck size={14} className="mt-px flex-shrink-0" />
          Logging out a device signs it out immediately, wherever it is.
        </p>
      </div>
    </div>
  );
};

export default LinkedDevicesPage;
