import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { X, Search, Forward } from "lucide-react";

const ForwardModal = ({ message, onClose, users, authUser }) => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const { forwardMessage } = useChatStore();

  // Include self-chat (Personal Notes) + all other users
  const allContacts = [
    { ...authUser, fullName: "Personal Notes (You)" },
    ...users.filter((u) => u._id !== authUser._id),
  ];

  const filtered = allContacts.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    setIsSending(true);
    await forwardMessage(message, selectedIds);
    setIsSending(false);
    onClose();
  };

  // Preview of the message being forwarded
  const msgPreview = message.isDeletedForEveryone
    ? "This message was deleted"
    : message.image
    ? "📷 Photo"
    : message.voice
    ? "🎙️ Voice message"
    : message.text || "Message";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-base-100 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[75vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Forward size={17} className="text-primary" />
            <h3 className="font-semibold text-base-content text-[15px]">Forward message</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-base-200 rounded-full transition-colors text-base-content/60"
          >
            <X size={17} />
          </button>
        </div>

        {/* Message preview */}
        <div className="px-5 py-3 border-b border-base-300 bg-base-200/40 flex-shrink-0">
          <p className="text-[10px] text-base-content/40 uppercase tracking-wider font-semibold mb-1">
            Forwarding
          </p>
          <p className="text-sm text-base-content/75 truncate">{msgPreview}</p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-base-300 flex-shrink-0">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-base-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder-base-content/40 text-base-content"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-base-content/40 py-10">No contacts found</p>
          ) : (
            filtered.map((user) => {
              const isSelected = selectedIds.includes(user._id);
              return (
                <button
                  key={user._id}
                  onClick={() => toggle(user._id)}
                  className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-base-200/60 transition-colors ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-base-300/40"
                  />
                  <span className="flex-1 text-left text-sm font-medium text-base-content truncate">
                    {user.fullName}
                  </span>
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                      isSelected
                        ? "bg-primary border-primary shadow-sm"
                        : "border-base-300"
                    }`}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3 text-primary-content" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-base-300 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-base-content/50">
            {selectedIds.length > 0
              ? `${selectedIds.length} chat${selectedIds.length > 1 ? "s" : ""} selected`
              : "Select chats to forward"}
          </span>
          <button
            onClick={handleForward}
            disabled={selectedIds.length === 0 || isSending}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-content rounded-full text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all"
          >
            <Forward size={14} />
            {isSending ? "Sending..." : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
