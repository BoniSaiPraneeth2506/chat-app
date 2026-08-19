import { Image as ImageIcon, Video, FileText, User } from "lucide-react";

/**
 * What the paperclip opens.
 *
 * Two shapes for the same four choices, because the two platforms expect
 * different things: a sheet rising from the bottom of a phone, and a small menu
 * next to the composer on a desktop. Rendered together and switched with the
 * existing lg: breakpoint rather than measured at runtime, so neither has to wait
 * for a resize observer to decide what it is.
 *
 * Gallery keeps the composer's existing photo picker exactly as it was —
 * Cloudinary, unchanged. Only the other three go to the bucket.
 */

const ITEMS = [
  {
    id: "gallery",
    label: "Gallery",
    hint: "Photos, as before",
    Icon: ImageIcon,
    tint: "#7c5cff",
  },
  {
    id: "video",
    label: "Videos",
    hint: "Send a large video",
    Icon: Video,
    tint: "#e0466f",
  },
  {
    id: "document",
    label: "Document",
    hint: "PDF, Word, Excel, zip",
    Icon: FileText,
    tint: "#4f7bf0",
  },
  {
    id: "contact",
    label: "Contact",
    hint: "Share someone's card",
    Icon: User,
    tint: "#12a37a",
  },
];

const AttachMenu = ({ onPick, onClose }) => (
  <>
    {/* Mobile: a sheet, with the grid of round tiles the platform uses. */}
    <div
      className="fixed inset-0 z-[150] flex items-end lg:hidden bg-black/45 cg-fade"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] px-5 rounded-t-3xl bg-base-100 cg-sheet">
        <span className="block mx-auto mb-4 h-1 w-10 rounded-full bg-base-300" />
        <div className="grid grid-cols-4 gap-3">
          {ITEMS.map(({ id, label, Icon, tint }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="flex flex-col items-center gap-2 transition-transform active:scale-95"
            >
              <span
                className="grid rounded-full size-14 place-items-center"
                style={{ backgroundColor: `${tint}26`, color: tint }}
              >
                <Icon size={22} />
              </span>
              <span className="text-[11px] font-medium text-center text-base-content">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Desktop: a menu beside the composer, closed by clicking anywhere else. */}
    <div className="hidden lg:block">
      <div className="fixed inset-0 z-[140]" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-[150] mb-2 w-56 overflow-hidden rounded-2xl bg-base-100 shadow-2xl cg-dialog">
        {ITEMS.map(({ id, label, hint, Icon, tint }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="flex items-center w-full gap-3 px-3.5 py-2.5 text-left transition-colors s-row"
          >
            <span
              className="grid rounded-full size-9 shrink-0 place-items-center"
              style={{ backgroundColor: `${tint}26`, color: tint }}
            >
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium truncate text-base-content">
                {label}
              </span>
              <span className="block text-[11px] truncate t-dim">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  </>
);

export default AttachMenu;
