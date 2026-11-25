import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Send, X } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import useAuthStore from "../store/useAuthStore";
import { useNicknames, displayNameOf } from "../lib/contacts";
import { formatMessageTime } from "../lib/utils";

const EMPTY_REPLIES = [];

const ThreadPanel = ({ rootMessage, onClose }) => {
  const selectedGroup = useGroupStore((s) => s.selectedGroup);
  const replies = useGroupStore((s) => s.threadReplies?.[rootMessage?._id] || EMPTY_REPLIES);
  const loading = useGroupStore((s) => s.threadLoading);
  const loadThreadMessages = useGroupStore((s) => s.loadThreadMessages);
  const sendThreadReply = useGroupStore((s) => s.sendThreadReply);
  const setThreadRoot = useGroupStore((s) => s.setThreadRoot);
  const authUser = useAuthStore((s) => s.authUser);
  const nicknames = useNicknames();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const socket = useAuthStore((s) => s.socket);
  const groupId = selectedGroup?._id || rootMessage?.groupId;

  useEffect(() => {
    if (!rootMessage?._id) return;
    setThreadRoot(rootMessage._id);
    if (groupId) loadThreadMessages(groupId, rootMessage._id);
    socket?.emit("joinThread", { rootId: rootMessage._id });
    return () => {
      socket?.emit("leaveThread", { rootId: rootMessage._id });
      setThreadRoot(null);
    };
  }, [groupId, rootMessage?._id, loadThreadMessages, setThreadRoot, socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || !groupId || !rootMessage?._id || sending) return;
    setSending(true);
    const ok = await sendThreadReply(groupId, rootMessage._id, text);
    if (ok) setDraft("");
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[170] flex justify-end bg-black/45" onClick={onClose}>
      <div
        className="w-full sm:w-[420px] h-full bg-base-100 shadow-2xl flex flex-col cg-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <div>
            <h3 className="font-semibold text-base text-base-content">Thread</h3>
            <p className="text-[11px] t-dim">{selectedGroup?.name || "Group"}</p>
            {!groupId && <p className="text-[10px] text-warning">Open the group to load replies</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-base-200" aria-label="Close thread">
            <X size={18} />
          </button>
        </div>

        <div className="mx-4 mt-3 rounded-2xl border border-base-300 bg-base-200/60 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-primary">
              <CornerUpLeft size={13} />
            </span>
            <span className="text-xs font-semibold truncate">
              {rootMessage?.senderId?.fullName || "Message"}
            </span>
            <span className="ml-auto text-[10px] t-dim">
              {rootMessage?.createdAt ? formatMessageTime(rootMessage.createdAt) : ""}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug break-words t-muted line-clamp-3">
            {rootMessage?.text || (rootMessage?.attachments?.length ? "Attachment" : "Message")}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && replies.length === 0 ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : replies.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm t-dim">
              <CornerUpLeft size={24} className="mb-2 opacity-60" />
              No replies yet
            </div>
          ) : (
            replies.map((reply) => {
              const mine = String(reply.senderId?._id || reply.senderId) === String(authUser?._id);
              return (
                <div key={reply._id || reply.tempId} className={`chat ${mine ? "chat-end" : "chat-start"}`}>
                  <div className="chat-bubble chat-bubble-xs max-w-[85%]">
                    {!mine && (
                      <span className="block text-[10px] font-semibold text-primary mb-0.5">
                        {reply.senderId?.fullName || displayNameOf(reply.senderId, nicknames) || "Member"}
                      </span>
                    )}
                    <span className="block text-[12.5px] whitespace-pre-wrap break-words">
                      {reply.text || (reply.attachments?.length ? "Attachment" : "Message")}
                    </span>
                    <span className="block text-[9px] opacity-60 mt-1 text-right">
                      {reply.createdAt ? formatMessageTime(reply.createdAt) : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="flex items-end gap-2 p-3 border-t border-base-300">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder="Reply in thread..."
            className="field-flat flex-1 min-h-[40px] max-h-24 px-3 py-2 rounded-2xl bg-base-200 text-sm text-base-content resize-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="size-10 grid place-items-center rounded-full bg-primary text-primary-content disabled:opacity-40"
            aria-label="Send thread reply"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ThreadPanel;
