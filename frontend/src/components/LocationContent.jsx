import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Clock, MoveRight } from "lucide-react";
import useLiveLocationStore from "../store/useLiveLocationStore";
import { openLocationModal } from "../lib/location";

function baseIcon(emoji, color, size) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};display:flex;align-items:center;justify-content:center;
      font-size:${Math.floor(size / 2)}px;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const pinIcon = () => baseIcon("📍", "#2563eb", 34);
const liveIcon = () => baseIcon("📡", "#16a34a", 38);

function initMap(el, { lat, lng }) {
  const map = L.map(el, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: true,
  }).setView([lat, lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

function durationLabel(min) {
  if (min === 480) return "8 hr";
  if (min === 60) return "1 hr";
  return "15 min";
}

// A live message is "live" unless it was stopped (socket relay), has a `stop`
// marker, or its expiry has passed. Returns true when the share is OVER.
function useLocationLiveState(message) {
  const stopped = useLiveLocationStore((s) => s.stoppedShareIds[String(message._id)]);
  if (stopped) return true;
  const loc = message?.location;
  if (!loc?.isLive || loc.stop) return true;
  if (loc.expiresAt && Date.now() >= new Date(loc.expiresAt).getTime()) return true;
  return false;
}

/**
 * Renders a location message inside a chat bubble.
 *
 * Static: a small Leaflet preview with a marker + "View on map".
 * Live: same preview with a pulsing LIVE badge; the marker tracks the sharer's
 * latest socket-delivered coordinate, and tapping opens the interactive modal.
 */
export default function LocationContent({ message, isLive: isLiveProp }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const loc = message?.location;
  const lat = loc?.lat;
  const lng = loc?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const stopped = useLocationLiveState(message);
  const isLive = isLiveProp && !stopped;

  const latest = useLiveLocationStore((s) => (isLive ? s.liveUpdates[String(message._id)] : null));

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = initMap(mapEl.current, { lat, lng });
    mapRef.current = map;
    const mk = L.marker([lat, lng], { icon: isLive ? liveIcon() : pinIcon() }).addTo(map);
    markerRef.current = mk;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // One-time init per message instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLive || !markerRef.current || !latest) return;
    const p = [latest.lat, latest.lng];
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    markerRef.current.setLatLng(p);
    mapRef.current?.panTo(p);
  }, [isLive, latest]);

  return (
    <div
      className="w-full max-w-[260px] select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openLocationModal(message, isLive);
        }}
        className="relative block w-full rounded-xl overflow-hidden border border-base-300/50 bg-base-100 text-left"
      >
        <div ref={mapEl} className="relative z-0 h-36 w-full pointer-events-none" />
        <div className="absolute inset-0" />
        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-[500]">
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>
        )}
        <div className="absolute bottom-2 left-2 z-[500] flex items-center gap-1 text-white text-[11px] font-semibold bg-black/50 rounded-md px-2 py-0.5 max-w-[80%] truncate">
          <MapPin size={11} />
          <span className="truncate">{loc.label || "Location"}</span>
        </div>
      </button>

      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="flex items-center gap-1 text-[10px] text-base-content/60">
          {isLive ? (
            <>
              <Clock size={10} />
              Live · {durationLabel(loc.duration)} min
            </>
          ) : (
            <>
              <MapPin size={10} />
              Location
            </>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openLocationModal(message, isLive);
          }}
          className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
        >
          View on map <MoveRight size={10} />
        </button>
      </div>
    </div>
  );
}
