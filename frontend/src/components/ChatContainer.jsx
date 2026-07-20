import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useLayoutEffect } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import useAuthStore from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
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
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const messageEndRef = useRef(null);
  const scrollableRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const lastMessageIdRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const isPrependingRef = useRef(false);

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
      return <DoubleCheck className="w-[15px] h-[13px] text-blue-500 flex-shrink-0" />;
    }

    // Heuristic: If recipient has sent any message after this message, they have read it!
    const latestReplyFromReceiver = messages
      .filter((m) => m.senderId === receiverId)
      .pop();
    if (latestReplyFromReceiver && new Date(latestReplyFromReceiver.createdAt).getTime() > messageTime) {
      return <DoubleCheck className="w-[15px] h-[13px] text-blue-500 flex-shrink-0" />;
    }

    // Condition 2: Delivered (online)
    if (isOnline) {
      return <DoubleCheck className="w-[15px] h-[13px] text-zinc-400 flex-shrink-0" />;
    }

    // Condition 3: Sent (offline)
    return <SingleCheck className="w-[13px] h-[13px] text-zinc-400 flex-shrink-0" />;
  };

  useLayoutEffect(() => {
    if (!messages || messages.length === 0) {
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
    <div className="flex flex-col flex-1 overflow-auto bg-base-100">
      <ChatHeader />

      <div 
        ref={scrollableRef}
        onScroll={handleScroll}
        className="flex-1 p-4 space-y-4 overflow-y-auto"
      >
        {isMessagesLoading && messages.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center">
            <span className="loading loading-spinner loading-md text-primary/60"></span>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
            >
              <div className="flex flex-col py-1.5 px-3 chat-bubble relative pb-4 min-w-[85px]">
                {message.image && (
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="sm:max-w-[180px] rounded-md mb-1.5"
                  />
                )}
                {message.text && <p className="text-sm leading-relaxed break-words pr-14">{message.text}</p>}
                
                <div className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[9px] opacity-60 select-none">
                  <span>{formatMessageTime(message.createdAt)}</span>
                  {message.senderId === authUser._id && (
                    <span className="scale-75 origin-bottom-right">
                      {renderTicks(message)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;