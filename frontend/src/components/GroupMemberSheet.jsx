import { useEffect, useState } from "react";
import {
  X, ShieldAlert, ShieldCheck, CalendarDays, MessageSquare, StickyNote, Loader,
} from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import SocialLinksRow from "./SocialLinksRow";
import { useNicknames, displayNameOf } from "../lib/contacts";
import { formatJoinDate, activityLabel, isOnlineNow } from "../lib/members";
import { haptic } from "../lib/haptics";

// A member's profile as seen from inside a group.
//
// The member list only ever showed a name and a bio line, so there was nowhere
// to see who someone actually is without leaving the group. This brings together
// what the group already knows — role, join date, presence — with the profile
// fields the server now returns for members, plus a private note that only the
// viewer can see.

const ROLE = {
  admin: { label: "Admin", icon: ShieldAlert, className: "text-red-500" },
  moderator: { label: "Moderator", icon: ShieldCheck, className: "text-amber-500" },
  member: { label: "Member", icon: null, className: "t-dim" },
};

const GroupMemberSheet = ({ member, onClose }) => {
  const { authUser, onlineUsers } = useAuthStore();
  const { setSelectedUser } = useChatStore();
  const { selectedGroup, setSelectedGroup, setIsGroupDetailsModalOpen, setMemberNote } = useGroupStore();
  const nicknames = useNicknames();

  const user = member?.user;

  const [note, setNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // Seeded from authUser, which is where notes live — they belong to the reader,
  // not to the person being read about.
  useEffect(() => {
    const existing = authUser?.memberNotes?.[user?._id] || "";
    setNote(existing);
    setNoteOpen(Boolean(existing));
  }, [authUser?.memberNotes, user?._id]);

  if (!user) return null;

  const isSelf = user._id === authUser?._id;
  const role = ROLE[member.role] || ROLE.member;
  const RoleIcon = role.icon;
  const activity = activityLabel(user, onlineUsers);
  const joined = formatJoinDate(member.joinedAt);
  const online = isOnlineNow(user, onlineUsers);
  const savedNote = authUser?.memberNotes?.[user._id] || "";

  const saveNote = async () => {
    setIsSavingNote(true);
    await setMemberNote(selectedGroup._id, user._id, note);
    setIsSavingNote(false);
  };

  const messagePrivately = () => {
    haptic("tap");
    // The group and its modal close first, or the DM opens behind both of them.
    setIsGroupDetailsModalOpen(false);
    setSelectedGroup(null);
    setSelectedUser(user);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm cg-fade"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-base-100 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] cg-sheet sm:cg-dialog overflow-hidden">

        {/* Banner, with the avatar overlapping it. The avatar sits above so a
            busy cover never washes over the face — the same order the contact
            info panel settled on. */}
        <div className="relative shrink-0">
          <div
            className="w-full h-24"
            style={
              user.bannerPic
                ? { backgroundImage: `url(${user.bannerPic})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))" }
            }
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute grid top-3 right-3 size-8 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="px-5 -mt-9">
            <div className="relative inline-block">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullName}
                className="rounded-full size-[72px] object-cover ring-4 ring-base-100"
              />
              {online && (
                <span className="absolute rounded-full bottom-0.5 right-0.5 size-3.5 bg-green-500 ring-2 ring-base-100" />
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pt-3 pb-5 overflow-y-auto">
          {/* Identity */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[19px] font-bold tracking-tight truncate text-base-content">
                {displayNameOf(user, nicknames)}
                {isSelf && <span className="ml-2 text-[12px] font-medium t-dim">You</span>}
              </h3>
              {activity && <p className="mt-0.5 text-[13px] t-dim">{activity}</p>}
            </div>
            <span className={`flex items-center gap-1.5 text-[12px] font-semibold shrink-0 ${role.className}`}>
              {RoleIcon && <RoleIcon size={14} />}
              {role.label}
            </span>
          </div>

          {user.bio && (
            <p className="mt-3 text-[14px] leading-relaxed t-muted whitespace-pre-wrap">{user.bio}</p>
          )}

          {(user.link || user.socialLinks) && (
            <div className="mt-3">
              <SocialLinksRow user={user} />
            </div>
          )}

          {/* Facts the group itself knows */}
          <div className="mt-4 overflow-hidden rounded-2xl s-chip">
            {joined && (
              <div className="flex items-center gap-3 px-4 py-3">
                <CalendarDays size={16} className="t-dim shrink-0" />
                <span className="text-[13.5px] t-muted">{joined}</span>
              </div>
            )}
            {user.email && (
              <div className={`flex items-center gap-3 px-4 py-3 ${joined ? "s-sep" : ""}`}>
                <span className="text-[13.5px] truncate t-muted">{user.email}</span>
              </div>
            )}
          </div>

          {/* Private note. Labelled explicitly, because a note nobody else can
              see is only useful if you trust that nobody else can see it. */}
          {!isSelf && (
            <div className="mt-4">
              {!noteOpen ? (
                <button
                  type="button"
                  onClick={() => { haptic("tap"); setNoteOpen(true); }}
                  className="flex items-center w-full gap-2 px-4 py-3 text-left rounded-2xl s-chip s-row"
                >
                  <StickyNote size={16} className="t-dim shrink-0" />
                  <span className="text-[13.5px] t-muted">Add a private note</span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl s-chip">
                  <div className="flex items-center gap-2">
                    <StickyNote size={14} className="t-dim" />
                    <span className="text-[11px] uppercase tracking-wider font-bold t-faint">
                      Private note — only you can see this
                    </span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="How you know them, what they handle…"
                    className="w-full mt-2 px-0 py-1 text-[14px] bg-transparent border-0 border-b border-base-300 rounded-none resize-none outline-none focus:border-primary transition-colors text-base-content"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] t-faint">{note.length}/500</span>
                    <div className="flex items-center gap-2">
                      {savedNote && (
                        <button
                          type="button"
                          onClick={() => { setNote(""); setMemberNote(selectedGroup._id, user._id, ""); }}
                          className="px-3 h-8 rounded-xl text-[12.5px] font-medium t-dim hover:text-error transition-colors"
                        >
                          Remove
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={saveNote}
                        disabled={isSavingNote || note === savedNote}
                        className="px-4 h-8 rounded-xl bg-primary text-primary-content text-[12.5px] font-semibold disabled:opacity-40 active:scale-95 transition-transform flex items-center gap-1.5"
                      >
                        {isSavingNote && <Loader size={12} className="animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isSelf && (
            <button
              type="button"
              onClick={messagePrivately}
              className="flex items-center justify-center w-full h-12 gap-2 mt-4 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold active:scale-[0.98] transition-transform"
            >
              <MessageSquare size={17} />
              Message privately
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupMemberSheet;
