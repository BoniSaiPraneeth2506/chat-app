import { useState, useEffect } from "react";
import { useStatusStore } from "../store/useStatusStore";
import axiosInstance from "../lib/axios";
import { X, Eye, Heart, BarChart3, MessageCircleQuestion, TrendingUp } from "lucide-react";
import { formatTimeAgo } from "../lib/statusFormat";

/**
 * What an owner can learn about one of their own statuses.
 *
 * Three tabs because there are three genuinely different questions, and
 * flattening them into one list would answer none of them properly:
 *
 *  - Viewers: who saw it, when, and what they reacted with.
 *  - Analytics: the shape of the response — likes, reactions, replies — rather
 *    than a list of names.
 *  - Answers: for a question only, and readable by nobody but the owner. Kept on
 *    its own tab so it is never one scroll away from a public viewer list, and
 *    so it is obviously a different kind of private thing.
 */
const TABS = [
  { id: "viewers", label: "Viewers", icon: Eye },
  { id: "analytics", label: "Insights", icon: TrendingUp },
  { id: "answers", label: "Answers", icon: MessageCircleQuestion, ownerOnly: true },
];

const StatusViewersSheet = () => {
  const { viewersSheetOpen, viewersSheetStatusId, closeViewersSheet } =
    useStatusStore();
  const [viewers, setViewers] = useState([]);
  const [count, setCount] = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [isQuestion, setIsQuestion] = useState(false);
  const [tab, setTab] = useState("viewers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!viewersSheetOpen || !viewersSheetStatusId) return;

    let cancelled = false;
    setError("");
    setTab("viewers");

    const load = async () => {
      setLoading(true);
      try {
        // Analytics carries the status `type` as well as the numbers, so whether
        // there is an answers tab at all is known from this one response — no
        // second request, and no guessing from a status that may have been
        // deleted in between.
        const [viewersRes, analyticsRes] = await Promise.allSettled([
          axiosInstance.get(`/status/viewers/${viewersSheetStatusId}`),
          axiosInstance.get(`/status/analytics/${viewersSheetStatusId}`),
        ]);

        if (cancelled) return;

        if (viewersRes.status === "fulfilled") {
          setViewers(viewersRes.value?.data?.viewers || []);
          setCount(viewersRes.value?.data?.count || 0);
        } else {
          setViewers([]);
          setCount(0);
          // A 403 here means the status is not this person's — worth saying, since
          // an empty list would read as "nobody has watched it".
          setError(
            viewersRes.reason?.response?.data?.message || "Could not load viewers."
          );
        }

        if (analyticsRes.status === "fulfilled") {
          const data = analyticsRes.value?.data || null;
          setAnalytics(data);
          const question = data?.type === "question";
          setIsQuestion(question);

          if (question) {
            try {
              const answersRes = await axiosInstance.get(
                `/status/answers/${viewersSheetStatusId}`
              );
              if (!cancelled) setAnswers(answersRes.data || null);
            } catch {
              if (!cancelled) setAnswers(null);
            }
          } else {
            setAnswers(null);
          }
        } else {
          setAnalytics(null);
          setIsQuestion(false);
          setAnswers(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [viewersSheetOpen, viewersSheetStatusId]);

  if (!viewersSheetOpen) return null;

  const availableTabs = TABS.filter((t) => !t.ownerOnly || isQuestion);

  return (
    <div
      onClick={closeViewersSheet}
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[1px] animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-base-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-base-content">
              {tab === "answers" ? "Answers" : tab === "analytics" ? "Insights" : "Viewed by"}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {tab === "viewers" && <span className="text-sm t-dim">{count}</span>}
            <button
              onClick={closeViewersSheet}
              className="p-1 rounded-full hover:bg-base-200 transition-colors"
              aria-label="Close"
            >
              <X size={18} className="text-base-content/60" />
            </button>
          </div>
        </div>

        {/* Tabs — only shown when there is more than one thing to switch between,
            so a plain photo status does not grow a tab bar it does not need. */}
        {availableTabs.length > 1 && (
          <div className="flex gap-1 px-4 py-2.5 border-b border-base-200 flex-shrink-0">
            {availableTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    tab === t.id
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 text-base-content/65 hover:bg-base-300"
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="px-5 py-3 text-xs text-red-500">{error}</p>}

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : tab === "viewers" ? (
          /* Viewers list */
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {viewers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-base-content/40">
                <Eye size={24} />
                <span className="text-sm">No viewers yet</span>
              </div>
            ) : (
              viewers.map((viewer) => (
                <div
                  key={viewer._id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-base-200/60 transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={viewer.profilePic || "/avatar.png"}
                      alt={viewer.fullName}
                      className="size-10 rounded-full object-cover"
                    />
                    {viewer.reaction && (
                      <span className="absolute -bottom-1 -right-1 text-xs bg-base-100 rounded-full shadow-sm px-1 py-0.5 border border-base-300">
                        {viewer.reaction}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-base-content truncate">
                        {viewer.fullName}
                      </span>
                    </div>
                    {viewer.reaction && (
                      <span className="text-[11px] text-base-content/50">
                        reacted {viewer.reaction}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] t-dim flex-shrink-0">
                    {formatTimeAgo(viewer.viewedAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : tab === "analytics" ? (
          <AnalyticsView analytics={analytics} />
        ) : (
          <AnswersView answers={answers} />
        )}
      </div>
    </div>
  );
};

const StatTile = ({ icon: Icon, value, label, tone = "text-primary" }) => (
  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-base-200">
    <span className={`grid place-items-center size-9 rounded-xl bg-base-100 ${tone}`}>
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-lg font-bold text-base-content leading-none">{value ?? 0}</p>
      <p className="text-[11px] text-base-content/55 truncate mt-0.5">{label}</p>
    </div>
  </div>
);

const AnalyticsView = ({ analytics }) => {
  if (!analytics) {
    return (
      <div className="flex-1 flex flex-col items-center gap-2 py-10 text-base-content/40">
        <BarChart3 size={24} />
        <span className="text-sm">No insights yet</span>
      </div>
    );
  }

  const totalReactions = Object.values(analytics.reactions || {}).reduce(
    (sum, n) => sum + (n || 0),
    0
  );
  const topReaction = Object.entries(analytics.reactions || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile icon={Eye} value={analytics.views} label="Views" />
        <StatTile icon={Heart} value={analytics.likes} label="Likes" tone="text-red-500" />
        <StatTile icon={MessageCircleQuestion} value={analytics.replies} label="Replies" />
        <StatTile icon={BarChart3} value={totalReactions} label="Reactions" />
      </div>

      {/* The reaction split, so "12 reactions" is answerable as "mostly 🔥"
          rather than being just a number. */}
      <div className="p-3.5 rounded-2xl border border-base-200">
        <p className="text-[11px] uppercase tracking-wide text-base-content/40 mb-2.5">
          Reactions
        </p>
        {totalReactions === 0 ? (
          <p className="text-xs text-base-content/45">Nobody has reacted yet</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(analytics.reactions)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([reaction, count]) => {
                const share = totalReactions > 0 ? (count / totalReactions) * 100 : 0;
                return (
                  <div key={reaction} className="flex items-center gap-2.5">
                    <span className="text-base w-6 text-center flex-shrink-0">{reaction}</span>
                    <div className="flex-1 h-2 rounded-full bg-base-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-base-content/55 tabular-nums w-6 text-right flex-shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
        {topReaction && (
          <p className="mt-2.5 text-[11px] text-base-content/45">
            Most reacted with {topReaction[0]}
          </p>
        )}
      </div>

      {Array.isArray(analytics.pollResults) && analytics.pollResults.length > 0 && (
        <div className="p-3.5 rounded-2xl border border-base-200">
          <p className="text-[11px] uppercase tracking-wide text-base-content/40 mb-2.5">
            Poll result
          </p>
          <div className="space-y-2">
            {analytics.pollResults.map((option, i) => {
              const total = analytics.pollVotes || 0;
              const share = total > 0 ? ((option.count || 0) / total) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-base-content truncate pr-2">{option.text}</span>
                    <span className="text-base-content/55 tabular-nums flex-shrink-0">
                      {option.count || 0}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-base-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const AnswersView = ({ answers }) => {
  const list = answers?.answers || [];

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <p className="px-2 pb-3 text-[11px] text-base-content/45 leading-relaxed">
        Only you can see these. They are not shown to anyone else, and are not
        counted as views.
      </p>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-base-content/40">
          <MessageCircleQuestion size={24} />
          <span className="text-sm">No answers yet</span>
        </div>
      ) : (
        // The endpoint returns each answer flattened — id, name and photo at the
        // top level — rather than nested under a `user` key.
        list.map((answer, i) => (
          <div
            key={answer._id || i}
            className="flex gap-2.5 px-2 py-2.5 rounded-xl hover:bg-base-200/60 transition-colors"
          >
            <img
              src={answer.profilePic || "/avatar.png"}
              alt=""
              className="size-9 rounded-full object-cover flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-base-content truncate">
                  {answer.fullName || "Someone"}
                </span>
                <span className="text-[11px] text-base-content/40 flex-shrink-0">
                  {formatTimeAgo(answer.createdAt)}
                </span>
              </div>
              <p className="text-[13px] text-base-content/75 mt-0.5 break-words leading-relaxed">
                {answer.text}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default StatusViewersSheet;
