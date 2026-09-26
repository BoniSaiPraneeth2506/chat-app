import { useEffect, useRef } from "react";
import { useStatusStore } from "../store/useStatusStore";
import useAuthStore from "../store/useAuthStore";
import {
  Plus,
  Play,
  Type,
  Mic,
  Music4,
  BarChart3,
  HelpCircle,
  Link2,
  MapPin,
  Timer,
  LayoutGrid,
} from "lucide-react";
import { haptic } from "../lib/haptics";
import { StatusCardsSkeleton } from "./skeletons/Skeleton";
import { useSkeletonGate } from "../hooks/useSkeletonGate";
import { resolveStatusType } from "../lib/statusFormat";


/**
 * The latest status in a group, i.e. the one the card previews.
 *
 * The list endpoint sorts `createdAt` ascending and the `status:new` socket
 * event appends, so the newest is always last.
 */
const latestOf = (group) => group?.statuses?.[group.statuses.length - 1] || null;

/**
 * What to paint as the card's background.
 *
 * Image statuses carry a pre-signed URL from the list response, so they can be
 * shown directly. Videos have no poster in the schema, so they fall back to a
 * dimmed copy of the author's own avatar — a real frame rather than a grey
 * box — with a play badge on top. Anything with no usable frame gets a themed
 * plate instead, described by its own type.
 */
const cardPreview = (status, avatar) => {
  if (status?.media?.type === "image" && status.media.url) {
    return { src: status.media.url, kind: "photo" };
  }
  if (status?.media?.type === "video" && avatar) {
    return { src: avatar, kind: "video" };
  }
  // A layout's first photo is its `media`, so it previews like a photo does —
  // the badge below says how many more there are.
  if (status?.type === "layout" && status.media?.url) {
    return { src: status.media.url, kind: "layout" };
  }
  return { src: null, kind: "none" };
};

/**
 * The plate for a status with no frame of its own.
 *
 * A plate says what *kind* of status this is and nothing else. It deliberately
 * does not carry the content — not the text, not the poll question, not the link
 * title, not the place, not the track name. The row sits at the top of the chat
 * list, so anything a status says would be on screen for whoever happens to be
 * looking at the app, in a list they did not open and cannot dismiss. The
 * content belongs to the viewer, which is the only place someone has actually
 * chosen to see it.
 *
 * So every entry here is a fixed label chosen by us, never a string from the
 * status. If a new type is added it gets a label and an icon, and still no
 * content.
 */
/** One wash per type, so two different types never look like each other. */
const PLATE_THEME = {
  text: "linear-gradient(150deg, #0b1b3a, #1e3a8a)",
  voice: "linear-gradient(150deg, #0f2027, #2c5364)",
  music: "linear-gradient(150deg, #7f00ff, #e100ff)",
  poll: "linear-gradient(150deg, #4f46e5, #7c3aed)",
  question: "linear-gradient(150deg, #7c3aed, #c026d3)",
  link: "linear-gradient(150deg, #1e293b, #334155)",
  location: "linear-gradient(150deg, #0d9488, #06b6d4)",
  countdown: "linear-gradient(150deg, #d97706, #f59e0b)",
};

const plateFor = (status) => {
  switch (resolveStatusType(status)) {
    case "text":
      return { icon: Type, label: "Text" };
    case "voice":
      return { icon: Mic, label: "Voice" };
    case "music":
      return { icon: Music4, label: "Music" };
    case "poll":
      return { icon: BarChart3, label: "Poll" };
    case "question":
      return { icon: HelpCircle, label: "Question" };
    case "link":
      return { icon: Link2, label: "Link" };
    case "location":
      return { icon: MapPin, label: "Location" };
    case "countdown":
      return { icon: Timer, label: "Countdown" };
    default:
      // Photos and videos have their own frame, so they do not get a plate.
      return null;
  }
};

const StatusRow = () => {
  const {
    statusGroups,
    isLoadingStatuses,
    fetchStatuses,
    subscribeToStatusEvents,
    unsubscribeFromStatusEvents,
    openStatusGroup,
    setCreateOpen,
  } = useStatusStore();
  const authUser = useAuthStore((s) => s.authUser);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchStatuses();
    subscribeToStatusEvents();
    return () => unsubscribeFromStatusEvents();
  }, [fetchStatuses, subscribeToStatusEvents, unsubscribeFromStatusEvents]);

  // Skeleton until the first fetch settles — the flag alone starts out false,
  // which would flash an empty strip for a frame. Declared above the authUser
  // early return so it is not a conditional hook.
  const pending = useSkeletonGate(isLoadingStatuses);

  if (!authUser) return null;

  const ownGroup = statusGroups.find((g) => g.isOwn);
  const otherGroups = statusGroups.filter((g) => !g.isOwn);

  const handleOwnStatusClick = () => {
    haptic("tap");
    if (ownGroup && ownGroup.statuses.length > 0) {
      openStatusGroup(ownGroup, 0);
    } else {
      setCreateOpen(true);
    }
  };

  const handleOtherStatusClick = (group) => {
    haptic("tap");
    openStatusGroup(group, 0);
  };

  const hasOwnStatus = ownGroup && ownGroup.statuses.length > 0;
  const ownAllViewed = hasOwnStatus
    ? ownGroup.statuses.every((s) =>
        s.viewers?.some((v) => (v.user?._id || v.user)?.toString() === authUser._id?.toString())
      )
    : false;

  const renderCard = ({
    key,
    name,
    avatar,
    latest,
    unseen,
    onClick,
    showAdd,
  }) => {
    const preview = cardPreview(latest, avatar);
    const plate = preview.kind === "none" ? plateFor(latest) : null;
    const PlateIcon = plate?.icon;
    // The caption is content too, so it is not on the card either — same reason
    // the plate carries only a type label. A photo card is a photo and a name.
    const layoutCount =
      latest?.type === "layout"
        ? (latest.mediaItems?.length || 0) + (latest.media?.key ? 1 : 0)
        : 0;

    return (
      <button
        key={key}
        onClick={onClick}
        className="status-card"
        aria-label={name}
      >
        {preview.src ? (
          <img
            src={preview.src}
            alt=""
            className={`status-card-media${
              preview.kind === "video" ? " status-card-media-dim" : ""
            }`}
            loading="lazy"
            decoding="async"
          />
        ) : plate ? (
          <span
            className="status-card-plate"
            style={{ background: PLATE_THEME[status?.type] || "#334155" }}
          >
            <span className="status-card-plate-icon">
              <PlateIcon size={13} />
            </span>
            <span className="status-card-plate-text">{plate.label}</span>
          </span>
        ) : (
          <span className="status-card-media status-card-media-wash" aria-hidden="true" />
        )}

        {preview.kind === "video" && (
          <span className="status-card-play" aria-hidden="true">
            <Play size={11} fill="currentColor" strokeWidth={0} />
          </span>
        )}

        {layoutCount > 1 && (
          <span className="status-card-count" aria-hidden="true">
            <LayoutGrid size={9} className="inline mr-0.5 align-[-1px]" />
            {layoutCount}
          </span>
        )}

        {/* Legibility scrim, then the name on top of it. */}
        <span className="status-card-scrim" aria-hidden="true" />
        <span className="status-card-name">{name}</span>

        {/* Small avatar, ringed blue while unseen and grey once seen — the same
            group.hasUnseen the circular row used. Nothing here marks a status
            viewed; that still only happens when a card is tapped. */}
        <span
          className={`status-card-avatar ${unseen ? "is-unseen" : "is-seen"}`}
        >
          <span className="status-card-avatar-inner">
            <img src={avatar || "/avatar.png"} alt="" />
          </span>
          {showAdd && (
            <span className="status-card-add">
              <Plus size={11} strokeWidth={3.2} />
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="w-full border-b border-base-200">
      <div ref={scrollRef} className="status-strip no-scrollbar">
        {pending ? (
          <StatusCardsSkeleton count={4} />
        ) : (
          <>
            {/* My Status — always first. */}
            {renderCard({
              key: "my-status",
              name: "My Status",
              avatar: authUser.profilePic,
              latest: latestOf(ownGroup),
              unseen: Boolean(hasOwnStatus) && !ownAllViewed,
              onClick: handleOwnStatusClick,
              showAdd: !hasOwnStatus,
            })}

            {/* Other users' statuses */}
            {otherGroups.map((group) =>
              renderCard({
                key: group.user?._id,
                name: group.user?.fullName?.split(" ")[0] || "User",
                avatar: group.user?.profilePic,
                latest: latestOf(group),
                unseen: group.hasUnseen,
                onClick: () => handleOtherStatusClick(group),
                showAdd: false,
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StatusRow;
