import { useMemo, useState } from "react";
import { Clock, ChevronLeft, ChevronRight, X } from "lucide-react";

// A themed date/time picker for scheduled messages.
//
// This exists because the native `datetime-local` popup is rendered by the
// browser/OS: CSS cannot reach inside it, so on a dark theme it appears as a
// bright white panel and no styling fixes that. Everything here is ordinary
// markup using the app's own surfaces and accent, so it matches whichever of
// the 30+ themes is active.

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Local `yyyy-MM-ddTHH:mm`, matching what datetime-local produced before. */
const toLocalValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const SchedulePicker = ({ value, onConfirm, onClose }) => {
  const initial = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);

  const [viewDate, setViewDate] = useState(startOfDay(initial));
  const [selected, setSelected] = useState(startOfDay(initial));
  const [hour24, setHour24] = useState(initial.getHours());
  const [minute, setMinute] = useState(Math.floor(initial.getMinutes() / 5) * 5);

  const today = startOfDay(new Date());

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const total = new Date(year, month + 1, 0).getDate();
    const leading = new Date(year, month, 1).getDay();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)),
    ];
  }, [viewDate]);

  const combined = useMemo(() => {
    const d = new Date(selected);
    d.setHours(hour24, minute, 0, 0);
    return d;
  }, [selected, hour24, minute]);

  const isPast = combined.getTime() <= Date.now();

  const applyPreset = (date) => {
    setSelected(startOfDay(date));
    setViewDate(startOfDay(date));
    setHour24(date.getHours());
    setMinute(Math.floor(date.getMinutes() / 5) * 5);
  };

  const presets = [
    { label: "In 1 hour", at: () => new Date(Date.now() + 60 * 60 * 1000) },
    {
      label: "Tonight 8 PM",
      at: () => {
        const d = new Date();
        d.setHours(20, 0, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      label: "Tomorrow 9 AM",
      at: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const isPm = hour24 >= 12;
  const setFrom12 = (h12, pm) => setHour24((h12 % 12) + (pm ? 12 : 0));

  const selectClass =
    "bg-base-300/70 rounded-lg px-2 py-1.5 text-sm text-base-content outline-none " +
    "focus:ring-2 focus:ring-primary/40 transition-shadow";

  return (
    <div className="absolute bottom-full right-0 mb-2 z-40 w-[290px] rounded-2xl bg-base-100 shadow-2xl overflow-hidden cg-dialog">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-base-content">
          <Clock size={14} className="text-primary" />
          Schedule message
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-base-content/50 hover:text-base-content hover:bg-base-200 transition-colors"
          aria-label="Close scheduler"
        >
          <X size={15} />
        </button>
      </div>

      {/* Quick presets cover the common cases without touching the grid */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.at())}
            className="px-2.5 py-1 rounded-full bg-base-200 hover:bg-base-300 text-[11px] font-medium text-base-content/80 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Month */}
      <div className="flex items-center justify-between px-4 pb-1.5">
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="p-1 rounded-full text-base-content/60 hover:bg-base-200 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-semibold text-base-content">
          {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="p-1 rounded-full text-base-content/60 hover:bg-base-200 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-3">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-semibold text-base-content/35 py-1">
            {d}
          </span>
        ))}
        {days.map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />;
          const disabled = day < today;
          const isSelected = day.getTime() === selected.getTime();
          const isToday = day.getTime() === today.getTime();
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(day)}
              className={`h-8 rounded-lg text-xs tabular-nums transition-colors ${
                isSelected
                  ? "bg-primary text-primary-content font-semibold"
                  : disabled
                    ? "text-base-content/20 cursor-not-allowed"
                    : isToday
                      ? "text-primary font-semibold hover:bg-base-200"
                      : "text-base-content/80 hover:bg-base-200"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time — selects rather than a native time field, so no OS popup appears */}
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <select value={hour12} onChange={(e) => setFrom12(Number(e.target.value), isPm)} className={selectClass}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="text-base-content/40">:</span>
        <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className={selectClass}>
          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
          ))}
        </select>
        <select value={isPm ? "pm" : "am"} onChange={(e) => setFrom12(hour12, e.target.value === "pm")} className={selectClass}>
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
      </div>

      <div className="px-4 pt-3 pb-4">
        {isPast && (
          <p className="mb-2 text-[11px] text-error">That time has already passed.</p>
        )}
        <button
          type="button"
          disabled={isPast}
          onClick={() => onConfirm(toLocalValue(combined))}
          className="w-full h-10 rounded-xl bg-primary text-primary-content text-[13px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          Schedule
        </button>
      </div>
    </div>
  );
};

export default SchedulePicker;
