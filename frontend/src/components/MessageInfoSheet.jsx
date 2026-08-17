import { useEffect, useState } from "react";
import { X, Check, CheckCheck, Clock } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { formatMessageTime } from "../lib/utils";

// "Message info" — who has seen a message you sent.
//
// Read state is derived from the `lastReadAt` map the server already keeps for
// unread counts, so the timestamp shown is when that person last opened the
// conversation. For the most recent message that is the read time; for an older
// one the real read may have been earlier. The sheet says so rather than
// implying a precision the data does not have.
//
// Delivery is not tracked anywhere in the app, so there is no "Delivered" row —
// showing one would mean inventing it.

const Row = ({ person, showTime }) => (
  <div className="flex items-center gap-3 px-4 py-2.5">
    <img
      src={person.profilePic || "/avatar.png"}
      alt={person.fullName}
      className="w-9 h-9 rounded-full object-cover shrink-0"
    />
    <span className="flex-1 text-sm font-medium text-base-content truncate">
      {person.fullName}
    </span>
    {showTime && person.readAt && (
      <span className="text-[11px] text-base-content/50 tabular-nums shrink-0">
        {formatMessageTime(person.readAt)}
      </span>
    )}
  </div>
);

const MessageInfoSheet = ({ messageId, onClose }) => {
  const { getMessageInfo } = useChatStore();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMessageInfo(messageId).then((data) => {
      if (!active) return;
      setInfo(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [messageId, getMessageInfo]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm cg-fade"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-base-100 w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh] cg-sheet sm:cg-dialog">
        <div className="flex items-center justify-between px-4 py-3.5">
          <h3 className="font-semibold text-base-content text-[15px]">Message info</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-base-200 rounded-full transition-colors text-base-content/60"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <span className="loading loading-spinner loading-md text-primary/60" />
          </div>
        ) : !info ? (
          <p className="px-4 pb-6 text-sm text-base-content/50">Couldn't load message info.</p>
        ) : (
          <div className="overflow-y-auto pb-4">
            {/* Sent */}
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-9 flex justify-center text-base-content/50">
                <Check size={17} />
              </span>
              <span className="flex-1 text-sm text-base-content/70">Sent</span>
              <span className="text-[11px] text-base-content/50 tabular-nums">
                {formatMessageTime(info.sentAt)}
              </span>
            </div>

            {/* Read */}
            <div className="px-4 pt-4 pb-1 flex items-center gap-2">
              <CheckCheck size={14} className="text-primary" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-base-content/45">
                {info.isGroup ? `Read by ${info.seenBy.length}` : "Read"}
              </span>
            </div>
            {info.seenBy.length === 0 ? (
              <p className="px-4 py-2 text-sm text-base-content/45">Not read yet</p>
            ) : (
              info.seenBy.map((p) => <Row key={p._id} person={p} showTime />)
            )}

            {/* Still pending — groups only, where it is useful to see who is left */}
            {info.isGroup && info.pending.length > 0 && (
              <>
                <div className="px-4 pt-4 pb-1 flex items-center gap-2">
                  <Clock size={14} className="text-base-content/40" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-base-content/45">
                    Not read yet ({info.pending.length})
                  </span>
                </div>
                {info.pending.map((p) => <Row key={p._id} person={p} />)}
              </>
            )}

            <p className="px-4 pt-4 text-[11px] leading-snug text-base-content/40">
              Read times reflect when the chat was last opened.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInfoSheet;
