import { Sparkles, ScrollText, Check } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";

// Shown once to a member the first time they open a group that has a welcome
// message or rules set.
//
// "Seen" is recorded on the server (group.welcomeSeenBy), not in localStorage,
// so it does not reappear on another device and is tracked per account rather
// than per browser. Editing the text clears that list, so an updated set of
// rules is shown again.

const GroupWelcomeSheet = ({ group, onClose }) => {
  const { markWelcomeSeen } = useGroupStore();

  const dismiss = () => {
    markWelcomeSeen(group._id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm cg-fade"
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      <div className="bg-base-100 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] cg-sheet sm:cg-dialog">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          {group.groupPic ? (
            <img src={group.groupPic} alt={group.name} className="size-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="size-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
              <Sparkles size={20} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-base-content/45">
              Welcome to
            </p>
            <h3 className="font-semibold text-base-content text-[17px] truncate">{group.name}</h3>
          </div>
        </div>

        <div className="overflow-y-auto px-5 space-y-4 pb-2">
          {group.welcomeMessage && (
            <p className="text-sm text-base-content/80 leading-relaxed whitespace-pre-wrap">
              {group.welcomeMessage}
            </p>
          )}

          {group.rules && (
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-base-content/45">
                <ScrollText size={12} />
                Group rules
              </span>
              <div className="bg-base-200/60 rounded-xl p-3.5 space-y-2">
                {/* Numbered when written as separate lines, plain otherwise —
                    so a single paragraph does not get a pointless "1." */}
                {group.rules.split("\n").filter((l) => l.trim()).map((line, i, all) => (
                  <div key={i} className="flex gap-2.5 text-sm text-base-content/80 leading-snug">
                    {all.length > 1 && (
                      <span className="text-primary font-semibold tabular-nums shrink-0">{i + 1}.</span>
                    )}
                    <span className="whitespace-pre-wrap">{line.replace(/^\s*[\d]+[.)]\s*/, "")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={dismiss}
            className="w-full h-11 rounded-xl bg-primary text-primary-content text-[14px] font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupWelcomeSheet;
