import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import axiosInstance from "../../lib/axios";

const Section = ({ title, items }) => {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 mb-1">{title}</p>
      <ul className="space-y-1">{items.map((it, i) => <li key={i} className="text-[12px] t-muted leading-snug">• {typeof it === "string" ? it : it?.task || ""}</li>)}</ul>
    </div>
  );
};

const AISummaryPill = ({ conversationId, type, unreadCount = 0, since }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [stale, setStale] = useState(false);
  const [seenUnread, setSeenUnread] = useState(unreadCount);

  useEffect(() => { setOpen(false); setLoading(false); setError(""); setData(null); setStale(false); setSeenUnread(unreadCount); }, [conversationId, type]);
  useEffect(() => { if (unreadCount > seenUnread && data) setStale(true); if (unreadCount !== seenUnread) setSeenUnread(unreadCount); }, [unreadCount, seenUnread, data]);

  const canShow = Boolean(conversationId) && Number(unreadCount || 0) > 0;
  const summary = data?.summary;
  const fetchSummary = async () => {
    if (!conversationId || loading) return;
    setLoading(true); setError("");
    try {
      const params = { type };
      if (since) params.since = since;
      const res = await axiosInstance.post(`/ai/summarize-chat/${conversationId}`, null, { params });
      setData(res.data); setStale(false);
    } catch (e) { setError(e?.response?.data?.message || "Failed to summarize unread messages"); }
    finally { setLoading(false); }
  };
  if (!canShow) return null;

  return (
    <div className="px-3 relative">
      {!open ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => { setOpen(true); if (!data) fetchSummary(); }} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-base-100/80 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-primary shadow-lg hover:bg-base-100/95 transition-colors">
            <Sparkles size={13} /><span>Summarize unread</span><span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] leading-none">{unreadCount}</span>{stale && <span className="text-[10px] text-warning">New</span>}
          </button>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-md rounded-2xl border border-base-300 bg-base-100/95 backdrop-blur-md p-3 shadow-2xl cg-dialog mb-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary inline-flex items-center gap-1"><Sparkles size={12} />AI Summary</p>
            <div className="flex items-center gap-1">
              {data && <button type="button" onClick={fetchSummary} className="text-[10px] px-2 py-1 rounded-full bg-base-200 hover:bg-base-300 t-muted">{stale ? "Regenerate" : "Refresh"}</button>}
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-base-200 t-dim"><X size={14} /></button>
            </div>
          </div>
          {loading ? (
            <div className="py-5 flex justify-center"><Loader2 size={18} className="animate-spin text-primary" /></div>
          ) : error ? (
            <div className="py-2"><p className="text-[12px] text-error">{error}</p><button type="button" onClick={fetchSummary} className="mt-2 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary">Retry</button></div>
          ) : !summary ? (
            <p className="py-3 text-center text-xs t-dim">No unread messages to summarize.</p>
          ) : (
            <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
              <div className="rounded-xl bg-primary/10 px-3 py-2 text-[12px] text-base-content/80 leading-snug">{summary.summary}</div>
              {summary.truncated && <p className="text-[10px] text-warning">Older unread messages excluded by limit.</p>}
              <Section title="Key points" items={summary.keyPoints} />
              <Section title="Decisions" items={summary.decisions} />
              <Section title="Pending tasks" items={summary.actionItems} />
              <Section title="Unanswered questions" items={summary.unansweredQuestions} />
              <p className="text-[10px] t-dim">Summarized {summary.messageCount || unreadCount} unread.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AISummaryPill;
