import { useState } from "react";
import { BarChart3, Check, Lock, Users } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import useAuthStore from "../store/useAuthStore";

const voterId = (voter) => (typeof voter === "string" ? voter : voter?._id);

const PollMessage = ({ message }) => {
  const { voteOnPoll, closePoll, selectedGroup } = useGroupStore();
  const { authUser } = useAuthStore();
  const [expandedOptionId, setExpandedOptionId] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

  const poll = message.poll;
  const options = poll?.options || [];
  const myVotes = options
    .filter((option) => (option.votes || []).some((voter) => voterId(voter) === authUser?._id))
    .map((option) => option._id);
  const voters = new Set();
  options.forEach((option) => (option.votes || []).forEach((voter) => voters.add(voterId(voter))));

  const myRole = selectedGroup?.members?.find(
    (m) => (m.user?._id || m.user)?.toString() === authUser?._id?.toString()
  )?.role;
  const isPollOwner = (message.senderId?._id || message.senderId) === authUser?._id;
  const canClose = !poll?.isClosed && (isPollOwner || myRole === "admin" || myRole === "moderator");

  const handleVote = async (optionId) => {
    if (poll?.isClosed || isVoting) return;
    const alreadyVoted = myVotes.includes(optionId);
    const nextVotes = poll.allowMultiple
      ? alreadyVoted
        ? myVotes.filter((id) => id !== optionId)
        : [...myVotes, optionId]
      : alreadyVoted
        ? []
        : [optionId];

    setIsVoting(true);
    try {
      await voteOnPoll(message._id, nextVotes);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="min-w-[240px] max-w-[300px] sm:max-w-[340px] text-left">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-70 mb-1.5">
        <BarChart3 size={12} />
        <span>{poll?.allowMultiple ? "Poll · multiple answers" : "Poll · one answer"}</span>
        {poll?.isClosed && (
          <span className="flex items-center gap-1 ml-auto">
            <Lock size={10} /> Closed
          </span>
        )}
      </div>

      <p className="text-sm font-semibold break-words mb-2">{poll?.question}</p>

      <div className="space-y-1.5">
        {options.map((option) => {
          const votes = option.votes || [];
          const percentage = voters.size === 0 ? 0 : Math.round((votes.length / voters.size) * 100);
          const isSelected = myVotes.includes(option._id);

          return (
            <div key={option._id} className="space-y-0.5">
              <button
                type="button"
                disabled={poll?.isClosed || isVoting}
                onClick={() => handleVote(option._id)}
                className={`relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  isSelected ? "border-primary" : "border-base-300/60"
                } ${poll?.isClosed ? "cursor-default" : "hover:border-primary/70"}`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
                <span className="relative flex items-center gap-2 text-xs">
                  <span
                    className={`flex items-center justify-center size-4 shrink-0 border ${
                      poll?.allowMultiple ? "rounded" : "rounded-full"
                    } ${isSelected ? "bg-primary border-primary text-primary-content" : "border-base-content/30"}`}
                  >
                    {isSelected && <Check size={10} />}
                  </span>
                  <span className="flex-1 break-words">{option.text}</span>
                  <span className="font-semibold tabular-nums">{percentage}%</span>
                </span>
              </button>

              {votes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedOptionId(expandedOptionId === option._id ? null : option._id)}
                  className="flex items-center gap-1 pl-1 text-[10px] opacity-60 hover:opacity-100"
                >
                  <Users size={10} />
                  {votes.length} vote{votes.length === 1 ? "" : "s"}
                </button>
              )}

              {expandedOptionId === option._id && (
                <div className="flex flex-wrap gap-1 pl-1">
                  {votes.map((voter) => (
                    <span
                      key={voterId(voter)}
                      className="px-1.5 py-0.5 rounded-full bg-base-300/60 text-[10px]"
                    >
                      {voter?.fullName || "Member"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] opacity-60">
        <span>
          {voters.size} participant{voters.size === 1 ? "" : "s"}
        </span>
        {canClose && (
          <button type="button" onClick={() => closePoll(message._id)} className="hover:opacity-100 underline">
            Close poll
          </button>
        )}
      </div>
    </div>
  );
};

export default PollMessage;
