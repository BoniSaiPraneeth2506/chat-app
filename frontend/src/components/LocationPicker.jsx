import { useState } from "react";
import { X, MapPin, Clock, Loader, Navigation } from "lucide-react";
import { getCurrentPosition } from "../lib/location";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import useLocationModalStore from "../store/useLocationModalStore";

const DURATIONS = [
  { min: 15, label: "15 minutes" },
  { min: 60, label: "1 hour" },
  { min: 480, label: "8 hours" },
];

/**
 * Bottom-sheet picker launched from the attach menu's "Location" tile.
 *
 * "Send location" fires a static pin message. "Share live location" requests
 * coordinates and opens the live map so the sharer can preview + confirm the
 * duration; sending broadcasts a `location.isLive` message and starts the
 * heartbeat engine.
 */
export default function LocationPicker({ onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sendMessage = useChatStore((s) => s.sendMessage);
  const authUser = useAuthStore((s) => s.authUser);

  const sendStatic = async () => {
    setBusy(true);
    setError("");
    try {
      const pos = await getCurrentPosition();
      await sendMessage({
        location: { lat: pos.lat, lng: pos.lng, isLive: false, label: "My location" },
        text: "",
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Could not get your location");
    } finally {
      setBusy(false);
    }
  };

  const sendLive = async (duration) => {
    setBusy(true);
    setError("");
    try {
      const pos = await getCurrentPosition();
      useLocationModalStore.getState().openModal(
        null,
        true,
        {
          drafting: { lat: pos.lat, lng: pos.lng, isLive: true, duration },
          senderName: authUser?.fullName || "",
        }
      );
      onClose();
    } catch (err) {
      setError(err?.message || "Could not get your location for live sharing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end bg-black/45 cg-fade"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] px-5 rounded-t-3xl bg-base-100 cg-sheet">
        <span className="block mx-auto mb-4 h-1 w-10 rounded-full bg-base-300" />
        <div className="flex items-center gap-3 mb-5">
          <span className="grid rounded-full size-12 place-items-center bg-green-500/15 text-green-500">
            <MapPin size={22} />
          </span>
          <div>
            <p className="font-semibold text-base-content">Location</p>
            <p className="text-xs t-dim">Share where you are</p>
          </div>
        </div>

        {error && <p className="text-xs text-error mb-3">{error}</p>}

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={sendStatic}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl s-row text-left active:scale-[0.99] transition-transform"
          >
            <span className="grid rounded-full size-10 place-items-center bg-primary/15 text-primary">
              {busy ? <Loader size={17} className="animate-spin" /> : <MapPin size={17} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-base-content">Send your current location</span>
              <span className="block text-[11px] t-dim">A static pin on the map</span>
            </span>
          </button>

          <div className="px-1 pt-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider t-dim mb-2">
              <Clock size={11} />
              Share live location
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.min}
                  type="button"
                  disabled={busy}
                  onClick={() => sendLive(d.min)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl s-row active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Navigation size={16} className="text-green-500" />
                  <span className="text-xs font-medium text-base-content">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium t-dim hover:text-base-content"
        >
          <X size={16} />
          Close
        </button>
      </div>
    </div>
  );
}