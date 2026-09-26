import { useState } from "react";
import { MapPin, Navigation, Crosshair, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import { getCurrentPosition } from "../../lib/location";
import { haptic } from "../../lib/haptics";

/**
 * A place, chosen by the author.
 *
 * Nothing here reads the device's position until "Use my current location" is
 * tapped, and a place can equally be typed in. That is the point: a status
 * location is a claim the author makes, so the app never attaches one silently
 * — not in the background, not on post, and not by inferring it from a chat pin.
 */
const LocationStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("location");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [precision, setPrecision] = useState("exact");

  const useCurrent = async () => {
    haptic("tap");
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.lat, lng: pos.lng });
      // The device can be accurate to a few metres, which is more precision than
      // a status needs and more than its owner may want to give. Defaulting to
      // approximate keeps the choice explicit before anyone can see it.
      setPrecision("approximate");
      if (!name.trim()) setName("Where I am now");
    } catch (err) {
      toast.error(err?.message || "Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  const handlePost = async () => {
    if (!name.trim() && !coords) return;
    editor.setPosting(true);
    editor.setProgress(0);
    try {
      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "location",
          location: {
            lat: coords?.lat ?? 0,
            lng: coords?.lng ?? 0,
            name: name.trim(),
            address: address.trim(),
            precision,
          },
          privacy: editor.privacy,
          scheduledFor: editor.scheduledFor,
          mentions: editor.mentions,
        },
        { onDone: editor.closeAll, draftMode: editor.mode }
      );
    } finally {
      editor.setPosting(false);
    }
  };

  const canPost = Boolean(name.trim() || coords);

  return (
    <>
      <StatusEditorShell
        title="Location"
        onClose={onClose}
        onDiscard={canPost ? editor.discardDraft : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={canPost}
        footerExtra={
          <>
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        <div className="px-4 pt-4">
          {/* A still of the pin, not a live map: nothing is watched, and no map
              tiles are fetched for a status someone may only ever scroll past. */}
          <div className="relative rounded-3xl overflow-hidden bg-base-200 h-44 grid place-items-center">
            {coords ? (
              <>
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(var(--color-base-content) 1px, transparent 1px), linear-gradient(90deg, var(--color-base-content) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />
                <div className="relative flex flex-col items-center gap-1.5">
                  <span className="size-11 rounded-full bg-primary/15 grid place-items-center">
                    <MapPin size={22} className="text-primary" />
                  </span>
                  <p className="text-[11px] text-base-content/50 font-mono">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-base-content/30">
                <MapPin size={28} />
                <p className="text-xs">No place chosen</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-4 space-y-2.5">
          <div className="relative">
            <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Place name"
              className="field-flat w-full h-11 pl-10 pr-3 rounded-2xl bg-base-200 text-sm border-0"
            />
          </div>

          <div className="relative">
            <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={180}
              placeholder="Address (optional)"
              className="field-flat w-full h-11 pl-10 pr-3 rounded-2xl bg-base-200 text-sm border-0"
            />
          </div>

          <button
            onClick={useCurrent}
            disabled={locating}
            className="w-full h-11 rounded-2xl bg-base-200 text-sm font-medium text-base-content flex items-center justify-center gap-2 hover:bg-base-300 disabled:opacity-60 transition-colors"
          >
            <Crosshair size={15} className={locating ? "animate-spin" : ""} />
            {locating ? "Locating…" : coords ? "Update my location" : "Use my current location"}
          </button>

          {coords && (
            <div className="rounded-2xl border border-base-200 p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-base-content/40">Precision</p>
              <div className="flex gap-2">
                {[
                  { id: "exact", label: "Exact pin" },
                  { id: "approximate", label: "Approximate area" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      haptic("tap");
                      setPrecision(option.id);
                    }}
                    className={`flex-1 h-9 rounded-xl text-xs font-medium transition-colors ${
                      precision === option.id
                        ? "bg-primary text-primary-content"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {precision === "approximate" && (
                <p className="text-[11px] text-base-content/45 leading-relaxed">
                  Viewers see the neighbourhood, not the exact spot on the map.
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-base-content/40 text-center pt-1">
            Your location is only shared if you post this.
          </p>
        </div>
      </StatusEditorShell>

      {editor.privacyOpen && (
        <PrivacySheet
          open
          onClose={() => editor.setPrivacyOpen(false)}
          privacy={editor.privacy}
          onChange={editor.setPrivacy}
        />
      )}
      {editor.scheduleOpen && (
        <ScheduleSheet
          open
          onClose={() => editor.setScheduleOpen(false)}
          scheduledFor={editor.scheduledFor}
          onChange={editor.setScheduledFor}
        />
      )}
    </>
  );
};

export default LocationStatusEditor;
