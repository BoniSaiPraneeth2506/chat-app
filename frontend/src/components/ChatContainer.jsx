import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useLayoutEffect } from "react";
import { X, Globe, FileText, Calendar, ShieldCheck, Clock, CornerUpLeft, Trash2, Pencil, Phone, Video, Pin } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { getWallpaperStyle } from "../pages/SettingsPage";
import CallModal from "./CallModal";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import useAuthStore from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const formatCallDuration = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};
const SingleCheck = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 8.5L6.5 12L13.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DoubleCheck = ({ className }) => (
  <svg viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1.5 8.5L5 12L12 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 8.5L9.5 12L16.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    lastReadTimestamps,
    loadMoreMessages,
    isRecipientProfileOpen,
    setIsRecipientProfileOpen,
    setDisappearingTimer,
    messageSearchQuery,
    setReplyingToMessage,
    setEditingMessage,
    toggleReaction,
    deleteMessage,
    pinnedMessage,
    togglePinMessage,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { theme, wallpaper, privacyReadReceipts } = useThemeStore();
  const messageEndRef = useRef(null);
  const scrollableRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const lastMessageIdRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const isPrependingRef = useRef(false);

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      
      element.classList.add("bg-primary/20", "rounded-lg");
      setTimeout(() => {
        element.classList.remove("bg-primary/20", "rounded-lg");
      }, 1500);
    }
  };

  const highlightText = (text, query) => {
    if (!query || !query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded font-semibold">{part}</mark> 
            : part
        )}
      </span>
    );
  };

  const renderReactions = (message) => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const counts = {};
    message.reactions.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });

    const myReaction = message.reactions.find(
      (r) => (r.userId === authUser._id || r.userId?._id === authUser._id)
    );

    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          if (myReaction) {
            toggleReaction(message._id, myReaction.emoji);
          }
        }}
        className={`absolute bottom-[-10px] right-[-6px] flex items-center gap-1 bg-base-200 border border-base-300 rounded-full px-1.5 py-0.5 shadow-sm text-[10px] select-none z-10 text-base-content font-medium cursor-pointer hover:bg-base-300 transition-colors ${myReaction ? "border-primary/50" : ""}`}
        title={myReaction ? "Click to remove reaction" : ""}
      >
        <span className="flex gap-0.5">
          {Object.keys(counts).map((emoji) => (
            <span key={emoji}>{emoji}</span>
          ))}
        </span>
        {message.reactions.length > 1 && (
          <span className="opacity-70">{message.reactions.length}</span>
        )}
      </div>
    );
  };

  useEffect(() => {
    getMessages(selectedUser._id);
  }, [selectedUser._id, getMessages]);

  useEffect(() => {
    prevMessagesLengthRef.current = 0;
    lastMessageIdRef.current = null;
    prevScrollHeightRef.current = 0;
    prevScrollTopRef.current = 0;
    isPrependingRef.current = false;
  }, [selectedUser._id]);

  const handleScroll = async () => {
    const container = scrollableRef.current;
    if (!container) return;

    if (container.scrollTop === 0 && !isPrependingRef.current) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingRef.current = true;
      await loadMoreMessages(selectedUser._id);
    }
  };

  const renderTicks = (message) => {
    if (message.senderId !== authUser._id) return null;

    const receiverId = message.receiverId;
    const isOnline = onlineUsers.includes(receiverId);

    // Condition 1: Read by recipient
    const lastReadTime = lastReadTimestamps[receiverId] || 0;
    const messageTime = new Date(message.createdAt).getTime();

    if (messageTime <= lastReadTime) {
      return <DoubleCheck className={`w-[15px] h-[13px] ${privacyReadReceipts ? 'text-blue-500' : 'text-zinc-400'} flex-shrink-0`} />;
    }

    // Heuristic: If recipient has sent any message after this message, they have read it!
    const latestReplyFromReceiver = Array.isArray(messages)
      ? messages.filter((m) => m.senderId === receiverId).pop()
      : null;
    if (latestReplyFromReceiver && new Date(latestReplyFromReceiver.createdAt).getTime() > messageTime) {
      return <DoubleCheck className={`w-[15px] h-[13px] ${privacyReadReceipts ? 'text-blue-500' : 'text-zinc-400'} flex-shrink-0`} />;
    }

    // Condition 2: Delivered (online)
    if (isOnline) {
      return <DoubleCheck className="w-[15px] h-[13px] text-zinc-400 flex-shrink-0" />;
    }

    // Condition 3: Sent (offline)
    return <SingleCheck className="w-[13px] h-[13px] text-zinc-400 flex-shrink-0" />;
  };

  useLayoutEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) {
      prevMessagesLengthRef.current = 0;
      lastMessageIdRef.current = null;
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const latestMessageId = latestMessage ? latestMessage._id : null;
    const container = scrollableRef.current;

    if (isPrependingRef.current && container && prevScrollHeightRef.current) {
      // Synchronously adjust scroll offset in the same layout pass before paint
      const deltaHeight = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = deltaHeight + prevScrollTopRef.current;
      isPrependingRef.current = false;
    } else if (prevMessagesLengthRef.current === 0 || latestMessageId !== lastMessageIdRef.current) {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ behavior: "auto" });
      }
    }

    prevMessagesLengthRef.current = messages.length;
    lastMessageIdRef.current = latestMessageId;
  }, [messages]);

  return (
    <div className="flex-1 flex h-full max-h-full overflow-hidden relative">
      {/* Left Column: Chat View */}
      <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden bg-base-100">
        <ChatHeader />

        {/* Pinned Message Sticky Banner */}
        {pinnedMessage && !pinnedMessage.isDeletedForEveryone && (
          <div 
            onClick={() => {
              const el = document.getElementById(`msg-${pinnedMessage._id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="bg-base-200/90 hover:bg-base-200 border-b border-base-300 px-4 py-2 flex items-center justify-between cursor-pointer transition-colors z-30 shadow-sm text-left animate-in slide-in-from-top duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Pin size={14} className="text-amber-500 flex-shrink-0 fill-amber-500/20" />
              <div className="text-xs min-w-0">
                <span className="font-semibold text-amber-500 block text-[10px] uppercase tracking-wider">
                  Pinned Message
                </span>
                <p className="text-base-content/80 truncate font-medium max-w-[200px] sm:max-w-[400px]">
                  {pinnedMessage.text || (pinnedMessage.image ? "📷 Photo" : pinnedMessage.voice ? "🎙️ Voice Message" : "Message")}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePinMessage(pinnedMessage._id);
              }}
              className="p-1 hover:bg-base-300 rounded-full transition-colors text-base-content/50 hover:text-red-500"
              title="Unpin message"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div 
          ref={scrollableRef}
          onScroll={handleScroll}
          className="flex-1 p-4 space-y-4 overflow-y-auto transition-all"
          style={getWallpaperStyle(wallpaper, theme)}
        >
          {isMessagesLoading && (!Array.isArray(messages) || messages.length === 0) ? (
            <div className="h-full w-full flex items-center justify-center">
              <span className="loading loading-spinner loading-md text-primary/60"></span>
            </div>
          ) : (
            Array.isArray(messages) && messages.map((message) => {
              if (message.isCallLog) {
                return (
                  <div key={message._id} className="flex justify-center my-3 select-none w-full animate-in fade-in duration-200">
                    <div className="bg-base-200/80 border border-base-300 rounded-full px-4 py-1.5 flex items-center gap-2 text-xs text-base-content/75 font-medium shadow-sm">
                      {message.callType === "video" ? (
                        <Video size={13} className={message.callStatus === "missed" ? "text-red-500" : "text-emerald-500"} />
                      ) : (
                        <Phone size={13} className={message.callStatus === "missed" ? "text-red-500" : "text-emerald-500"} />
                      )}
                      <span className="capitalize">
                        {message.senderId === authUser._id ? "Outgoing" : "Incoming"} {message.callType} call • {message.callStatus === "completed" ? `duration ${formatCallDuration(message.callDuration)}` : message.callStatus}
                      </span>
                      <span className="text-[10px] opacity-60">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message._id}
                  id={`msg-${message._id}`}
                  className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"} group relative`}
                >
                {/* Chat Bubble Wrapper with group-hover reactions panel */}
                <div 
                  onDoubleClick={() => toggleReaction(message._id, "❤️")}
                  className={`flex flex-col py-1.5 px-3 chat-bubble relative min-w-[85px] transition-colors duration-300 select-none cursor-default ${message.reactions?.length > 0 ? "pb-5" : "pb-4"}`}
                >
                  {/* Reply Quote Display */}
                  {message.replyTo && (
                    <div 
                      onClick={() => scrollToMessage(message.replyTo._id)}
                      className="bg-black/15 dark:bg-white/10 border-l-4 border-primary px-2.5 py-1.5 rounded-r-md text-left mb-2 text-xs cursor-pointer select-none transition-all hover:bg-black/20 dark:hover:bg-white/15"
                    >
                      <span className="text-[10px] font-bold text-primary block mb-0.5">
                        {message.replyTo.senderId === authUser._id ? "You" : selectedUser?.fullName}
                      </span>
                      <p className="truncate opacity-80 text-base-content/90 max-w-[200px] sm:max-w-[300px]">
                        {message.replyTo.text || (message.replyTo.image ? "📷 Photo" : message.replyTo.voice ? "🎙️ Voice Message" : "Message")}
                      </p>
                    </div>
                  )}

                  {/* Hover Reactions Action Bar */}
                  <div className="absolute right-0 top-[-30px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center bg-base-200 border border-base-300 rounded-full px-2 py-1 shadow-md z-10 gap-1.5 pointer-events-auto">
                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(message._id, emoji)}
                        className="hover:scale-125 transition-transform duration-100 text-sm"
                      >
                        {emoji}
                      </button>
                    ))}
                    <div className="w-[1px] h-3 bg-base-300 mx-1"></div>
                    <button
                      onClick={() => setReplyingToMessage(message)}
                      className="text-base-content/60 hover:text-primary transition-colors flex items-center"
                      title="Reply"
                    >
                      <CornerUpLeft size={13} />
                    </button>
                    {message.senderId === authUser?._id && !message.isDeletedForEveryone && message.text && (Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000) && (
                      <button
                        onClick={() => setEditingMessage(message)}
                        className="text-base-content/60 hover:text-primary transition-colors flex items-center"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {!message.isDeletedForEveryone && (
                      <button
                        onClick={() => togglePinMessage(message._id)}
                        className={`transition-colors flex items-center ${
                          message.isPinned ? "text-amber-500 hover:text-amber-600" : "text-base-content/60 hover:text-amber-500"
                        }`}
                        title={message.isPinned ? "Unpin message" : "Pin message"}
                      >
                        <Pin size={13} />
                      </button>
                    )}
                    {!message.isDeletedForEveryone && (
                      <div className="dropdown dropdown-bottom dropdown-end flex items-center">
                        <div tabIndex={0} role="button" className="text-base-content/60 hover:text-red-500 transition-colors flex items-center p-0.5 cursor-pointer" title="Delete message">
                          <Trash2 size={13} />
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow-xl bg-base-100 border border-base-300 rounded-box w-36 text-xs text-base-content mt-1">
                          <li>
                            <button onClick={() => deleteMessage(message._id, "me")} className="hover:bg-base-200 py-1.5 text-left font-medium">
                              Delete for me
                            </button>
                          </li>
                          {message.senderId === authUser._id && (
                            <li>
                              <button onClick={() => deleteMessage(message._id, "everyone")} className="hover:bg-red-500 hover:text-white py-1.5 text-left font-medium text-red-500">
                                Delete for everyone
                              </button>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {message.isDeletedForEveryone ? (
                    <p className="text-xs italic text-base-content/40 flex items-center gap-1 select-none py-1 pr-14">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      This message was deleted
                    </p>
                  ) : (
                    <>
                      {/* Message Media */}
                      {message.image && (
                        <img
                          src={message.image}
                          alt="Attachment"
                          className="sm:max-w-[180px] rounded-md mb-1.5"
                        />
                      )}
                      {message.voice && (
                        <div className="py-1 pr-14 select-none">
                          <audio
                            src={message.voice}
                            controls
                            className="max-w-[200px] sm:max-w-[260px] h-10 outline-none rounded-lg"
                          />
                        </div>
                      )}
                      {message.text && (
                        <p className="text-sm leading-relaxed break-words pr-14 select-text">
                          {highlightText(message.text, messageSearchQuery)}
                        </p>
                      )}
                    </>
                  )}
                  
                  <div className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[9px] opacity-60 select-none">
                    {message.isEdited && <span className="mr-1 italic font-medium opacity-70">(edited)</span>}
                    <span>{formatMessageTime(message.createdAt)}</span>
                    {message.senderId === authUser._id && (
                      <span className="scale-75 origin-bottom-right">
                        {renderTicks(message)}
                      </span>
                    )}
                  </div>

                  {/* Reaction Pill Overlay */}
                  {!message.isDeletedForEveryone && renderReactions(message)}
                </div>
              </div>
              );
            })
          )}
          <div ref={messageEndRef} />
        </div>

        <MessageInput />
      </div>

      {/* Right Column: Recipient Profile Info Sidebar */}
      {isRecipientProfileOpen && (
        <div className="absolute lg:relative top-0 right-0 z-50 w-full lg:w-80 h-full border-l border-base-300 bg-base-100 flex flex-col shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-base-300 flex items-center justify-between">
            <h3 className="font-semibold text-base text-base-content">Contact Info</h3>
            <button 
              onClick={() => setIsRecipientProfileOpen(false)}
              className="p-1.5 hover:bg-base-200 rounded-full transition-colors text-base-content/60 hover:text-base-content"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Center avatar & name */}
            <div className="flex flex-col items-center text-center">
              <img 
                src={selectedUser.profilePic || "/avatar.png"} 
                alt={selectedUser.fullName}
                className="object-cover border-4 border-base-200 rounded-full size-28 shadow-md"
              />
              <h2 className="font-semibold text-lg text-base-content mt-3">{selectedUser.fullName}</h2>
              <span className="text-xs text-base-content/50 select-all">{selectedUser.email}</span>
            </div>

            {/* Bio info */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <FileText size={12} />
                Bio
              </span>
              <p className="text-sm bg-base-200/50 p-3 rounded-lg border border-base-300/30 text-base-content/80 whitespace-pre-wrap leading-relaxed">
                {selectedUser.bio || <span className="text-zinc-500 italic">No bio added yet</span>}
              </p>
            </div>

            {/* Links website */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1">
                <Globe size={12} />
                Website / Social Link
              </span>
              <div className="text-sm bg-base-200/50 p-3 rounded-lg border border-base-300/30 text-base-content/80 truncate">
                {selectedUser.link ? (
                  <a 
                    href={selectedUser.link.startsWith("http") ? selectedUser.link : `https://${selectedUser.link}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline font-medium"
                  >
                    {selectedUser.link}
                  </a>
                ) : (
                  <span className="text-zinc-500 italic">No link added yet</span>
                )}
              </div>
            </div>

            {/* Disappearing Messages Section */}
            {selectedUser._id !== authUser._id && (
              <div className="space-y-1.5 pt-4 border-t border-base-200 text-left">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1 select-none">
                  <Clock size={12} />
                  Disappearing Messages
                </span>
                <select
                  className="select select-sm select-bordered w-full bg-base-200/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-base-content"
                  value={authUser?.disappearingTimers?.[selectedUser._id] || "off"}
                  onChange={(e) => setDisappearingTimer(selectedUser._id, e.target.value)}
                >
                  <option value="off">Off (Keep messages)</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                </select>
              </div>
            )}

            {/* Meta details */}
            <div className="pt-4 border-t border-base-200 space-y-3 text-xs text-base-content/60">
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>Joined: {selectedUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-green-500" />
                <span className="text-green-500 font-medium">Encryption: End-to-End Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <CallModal />
    </div>
  );
};
export default ChatContainer;