import { useState } from "react";
import { Loader2, MessageSquare, Sparkles, Users, X } from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useChatStore } from "../../store/useChatStore";
import { useGroupStore } from "../../store/useGroupStore";

const Section = ({ title, items }) => {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 mb-1">{title}</p>
      <ul className="space-y-1">{items.map((it, i) => <li key={i} className="text-[12px] t-muted leading-snug">• {typeof it === "string" ? it : it?.task || ""}</li>)}</ul>
    </div>
  );
};

const AICatchUpModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const { users, setSelectedUser } = useChatStore();
  const { groups, setSelectedGroup } = useGroupStore();

  const load = async () => {
    setLoading(true); setError("");
    try { const res = await axiosInstance.post("/ai/catch-up"); setData(res.data); }
    catch (e) { setError(e?.response?.data?.message || "Failed to generate AI catch-up"); }
    finally { setLoading(false); }
  };
  const openConversation = (conv) => {
    if (conv.type === "group") {
      const g = groups.find((x) => String(x._id) === String(conv.conversationId));
      if (g) { setSelectedGroup(g); onClose(); }
    } else {
      const u = users.find((x) => String(x._id) === String(conv.conversationId));
      if (u) { setSelectedUser(u); onClose(); }
    }
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[86dvh] flex flex-col rounded-3xl bg-base-100 shadow-2xl cg-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary"><Sparkles size={16} /></span>
            <div><h3 className="font-semibold text-base">AI Catch Up</h3><p className="text-[11px] t-dim">Summarize unread messages across conversations</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-base-200"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!data && !loading && !error && (
            <div className="py-8 text-center">
              <p className="text-sm t-muted mb-3">Get a quick AI summary of where you need to catch up.</p>
              <button type="button" onClick={load} className="px-4 py-2 rounded-full bg-primary text-primary-content text-sm font-medium">Generate Catch Up</button>
            </div>
          )}
          {loading && <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-primary" /></div>}
          {error && <div className="py-4 text-center"><p className="text-sm text-error">{error}</p><button type="button" onClick={load} className="mt-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">Retry</button></div>}
          {data && data.totalConversations === 0 && <p className="py-8 text-center text-sm t-muted">You're all caught up!</p>}
          {data?.conversations?.map((conv) => (
            <div key={`${conv.type}-${conv.conversationId}`} className="rounded-2xl border border-base-300 s-chip p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">{conv.type === "group" ? <Users size={14} className="text-primary" /> : <MessageSquare size={14} className="text-primary" />}<span className="truncate">{conv.name}</span></div>
                  <p className="text-[11px] t-dim">{conv.type === "group" ? "Group" : "Individual"} · {conv.unreadCount} unread message{conv.unreadCount === 1 ? "" : "s"}</p>
                </div>
                <button type="button" onClick={() => openConversation(conv)} className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15">Open</button>
              </div>
              {conv.error ? <p className="mt-2 text-[12px] text-error">{conv.error}</p> : conv.summary ? (
                <div className="mt-2 space-y-2">
                  <div className="rounded-xl bg-primary/10 px-3 py-2 text-[12px] text-base-content/80 leading-snug">{conv.summary.summary}</div>
                  {conv.summary.truncated && <p className="text-[10px] text-warning">Older unread messages were excluded because of the limit.</p>}
                  <Section title="Key points" items={conv.summary.keyPoints} />
                  <Section title="Decisions" items={conv.summary.decisions} />
                  <Section title="Pending tasks" items={conv.summary.actionItems} />
                  <Section title="Unanswered questions" items={conv.summary.unansweredQuestions} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {data && <div className="px-4 py-3 border-t border-base-300 flex justify-end"><button type="button" onClick={load} className="text-sm px-3 py-1.5 rounded-full bg-base-200 hover:bg-base-300">Refresh</button></div>}
      </div>
    </div>
  );
};

export default AICatchUpModal;
