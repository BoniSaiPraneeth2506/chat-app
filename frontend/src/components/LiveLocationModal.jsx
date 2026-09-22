import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Clock, Shield, StopCircle } from "lucide-react";
import useLocationModalStore from "../store/useLocationModalStore";
import useLiveLocationStore from "../store/useLiveLocationStore";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { stopLiveShareTicker } from "../lib/liveShareEngine";

function liveIcon(name, color) {
  const initials = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      background:${color};display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:16px;border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.4);position:relative;
    ">${initials}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 30],
  });
}

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);">📍</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
  });
}

const DURATIONS = [
  { min: 15, label: "15 minutes" },
  { min: 60, label: "1 hour" },
  { min: 480, label: "8 hours" },
];

function fmtMin(min) {
  if (min >= 480) return "8 hr";
  if (min >= 60) return "1 hr";
  return `${min} min`;
}

/**
 * Full-screen interactive map. Serves three modes:
 *  - viewing a static pin message
 *  - viewing an active live share (sharer's avatar moves via socket frames)
 *  - drafting a NEW live share from the composer (senderName, no message yet)
 */
export default function LiveLocationModal() {
  const { open, message, isLive, drafting, senderName, closeModal } = useLocationModalStore();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const authUser = useAuthStore((s) => s.authUser);
  const liveUpdates = useLiveLocationStore((s) => s.liveUpdates);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const liveCoords = isLive && message ? liveUpdates[String(message._id)] : null;

  const isSender = message ? String(message.senderId) === String(authUser?._id) : false;

  // Coordinates that drive the map: drafting coords, live socket coords, or the
  // message's own pinned coords.
  const coords = useRef({ lat: null, lng: null });
  coords.current =
    drafting?.lat != null
      ? { lat: drafting.lat, lng: drafting.lng }
      : liveCoords
      ? { lat: liveCoords.lat, lng: liveCoords.lng }
      : message?.location
      ? { lat: message.location.lat, lng: message.location.lng }
      : { lat: null, lng: null };

  // Build map once when the modal opens.
  useEffect(() => {
    if (!open) return;
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, message?._id]);

  useEffect(() => {
    if (!open || !mapEl.current) return;
    if (mapRef.current) return;

    const base = coords.current.lat != null ? coords.current : { lat: 20.5937, lng: 78.9629 };
    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([base.lat, base.lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    if (base.lat != null) {
      const mk = L.marker([base.lat, base.lng], {
        icon: isLive && !drafting ? liveIcon(senderName, "#16a34a") : pinIcon(),
      }).addTo(map);
      markerRef.current = mk;
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-center / re-marker when coords or live updates change.
  useEffect(() => {
    if (!open || !mapRef.current) return;
    const c = coords.current;
    if (c.lat == null) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([c.lat, c.lng]);
    } else {
      markerRef.current = L.marker([c.lat, c.lng], {
        icon: isLive && !drafting ? liveIcon(senderName, "#16a34a") : pinIcon(),
      }).addTo(mapRef.current);
      markerRef.current.bindTooltip(
        isLive && !drafting ? (senderName || "Live location") : (message?.location?.label || "Location"),
        { direction: "top", offset: L.point(0, -34) }
      );
    }
    mapRef.current.panTo([c.lat, c.lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coords.current.lat, coords.current.lng]);

  const startLiveShare = async (duration) => {
    if (sending) return;
    const c = coords.current;
    if (c.lat == null) {
      setError("Location not available. Please allow location access and retry.");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        location: { lat: c.lat, lng: c.lng, isLive: true, duration },
        text: "",
      });
      closeModal();
    } catch (err) {
      setError(err?.message || "Could not share location");
    } finally {
      setSending(false);
    }
  };

  const stopShare = async () => {
    try {
      const socket = useAuthStore.getState().socket;
      if (message?._id) {
        stopLiveShareTicker(message._id);
        if (socket?.connected) {
          socket.emit("liveLocation:stop", { messageId: message._id });
        }
      }
    } catch {}
    closeModal();
  };

  if (!open) return null;

  const name = drafting ? (senderName || "You") : isLive ? (senderName || "Their location") : "Location";

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-base-100 border-b border-base-300/50">
        <div className="flex items-center gap-2">
          <span
            className={`grid place-items-center size-10 rounded-full ${
              isLive ? "bg-green-500/15 text-green-500" : "bg-primary/15 text-primary"
            }`}
          >
            {isLive ? <Clock size={20} /> : <MapPin size={20} />}
          </span>
          <div>
            <p className="font-bold leading-tight">{isLive ? "Live location" : "Shared location"}</p>
            <p className="text-xs text-base-content/60">
              {name}{isLive && message?.location?.duration ? ` · ${fmtMin(message.location.duration)}` : ""}
            </p>
          </div>
        </div>
        <button onClick={closeModal} className="btn btn-ghost btn-sm btn-circle" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div ref={mapEl} className="flex-1 w-full" />

      {error && (
        <div className="px-4 py-2 bg-error/10 text-error text-sm">{error}</div>
      )}

      <div className="bg-base-100 border-t border-base-300/50 p-4">
        {drafting ? (
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock size={15} className="text-primary" />
              Share live location for
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.min}
                  disabled={sending}
                  onClick={() => startLiveShare(d.min)}
                  className="btn btn-sm btn-primary"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-base-content/70 flex-1">
              {isLive && !isSender ? (
                <>
                  <span className="relative flex size-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
                  </span>
                  Their location updates in real time
                </>
              ) : (
                <>
                  <Shield size={15} className="text-primary" />
                  Location shared in this chat
                </>
              )}
            </p>
            {isLive && isSender && (
              <button onClick={stopShare} className="btn btn-sm btn-error">
                <StopCircle size={15} /> Stop sharing
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
