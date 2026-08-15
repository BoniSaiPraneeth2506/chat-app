import { Laptop, Smartphone, Tablet, LogOut, Loader2 } from "lucide-react";
import { useEffect } from "react";
import useAuthStore from "../store/useAuthStore";

const LinkedDevicesPage = () => {
  const {
    authUser,
    sessions,
    isLoadingSessions,
    getSessions,
    revokeSession,
    revokeOtherSessions,
  } = useAuthStore();

  useEffect(() => {
    if (authUser) getSessions();
  }, [authUser]);

  return (
    <div
      className="container min-h-screen max-w-5xl px-4 pt-20 pb-12 mx-auto"
      style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Linked Devices</h2>
            <p className="text-sm opacity-70">Devices currently signed in to your account</p>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={revokeOtherSessions}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border text-error border-error/40 hover:bg-error/10 transition-colors"
            >
              <LogOut size={14} /> Log Out Other Sessions
            </button>
          )}
        </div>

        {isLoadingSessions ? (
          <div className="flex items-center gap-2 text-sm opacity-70">
            <Loader2 size={16} className="animate-spin" /> Loading devices...
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm opacity-70">
            No device sessions recorded yet — sign in again to start tracking this device.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((session) => {
              const DeviceIcon =
                session.device === "Mobile" ? Smartphone : session.device === "Tablet" ? Tablet : Laptop;

              return (
                <div
                  key={session.sid}
                  className="flex items-start gap-3 p-3.5 rounded-xl border"
                  style={{ borderColor: "var(--color-base-300)" }}
                >
                  <DeviceIcon size={18} className="mt-0.5 opacity-70 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">
                        {session.browser} on {session.os}
                      </span>
                      {session.isCurrent && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/15 text-primary font-medium">
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-70 truncate">IP: {session.ip || "Unknown"}</p>
                    <p className="text-[11px] opacity-70">
                      Last active: {new Date(session.lastActive).toLocaleString()}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => revokeSession(session.sid)}
                      className="px-2 py-1 text-[11px] rounded-lg border hover:bg-base-200 transition-colors"
                      style={{ borderColor: "var(--color-base-300)" }}
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
    </div>
  );
};

export default LinkedDevicesPage;
