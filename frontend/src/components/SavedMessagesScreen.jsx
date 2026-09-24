import { ArrowLeft, Bookmark, BookmarkX, Clock } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { haptic } from "../lib/haptics";

const pad = (n) => String(n).padStart(2, "0");

const formatSavedTime = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `Today · ${time}`;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${time}`;
};

const SavedMessagesScreen = ({ onClose, savedMessages, onUnsave }) => {
  const { authUser } = useAuthStore();
  const myId = authUser?._id;

  return (
    <div className="absolute inset-0 z-[100] bg-base-100 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-base-300 bg-base-100/90 backdrop-blur text-left">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-base-200 transition-colors"
          title="Close saved messages"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="grid rounded-full place-items-center size-9 bg-primary/10">
          <Bookmark className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Saved Messages</h2>
          <p className="text-[11px] opacity-60 truncate">
            {savedMessages.length === 0
              ? "Long-press a message → ⋯ → Save"
              : `${savedMessages.length} saved ${savedMessages.length === 1 ? "message" : "messages"}`}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {savedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-8 select-none">
            <div className="grid rounded-full place-items-center size-16 bg-primary/10">
              <Bookmark className="size-7 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-base-content/80">No saved messages yet</p>
            <p className="text-xs text-base-content/50">
              Save a message from this chat and it shows up here — just like a note to yourself.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {savedMessages.map((m) => {
              const outgoing = m.senderId === myId;
              return (
                <div key={m.messageId} className="space-y-1">
                  <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`relative max-w-[82%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-snug break-words ${
                        outgoing
                          ? "rounded-br-md bg-primary text-primary-content"
                          : "rounded-bl-md bg-base-200 text-base-content"
                      }`}
                    >
                      {!outgoing && m.senderName && (
                        <span className="block mb-0.5 text-[11px] font-semibold text-primary">
                          {m.senderName}
                        </span>
                      )}
                      {m.image ? (
                        <img
                          src={m.image}
                          alt="Saved"
                          className="max-w-[220px] max-h-56 rounded-xl object-cover mb-1.5"
                          loading="lazy"
                        />
                      ) : null}
                      {m.text ? (
                        m.text
                      ) : m.voice ? (
                        <span className="block text-xs opacity-80">🎙️ Voice message</span>
                      ) : (
                        <span className="block text-xs opacity-80">Media message</span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-1 text-[10px] text-base-content/40 ${
                      outgoing ? "justify-end" : "justify-start"
                    }`}
                  >
                    <Clock className="size-3" />
                    <span>
                      {formatSavedTime(m.savedAt)} · {formatSavedTime(m.createdAt)}
                    </span>
                    <button
                      onClick={() => {
                        haptic("tap");
                        onUnsave(m.messageId);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-error/80 hover:bg-error/10 hover:text-error transition-colors"
                      title="Unsave message"
                    >
                      <BookmarkX className="size-3" />
                      Unsave
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedMessagesScreen;