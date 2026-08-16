import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, Loader2, ShieldOff } from "lucide-react";
import axiosInstance from "../lib/axios";
import { useGroupStore } from "../store/useGroupStore";

// Landing screen for a group invite link (/join/:code).
//
// Deliberately shows a preview before joining rather than adding the person on
// arrival: opening a link shouldn't silently drop you into a group of
// strangers, and the preview is what makes the decision informed.
const JoinGroupPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { joinGroupByInvite, setSelectedGroup } = useGroupStore();

  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get(`/groups/invite/${code}`);
        if (active) setPreview(res.data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "This invite link is no longer valid");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  const handleJoin = async () => {
    setIsJoining(true);
    const group = await joinGroupByInvite(code);
    setIsJoining(false);
    if (group) {
      setSelectedGroup(group);
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-14">
      <div className="max-w-md px-4 mx-auto">
        <div className="rounded-2xl bg-base-200 px-6 py-8 text-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-6 text-base-content/50">
              <Loader2 size={26} className="animate-spin" />
              <span className="text-sm">Checking invite…</span>
            </div>
          ) : error ? (
            <>
              <div className="grid mx-auto rounded-full size-14 place-items-center bg-error/10">
                <ShieldOff size={26} className="text-error" />
              </div>
              <h1 className="mt-3 text-lg font-semibold text-base-content">Invite unavailable</h1>
              <p className="mt-1 text-sm text-base-content/50">{error}</p>
              <button
                onClick={() => navigate("/", { replace: true })}
                className="w-full h-12 mt-6 rounded-2xl bg-base-300/70 hover:bg-base-300 text-[15px] font-medium text-base-content active:scale-[0.98] transition-all"
              >
                Back to chats
              </button>
            </>
          ) : (
            <>
              {preview.groupPic ? (
                <img
                  src={preview.groupPic}
                  alt=""
                  className="object-cover mx-auto rounded-full size-20 ring-4 ring-base-300"
                />
              ) : (
                <div className="grid mx-auto rounded-full size-20 place-items-center bg-base-300">
                  <Users size={30} className="text-base-content/40" />
                </div>
              )}

              <h1 className="mt-4 text-xl font-semibold text-base-content">{preview.name}</h1>
              {preview.description && (
                <p className="mt-1 text-sm text-base-content/60">{preview.description}</p>
              )}
              <p className="mt-1 text-xs text-base-content/40 tabular-nums">
                {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}
              </p>

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full h-12 mt-6 rounded-2xl bg-primary text-primary-content font-semibold text-[15px] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {isJoining
                  ? "Joining…"
                  : preview.alreadyMember
                    ? "Open group"
                    : "Join group"}
              </button>
              <button
                onClick={() => navigate("/", { replace: true })}
                className="w-full h-11 mt-2 rounded-2xl text-[14px] font-medium text-base-content/60 hover:text-base-content transition-colors"
              >
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinGroupPage;
