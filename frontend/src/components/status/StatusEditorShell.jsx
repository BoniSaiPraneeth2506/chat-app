import { useEffect, useMemo, useRef, useState } from "react";import { X, Send, Calendar, Users, Lock, Globe, Heart, UserCheck, ChevronDown } from "lucide-react";
import { useStatusStore } from "../../store/useStatusStore";
import { useChatStore } from "../../store/useChatStore";
import useAuthStore from "../../store/useAuthStore";
import { haptic } from "../../lib/haptics";
import toast from "react-hot-toast";
import { saveStatusDraft, deleteStatusDraft, getStatusDraft, onStatusDraftsChanged, makeDraftThumbnail } from "../../lib/statusDrafts";
import PrivacySheet from "./PrivacySheet";

/**
 * The frame every status editor sits in.
 *
 * All eleven editors need the same four things — a close affordance, a post
 * button, an audience, and a way to keep or discard the draft — and getting
 * them subtly different in each editor is how a privacy picker ends up missing
 * from one of them. So they are here once, and an editor supplies only its own
 * middle.
 */
const StatusEditorShell = ({
  title,
  onClose,
  onDiscard,
  onPost,
  postLabel = "Post",
  posting = false,
  progress = 0,
  children,
  footerExtra,
  canPost = true,
}) => (
  <div className="fixed inset-0 z-[115] flex flex-col bg-base-100 animate-in fade-in duration-200">
    <div className="flex items-center justify-between px-4 py-3 border-b border-base-200 flex-shrink-0">
      <button
        onClick={onClose}
        className="p-2 -ml-2 rounded-full hover:bg-base-200 transition-colors"
        aria-label="Close editor"
      >
        <X size={20} className="text-base-content/70" />
      </button>
      <h3 className="text-sm font-semibold text-base-content flex-1 text-center">{title}</h3>
      <div className="flex items-center gap-1.5">
        {onDiscard && (
          <button
            onClick={onDiscard}
            className="px-2.5 py-1.5 rounded-full text-xs font-medium text-base-content/50 hover:text-red-500 hover:bg-base-200 transition-colors"
          >
            Discard
          </button>
        )}
        {footerExtra}
      </div>
    </div>

    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>

    <div className="flex-shrink-0 border-t border-base-200 bg-base-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {posting && (
        <div className="mb-2.5">
          <div className="flex justify-between text-xs text-base-content/50 mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      <button
        onClick={onPost}
        disabled={!canPost || posting}
        className="w-full h-11 rounded-2xl bg-primary text-primary-content font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={16} />
        {posting ? "Posting…" : postLabel}
      </button>
    </div>
  </div>
);

export default StatusEditorShell;

export const useStatusEditor = (mode, { summaryOf } = {}) => {
  const createStatus = useStatusStore((s) => s.createStatus);
  const setCreateOpen = useStatusStore((s) => s.setCreateOpen);
  const setCreateMode = useStatusStore((s) => s.setCreateMode);
  const defaultPrivacy = useStatusStore((s) => s.defaultPrivacy);

  const [privacy, setPrivacy] = useState({ mode: defaultPrivacy, include: [], exclude: [] });
  const [scheduledFor, setScheduledFor] = useState(null);
  const [mentions, setMentions] = useState([]);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => Boolean(getStatusDraft(mode)));

  // Drafts live in localStorage, so the flag has to be re-read when they change
  // — including when this very editor saved or discarded one.
  useEffect(() => onStatusDraftsChanged(() => setHasDraft(Boolean(getStatusDraft(mode)))), [mode]);

  // The default can arrive after the editor mounts (the sheet fetches settings
  // when it opens), so adopt it until the author picks something themselves.
  const privacyTouched = useRef(false);

  // A draft's recipe is restored once on open. Privacy, schedule and mentions
  // apply to every editor type, so they are restored here rather than once per
  // editor; the author's own fields are restored by each editor that has any.
  // Marking privacy as "touched" keeps a late-arriving default from overwriting
  // a choice the author explicitly made and then reopened.
  useEffect(() => {
    const draft = getStatusDraft(mode);
    if (!draft) return;
    let touched = false;
    if (draft.privacy) {
      setPrivacy(draft.privacy);
      touched = true;
    }
    if (draft.scheduledFor) setScheduledFor(draft.scheduledFor);
    if (Array.isArray(draft.mentions)) setMentions(draft.mentions);
    if (touched) privacyTouched.current = true;
  }, [mode]);

  useEffect(() => {
    if (!privacyTouched.current) {
      setPrivacy((p) => ({ ...p, mode: defaultPrivacy }));
    }
  }, [defaultPrivacy]);

  const closeAll = () => {
    setCreateOpen(false);
    setCreateMode(null);
  };

  const saveDraft = async (draft, { thumbnailFile } = {}) => {
    try {
      const thumbnail = await makeDraftThumbnail(thumbnailFile);
      saveStatusDraft(mode, {
        ...(summaryOf ? { summary: summaryOf(draft) } : {}),
        ...draft,
        privacy,
        scheduledFor,
        mentions,
        thumbnail,
      });
    } catch (err) {
      console.warn("Could not save draft:", err);
    }
  };

  const discardDraft = () => {
    deleteStatusDraft(mode);
    closeAll();
  };

  return {
    mode,
    privacy,
    setPrivacy: (next) => {
      privacyTouched.current = true;
      setPrivacy(next);
    },
    scheduledFor,
    setScheduledFor,
    mentions,
    setMentions,
    posting,
    setPosting,
    progress,
    setProgress,
    privacyOpen,
    setPrivacyOpen,
    scheduleOpen,
    setScheduleOpen,
    closeAll,
    saveDraft,
    discardDraft,
    hasDraft,
    defaultPrivacy,
    createStatus,
  };
};

const PRIVACY_META = {
  everyone: { label: "Everyone", icon: Globe, hint: "Any Chatty account" },
  contacts: { label: "My contacts", icon: Users, hint: "People you've chatted with" },
  closeFriends: { label: "Close friends", icon: Heart, hint: "Your close friends list" },
  only: { label: "Only share with", icon: UserCheck, hint: "Chosen people" },
  except: { label: "Except", icon: Lock, hint: "Everyone except chosen people" },
};

export const PRIVACY_OPTIONS = Object.entries(PRIVACY_META).map(([mode, meta]) => ({
  mode,
  ...meta,
}));

export { PRIVACY_META };

/**
 * The audience button that sits in an editor's header.
 *
 * Deliberately always visible. The audience is the one part of a status that is
 * not obvious from looking at it, and it is the part that decides who sees it —
 * so it is a control, not a detail buried in a settings screen.
 */
export const PrivacyButton = ({ privacy, onClick }) => {
  const meta = PRIVACY_META[privacy?.mode] || PRIVACY_META.contacts;
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-base-200 hover:bg-base-300 transition-colors text-xs font-medium text-base-content"
      title={meta.hint}
    >
      <Icon size={13} className="text-primary" />
      <span className="hidden sm:inline">{meta.label}</span>
      <ChevronDown size={12} className="text-base-content/40" />
    </button>
  );
};

export const ScheduleButton = ({ scheduledFor, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors text-xs font-medium ${
      scheduledFor
        ? "bg-primary text-primary-content"
        : "bg-base-200 hover:bg-base-300 text-base-content"
    }`}
  >
    <Calendar size={13} />
    <span className="hidden sm:inline">
      {scheduledFor ? "Scheduled" : "Schedule"}
    </span>
  </button>
);

export { PrivacySheet };

/** Uploads one file through the shared presigned flow, reporting progress. */
export const uploadStatusFile = async (file, { onProgress } = {}) => {
  const { fetchUploadLimits, validateFile, uploadAttachment, kindFor } = await import(
    "../../lib/attachments"
  );
  const limits = await fetchUploadLimits();
  const validation = validateFile(file, limits);
  if (!validation.valid) throw new Error(validation.reason);
  return uploadAttachment({ file, kind: kindFor(file, limits), onProgress });
};

/** The auth user, for editors that show an avatar. */
export const useMyUser = () => useAuthStore((s) => s.authUser);

/** Everyone the author already has in a conversation — the picker universe. */
export const useStatusCandidates = () => {
  const users = useChatStore((s) => s.users);
  const authUser = useAuthStore((s) => s.authUser);
  return useMemo(
    () => (users || []).filter((u) => u?._id !== authUser?._id),
    [users, authUser?._id]
  );
};

/**
 * Posts and reports the outcome once.
 *
 * The success/failure toast lives here rather than in each editor so eleven
 * editors cannot drift into eleven different wordings, and so a rejected upload
 * and a rejected status look the same to the author. `draftMode` is the editor's
 * own identity, which is not always the posted type — a photo editor posts
 * `image` or `video` but its draft is filed under `photo`.
 */
export const postStatusWithFeedback = async (
  createStatus,
  payload,
  { onDone, draftMode } = {}
) => {
  try {
    haptic("success");
    await createStatus(payload);
    deleteStatusDraft(draftMode || payload.type);
    toast.success("Status posted!");
    onDone?.();
    return true;
  } catch (err) {
    console.error("Error posting status:", err);
    toast.error(err?.message || "Failed to post status");
    return false;
  }
};
