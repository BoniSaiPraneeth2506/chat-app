import { useMemo, useState } from "react";
import { Search, X, User } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import { useNicknames, displayNameOf } from "../lib/contacts";

/**
 * Choosing a contact to share.
 *
 * The list is the people already in this account's chats, not the phone's address
 * book. Reading the device's contacts needs a native permission and a Play Store
 * disclosure, and it is not what is useful here: what someone wants from "share a
 * contact" in a chat app is to hand over somebody the other person can then
 * message, which means an account rather than a phone number.
 */
const ContactPickerSheet = ({ onPick, onClose }) => {
  const { users } = useChatStore();
  const { authUser } = useAuthStore();
  const nicknames = useNicknames();
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (users || [])
      .filter((user) => user._id !== authUser?._id) // sharing yourself is not it
      .filter((user) =>
        term ? displayNameOf(user, nicknames).toLowerCase().includes(term) : true
      );
  }, [users, authUser?._id, nicknames, query]);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm cg-fade"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm overflow-hidden shadow-2xl bg-base-100 rounded-t-3xl sm:rounded-3xl cg-sheet sm:cg-dialog">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="grid rounded-xl size-9 place-items-center s-tile shrink-0">
            <User size={16} className="text-primary" />
          </span>
          <h3 className="flex-1 text-[15px] font-semibold text-base-content">
            Share a contact
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn grid size-8 shrink-0 place-items-center rounded-full"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute -translate-y-1/2 left-4 top-1/2 size-4 text-base-content/40 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your chats..."
              className="field-flat w-full h-10 pl-11 pr-4 rounded-full border-0 bg-base-200 text-sm text-base-content ph-dim"
            />
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto pb-2">
          {candidates.length === 0 ? (
            <p className="px-6 py-10 text-[13px] text-center t-muted">
              {query.trim() ? "No one matches that" : "No contacts to share yet"}
            </p>
          ) : (
            candidates.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => onPick(user)}
                className="flex items-center w-full gap-3 px-4 py-2.5 text-left s-row"
              >
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt=""
                  className="object-cover rounded-full size-10 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium truncate text-base-content">
                    {displayNameOf(user, nicknames)}
                  </span>
                  <span className="block text-[11.5px] truncate t-dim">{user.email}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPickerSheet;
