import { useState } from "react";
import { X, Clock, Calendar } from "lucide-react";
import { haptic } from "../../lib/haptics";

/**
 * When a status should go out.
 *
 * Times are chosen as offsets rather than a date grid because a status is
 * something you post in the next few minutes or hours, and the server stores an
 * absolute instant either way. A hand-typed date in the past is refused by the
 * server; this only offers choices that are in the future.
 */
const QUICK = [
  { label: "In 15 minutes", ms: 15 * 60 * 1000 },
  { label: "In 1 hour", ms: 60 * 60 * 1000 },
  { label: "In 3 hours", ms: 3 * 60 * 60 * 1000 },
  { label: "Tomorrow morning", ms: null },
  { label: "Tomorrow evening", ms: null },
];

const nextMorning = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
};

const nextEvening = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
};

const ScheduleSheet = ({ open, onClose, scheduledFor, onChange }) => {
  const [custom, setCustom] = useState("");

  if (!open) return null;

  const clear = () => {
    haptic("tap");
    onChange(null);
    onClose();
  };

  const pick = (date) => {
    haptic("tap");
    onChange(date.toISOString());
    onClose();
  };

  const pickCustom = () => {
    if (!custom) return;
    const date = new Date(custom);
    if (Number.isNaN(date.getTime())) return;
    if (date.getTime() <= Date.now()) return;
    pick(date);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
          <h3 className="text-base font-semibold text-base-content flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            Schedule status
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-base-200 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-base-content/60" />
          </button>
        </div>

        <div className="px-3 py-3 space-y-0.5">
          {QUICK.map((option) => {
            const date =
              option.ms !== null
                ? new Date(Date.now() + option.ms)
                : option.label === "Tomorrow morning"
                ? nextMorning()
                : nextEvening();
            const active = scheduledFor && new Date(scheduledFor).getTime() === date.getTime();
            return (
              <button
                key={option.label}
                onClick={() => pick(date)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors text-left ${
                  active ? "bg-primary/10" : "hover:bg-base-200/70"
                }`}
              >
                <span className="size-9 rounded-xl bg-base-200 grid place-items-center flex-shrink-0">
                  <Calendar size={16} className="text-base-content/50" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-base-content">
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-base-content/50">
                    {date.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-base-200">
            <label className="block px-3 py-2 text-xs font-medium text-base-content/50">
              Or pick a date and time
            </label>
            <div className="flex gap-2 px-3 pb-2">
              <input
                type="datetime-local"
                value={custom}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                onChange={(e) => setCustom(e.target.value)}
                className="field-flat flex-1 h-10 px-3 rounded-xl bg-base-200 text-sm text-base-content border-0"
              />
              <button
                onClick={pickCustom}
                disabled={!custom}
                className="h-10 px-4 rounded-xl bg-primary text-primary-content text-sm font-medium disabled:opacity-40"
              >
                Set
              </button>
            </div>
          </div>
        </div>

        {scheduledFor && (
          <div className="px-5 py-3.5 border-t border-base-200">
            <button
              onClick={clear}
              className="w-full h-11 rounded-2xl bg-base-200 text-base-content font-semibold text-sm hover:bg-base-300 transition-colors"
            >
              Post now instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleSheet;
