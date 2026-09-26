import { useEffect, useRef } from "react";
import { useStatusStore } from "../store/useStatusStore";
import useAuthStore from "../store/useAuthStore";
import { Plus, Play } from "lucide-react";
import { haptic } from "../lib/haptics";
import { StatusCardsSkeleton } from "./skeletons/Skeleton";
import { useSkeletonGate } from "../hooks/useSkeletonGate";

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
 * wash, and its caption is written over it.
 */
const cardPreview = (status, avatar) => {
  if (status?.media?.type === "image" && status.media.url) {
    return { src: status.media.url, kind: "photo" };
  }
  if (status?.media?.type === "video" && avatar) {
    return { src: avatar, kind: "video" };
  }
  return { src: null, kind: "none" };
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
        s.viewers?.some((v) => (v.user?._id || v.user) === authUser._id)
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
    // A status is media plus an optional caption — there is no text-only type in
    // the schema. So when there is no frame to show, the caption is the only
    // preview there is, and it stands in for one.
    const fallbackCaption = preview.kind === "none" ? latest?.caption : "";

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
        ) : (
          <span className="status-card-media status-card-media-wash" aria-hidden="true" />
        )}

        {preview.kind === "video" && (
          <span className="status-card-play" aria-hidden="true">
            <Play size={11} fill="currentColor" strokeWidth={0} />
          </span>
        )}

        {/* Legibility scrim, then the name on top of it. */}
        <span className="status-card-scrim" aria-hidden="true" />
        {fallbackCaption && (
          <span className="status-card-caption">{fallbackCaption}</span>
        )}
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
