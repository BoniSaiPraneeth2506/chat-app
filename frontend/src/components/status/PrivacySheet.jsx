import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import ContactPickerSheet from "../ContactPickerSheet";
import { haptic } from "../../lib/haptics";
import { useStatusCandidates, PRIVACY_OPTIONS, PRIVACY_META } from "./StatusEditorShell";
import axiosInstance from "../../lib/axios";

/**
 * Who a status is for.
 *
 * The list is only ever what the sheet needs; the enforcement lives in
 * lib/statusPrivacy.js on the server. Nothing here is trusted, which is the
 * point — a client that hid a row it should not have shown is a bug, and a
 * server that let one through is a privacy failure.
 */
const PrivacySheet = ({ open, onClose, privacy, onChange, initialTab }) => {
  const [tab, setTab] = useState(initialTab || "mode");
  const [picking, setPicking] = useState(null); // "include" | "exclude" | "closeFriends"
  const [closeFriends, setCloseFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const candidates = useStatusCandidates();

  useEffect(() => {
    if (!open) return;
    setTab(initialTab || "mode");
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || closeFriends.length > 0 || loadingFriends) return;
    setLoadingFriends(true);
    axiosGetCloseFriends()
      .then((list) => setCloseFriends(list))
      .catch(() => setCloseFriends([]))
      .finally(() => setLoadingFriends(false));
  }, [open, closeFriends.length, loadingFriends]);

  if (!open) return null;

  const meta = PRIVACY_META[privacy.mode] || PRIVACY_META.contacts;
  const nameOf = (id) => {
    const user = candidates.find((u) => String(u._id) === String(id));
    return user?.fullName || "Someone";
  };

  const setMode = (mode) => {
    haptic("tap");
    onChange({ ...privacy, mode });
  };

  const toggleIn = (field, id) => {
    haptic("tap");
    const list = privacy[field] || [];
    const next = list.some((x) => String(x) === String(id))
      ? list.filter((x) => String(x) !== String(id))
      : [...list, id];
    onChange({ ...privacy, [field]: next });
  };

  const saveCloseFriends = async (list) => {
    const previous = closeFriends;
    setCloseFriends(list); // optimistic — the tick should land under the thumb
    try {
      const res = await axiosInstance.put("/status/close-friends", {
        closeFriends: list.map((u) => u._id),
      });
      setCloseFriends(res.data?.closeFriends || list);
    } catch (err) {
      console.error("Could not save close friends:", err);
      setCloseFriends(previous);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-sm bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 flex-shrink-0">
            <h3 className="text-base font-semibold text-base-content">Who can see this</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-base-200 transition-colors"
              aria-label="Close"
            >
              <X size={18} className="text-base-content/60" />
            </button>
          </div>

          {/* Tab bar: pick an audience, or manage the close-friends list itself. */}
          <div className="flex gap-1 px-4 pt-3 flex-shrink-0">
            <button
              onClick={() => setTab("mode")}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                tab === "mode" ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
              }`}
            >
              Audience
            </button>
            <button
              onClick={() => setTab("closeFriends")}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                tab === "closeFriends"
                  ? "bg-primary text-primary-content"
                  : "bg-base-200 text-base-content/70"
              }`}
            >
              Close friends ({closeFriends.length})
            </button>
          </div>

          {tab === "mode" ? (
            <div className="overflow-y-auto px-3 py-3">
              {PRIVACY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = privacy.mode === option.mode;
                return (
                  <button
                    key={option.mode}
                    onClick={() => setMode(option.mode)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-base-200/70 transition-colors text-left"
                  >
                    <span className="size-9 rounded-xl bg-base-200 grid place-items-center flex-shrink-0">
                      <Icon size={16} className={selected ? "text-primary" : "text-base-content/50"} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-base-content">
                        {option.label}
                      </span>
                      <span className="block text-[11px] text-base-content/50">{option.hint}</span>
                    </span>
                    {selected && <Check size={17} className="text-primary flex-shrink-0" />}
                  </button>
                );
              })}

              {/* The name lists for the two modes that use them. */}
              {privacy.mode === "only" && (
                <div className="mt-3 pt-3 border-t border-base-200">
                  <button
                    onClick={() => setPicking("include")}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-base-200/60 hover:bg-base-200 transition-colors"
                  >
                    <span className="text-sm text-base-content">
                      Share with{" "}
                      <strong className="text-primary">
                        {(privacy.include || []).length || "no one yet"}
                      </strong>
                    </span>
                    <span className="text-xs text-primary font-medium">Choose</span>
                  </button>
                  {(privacy.include || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {privacy.include.map((id) => (
                        <div key={id} className="flex items-center gap-2 px-3 py-1.5">
                          <span className="text-sm text-base-content/70 flex-1 truncate">
                            {nameOf(id)}
                          </span>
                          <button
                            onClick={() => toggleIn("include", id)}
                            className="text-base-content/40 hover:text-red-500"
                            aria-label="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {privacy.mode === "except" && (
                <div className="mt-3 pt-3 border-t border-base-200">
                  <button
                    onClick={() => setPicking("exclude")}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-base-200/60 hover:bg-base-200 transition-colors"
                  >
                    <span className="text-sm text-base-content">
                      Hide from{" "}
                      <strong className="text-primary">
                        {(privacy.exclude || []).length || "no one"}
                      </strong>
                    </span>
                    <span className="text-xs text-primary font-medium">Choose</span>
                  </button>
                  {(privacy.exclude || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {privacy.exclude.map((id) => (
                        <div key={id} className="flex items-center gap-2 px-3 py-1.5">
                          <span className="text-sm text-base-content/70 flex-1 truncate">
                            {nameOf(id)}
                          </span>
                          <button
                            onClick={() => toggleIn("exclude", id)}
                            className="text-base-content/40 hover:text-red-500"
                            aria-label="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {privacy.mode === "closeFriends" && closeFriends.length === 0 && (
                <p className="px-3 py-3 text-xs text-base-content/50">
                  Your close friends list is empty. Add people on the Close friends
                  tab — nobody is told who is on it.
                </p>
              )}

              <p className="px-3 py-3 text-[11px] text-base-content/40 leading-relaxed">
                This is enforced on the server. A status you exclude someone from is
                not sent to their device at all.
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto px-3 py-3">
              <p className="px-3 py-2 text-xs text-base-content/50">
                Only you can see this list. Nobody is told they are on it, and it is
                not included anywhere a profile is returned.
              </p>
              {candidates.length === 0 ? (
                <p className="px-3 py-8 text-sm text-center text-base-content/40">
                  No people in your chats yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  {candidates.map((user) => {
                    const isFriend = closeFriends.some((f) => String(f._id) === String(user._id));
                    return (
                      <button
                        key={user._id}
                        onClick={() => {
                          haptic("tap");
                          const next = isFriend
                            ? closeFriends.filter((f) => String(f._id) !== String(user._id))
                            : [...closeFriends, user];
                          void saveCloseFriends(next);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-base-200/70 transition-colors text-left"
                      >
                        <img
                          src={user.profilePic || "/avatar.png"}
                          alt=""
                          className="size-9 rounded-full object-cover flex-shrink-0"
                        />
                        <span className="flex-1 min-w-0 text-sm text-base-content truncate">
                          {user.fullName}
                        </span>
                        {isFriend && <Check size={17} className="text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="px-5 py-3.5 border-t border-base-200 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full h-11 rounded-2xl bg-primary text-primary-content font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {picking && (
        <ContactPickerSheet
          onClose={() => setPicking(null)}
          onPick={(user) => {
            toggleIn(picking, user._id);
            setPicking(null);
          }}
        />
      )}
    </>
  );
};

const axiosGetCloseFriends = async () => {
  const res = await axiosInstance.get("/status/close-friends");
  return res.data?.closeFriends || [];
};

export default PrivacySheet;
