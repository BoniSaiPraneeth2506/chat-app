import { Clock, Archive, RotateCcw, Trash2 } from "lucide-react";
import { formatTimeAgo } from "../../lib/statusFormat";

/**
 * The rows for a scheduled or archived statuses page.
 *
 * Kept as one component so the two screens cannot drift apart in how a status
 * looks or what an action means. Like the Updates cards, it deliberately never
 * shows a status's content — only what kind it was and when it is going out or
 * went out.
 */

const TYPE_LABEL = {
  image: "Photo",
  video: "Video",
  layout: "Layout",
  text: "Text",
  voice: "Voice",
  music: "Music",
  poll: "Poll",
  question: "Question",
  link: "Link",
  location: "Location",
  countdown: "Countdown",
};

const describe = (status) => TYPE_LABEL[status?.type] || "Status";

const whenLabel = (iso) => {
  if (!iso) return "";
  const then = new Date(iso);
  const diffMin = Math.round((then.getTime() - Date.now()) / 60000);
  if (Math.abs(diffMin) < 1) return "now";
  if (diffMin > 0) {
    if (diffMin < 60) return `in ${diffMin}m`;
    if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)}h`;
    return `in ${Math.round(diffMin / 1440)}d`;
  }
  const ago = Math.abs(diffMin);
  if (ago < 60) return `${ago}m ago`;
  if (ago < 60 * 24) return `${Math.round(ago / 60)}h ago`;
  return `${Math.round(ago / 1440)}d ago`;
};

const ManagedStatusList = ({
  tab = "scheduled",
  statuses = [],
  loading = false,
  busyId = null,
  onRestore,
  onDelete,
}) => {
  const isScheduled = tab === "scheduled";
  const Icon = isScheduled ? Clock : Archive;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-base-content/40">
        <Icon size={24} />
        <span className="text-sm">{isScheduled ? "Nothing scheduled" : "Nothing archived"}</span>
        <span className="text-[11px] text-center px-8 leading-relaxed max-w-sm">
          {isScheduled
            ? "A status you schedule waits here until its moment, and is not visible to anyone before then."
            : "Statuses you choose to keep after they expire are collected here."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {statuses.map((status) => (
        <div
          key={status._id}
          className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-base-200/60 transition-colors"
        >
          <span className="size-11 rounded-xl bg-base-200 grid place-items-center flex-shrink-0">
            <Icon size={16} className="text-base-content/50" />
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-base-content truncate">
              {describe(status)}
            </p>
            <p className="text-[11px] text-base-content/50">
              {isScheduled
                ? `Goes out ${whenLabel(status.scheduledFor)}`
                : `Posted ${formatTimeAgo(status.createdAt)}`}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {!isScheduled && (
              <button
                onClick={() => onRestore?.(status._id)}
                disabled={busyId === status._id}
                className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                aria-label="Restore status"
                title="Post this again"
              >
                <RotateCcw size={15} />
              </button>
            )}
            <button
              onClick={() => onDelete?.(status._id)}
              disabled={busyId === status._id}
              className="p-2 rounded-full text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              aria-label="Delete status"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ManagedStatusList;