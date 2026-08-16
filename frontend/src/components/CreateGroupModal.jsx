import { useEffect, useMemo, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import { X, Users, Check, Search, Camera, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

// Group creation, modelled on the two-step flow every mainstream chat app
// uses: pick people first, name the group second. Splitting it keeps each
// screen to one job instead of stacking an avatar picker, two text fields and
// a scrolling contact list into a single dense form.
//
// Presented as a full-height sheet on phones and a centred dialog from `sm:`
// up — the same component serves the web build and the Capacitor WebView.

const MAX_MEMBERS = 256;

const CreateGroupModal = () => {
  const { isCreateGroupModalOpen, setIsCreateGroupModalOpen, createGroup } = useGroupStore();
  const { users } = useChatStore();
  const { onlineUsers } = useAuthStore();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("forward");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupPic, setGroupPic] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => setIsCreateGroupModalOpen(false);

  // Reset every time the sheet opens so a cancelled attempt never leaks into
  // the next one. Keyed on the open flag rather than on unmount because the
  // component stays mounted in App.jsx.
  useEffect(() => {
    if (!isCreateGroupModalOpen) return;
    setStep(1);
    setDirection("forward");
    setName("");
    setDescription("");
    setSelectedMembers([]);
    setGroupPic("");
    setSearch("");
    setIsSubmitting(false);
  }, [isCreateGroupModalOpen]);

  // Escape closes on desktop; the hardware back button is handled in App.jsx.
  useEffect(() => {
    if (!isCreateGroupModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIsCreateGroupModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCreateGroupModalOpen, setIsCreateGroupModalOpen]);

  // Deliberately no autofocus on step 2. Focusing the name field immediately
  // throws up the soft keyboard the moment the step opens, which buries the
  // description and participant recap behind it on a phone. The user taps the
  // field when they're ready.

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? users.filter((u) => u.fullName?.toLowerCase().includes(term))
      : users;
    return [...list].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  }, [users, search]);

  const selectedUsers = useMemo(
    () => selectedMembers.map((id) => users.find((u) => u._id === id)).filter(Boolean),
    [selectedMembers, users]
  );

  if (!isCreateGroupModalOpen) return null;

  const toggleMemberSelection = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : prev.length >= MAX_MEMBERS
          ? prev
          : [...prev, userId]
    );
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setGroupPic(reader.result);
    e.target.value = "";
  };

  const goToDetails = () => {
    setDirection("forward");
    setStep(2);
  };

  const goBackToMembers = () => {
    setDirection("back");
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    // The store closes the sheet and toasts on success; on failure it toasts
    // and leaves everything in place so the attempt can be retried.
    await createGroup({
      name: name.trim(),
      description: description.trim(),
      members: selectedMembers,
      groupPic,
    });
    setIsSubmitting(false);
  };

  const stepClass = direction === "forward" ? "cg-step" : "cg-step-back";

  // One field style for every input in the sheet. Sitting on the sheet's own
  // background with a hairline border reads as part of the panel; the earlier
  // grey fill (bg-base-200) floated on top of it and was the heaviest thing on
  // the screen. The border brightens to the accent on focus.
  const fieldClass =
    "w-full bg-transparent border border-base-content/15 text-base-content placeholder:text-base-content/35 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[2px] cg-fade sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create a new group"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        /* dvh, not vh: when the Android keyboard opens, `vh` keeps reporting
           the full screen height, so the sheet stays taller than the visible
           area and its footer ends up over the fields. `dvh` tracks the
           viewport that's actually visible. */
        className="w-full sm:max-w-md h-[92dvh] sm:h-auto sm:max-h-[86dvh] bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col cg-sheet sm:cg-dialog"
      >
        {/* Grab handle — reads as a sheet on touch, hidden on desktop */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
          <span className="w-9 h-1 rounded-full bg-base-content/20" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 sm:px-5 pt-2 pb-3 flex-shrink-0">
          <button
            type="button"
            onClick={step === 1 ? close : goBackToMembers}
            data-modal-close={step === 1 ? "" : undefined}
            className="p-2 -ml-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            aria-label={step === 1 ? "Close" : "Back to members"}
          >
            {step === 1 ? <X size={20} /> : <ArrowLeft size={20} />}
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[17px] leading-tight text-base-content">
              New group
            </h2>
            <p className="text-xs text-base-content/50 leading-tight mt-0.5">
              {step === 1
                ? selectedMembers.length > 0
                  ? `${selectedMembers.length} of ${MAX_MEMBERS} selected`
                  : "Add participants"
                : "Group details"}
            </p>
          </div>

          {/* Step pips — two dots earn their place here; the flow really is
              two ordered screens, not a decorative counter. */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? "w-5 bg-primary" : "w-1.5 bg-base-content/20"}`} />
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? "w-5 bg-primary" : "w-1.5 bg-base-content/20"}`} />
          </div>
        </div>

        {step === 1 ? (
          /* ─────────────── Step 1 · choose participants ─────────────── */
          <div key="members" className={`flex-1 min-h-0 flex flex-col ${stepClass}`}>
            {/* Search */}
            <div className="px-4 sm:px-5 pb-3 flex-shrink-0">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts"
                  className={`${fieldClass} h-11 pl-10 pr-4 rounded-full text-sm`}
                />
              </div>
            </div>

            {/* Selected chips — the signature affordance of this flow: who is
                already in is visible while you keep scrolling for more. */}
            {selectedUsers.length > 0 && (
              <div className="flex-shrink-0 pb-3">
                <div className="flex gap-3 overflow-x-auto cg-scroll-x px-4 sm:px-5">
                  {selectedUsers.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => toggleMemberSelection(user._id)}
                      className="flex flex-col items-center gap-1 w-[58px] flex-shrink-0 cg-chip group"
                      aria-label={`Remove ${user.fullName}`}
                    >
                      <span className="relative">
                        <img
                          src={user.profilePic || "/avatar.png"}
                          alt=""
                          className="size-12 rounded-full object-cover"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 size-[18px] rounded-full bg-base-300 text-base-content flex items-center justify-center ring-2 ring-base-100 group-hover:bg-error group-hover:text-error-content transition-colors">
                          <X size={11} strokeWidth={3} />
                        </span>
                      </span>
                      <span className="text-[10.5px] text-base-content/70 truncate w-full text-center leading-tight">
                        {user.fullName?.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-2">
              {filteredUsers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-8 py-10">
                  <div className="size-14 rounded-full bg-base-200 flex items-center justify-center">
                    <Search size={20} className="text-base-content/30" />
                  </div>
                  <p className="text-sm font-medium text-base-content/70">No contacts found</p>
                  <p className="text-xs text-base-content/40">
                    {search ? `Nothing matches “${search}”` : "Start a chat with someone first"}
                  </p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedMembers.includes(user._id);
                  const isOnline = onlineUsers?.includes(user._id);
                  return (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => toggleMemberSelection(user._id)}
                      className="w-full flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-2xl hover:bg-base-200/70 active:bg-base-200 transition-colors text-left"
                      aria-pressed={isSelected}
                    >
                      <span className="relative flex-shrink-0">
                        <img
                          src={user.profilePic || "/avatar.png"}
                          alt=""
                          className="size-11 rounded-full object-cover"
                        />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 ring-2 ring-base-100" />
                        )}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-medium text-base-content truncate">
                          {user.fullName}
                        </span>
                        <span className="block text-xs text-base-content/45 truncate">
                          {isOnline ? "Online" : user.bio?.trim() || "Available"}
                        </span>
                      </span>

                      <span
                        className={`size-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          isSelected
                            ? "bg-primary text-primary-content"
                            : "border-2 border-base-content/20"
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} className="cg-check" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer CTA */}
            <div className="flex-shrink-0 px-4 sm:px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-base-100">
              <button
                type="button"
                onClick={goToDetails}
                disabled={selectedMembers.length === 0}
                className="w-full h-12 rounded-2xl bg-primary text-primary-content font-semibold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
              >
                Next
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        ) : (
          /* ─────────────── Step 2 · name the group ─────────────── */
          <form
            key="details"
            onSubmit={handleSubmit}
            className={`flex-1 min-h-0 flex flex-col ${stepClass}`}
          >
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              {/* Group photo */}
              <div className="flex flex-col items-center gap-2.5 pt-2 pb-6">
                <label className="relative cursor-pointer group">
                  <span className="block size-24 rounded-full overflow-hidden bg-base-200 flex items-center justify-center ring-1 ring-base-content/5">
                    {groupPic ? (
                      <img src={groupPic} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={30} className="text-base-content/30" />
                    )}
                  </span>
                  <span className="absolute bottom-0 right-0 size-8 rounded-full bg-primary text-primary-content flex items-center justify-center ring-4 ring-base-100 group-hover:scale-105 group-active:scale-95 transition-transform">
                    <Camera size={15} />
                  </span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <span className="text-xs text-base-content/45">
                  {groupPic ? "Tap to change photo" : "Add a group photo"}
                </span>
              </div>

              {/* Name */}
              <div className="space-y-1.5 mb-4">
                <label htmlFor="cg-name" className="block text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                  Group name
                </label>
                <input
                  id="cg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder="Weekend Plans"
                  className={`${fieldClass} h-12 px-4 rounded-2xl text-[15px]`}
                  required
                />
                <div className="flex justify-end">
                  <span className="text-[11px] text-base-content/35 tabular-nums">{name.length}/60</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 mb-5">
                <label htmlFor="cg-desc" className="block text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                  Description <span className="font-normal normal-case tracking-normal text-base-content/35">· optional</span>
                </label>
                <textarea
                  id="cg-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="What's this group about?"
                  className={`${fieldClass} px-4 py-3 rounded-2xl text-[15px] resize-none`}
                />
              </div>

              {/* Participants recap — confirms step 1 without going back */}
              <div className="rounded-2xl border border-base-content/12 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                    Participants
                  </span>
                  <button
                    type="button"
                    onClick={goBackToMembers}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center">
                  {selectedUsers.slice(0, 7).map((user, i) => (
                    <img
                      key={user._id}
                      src={user.profilePic || "/avatar.png"}
                      alt={user.fullName}
                      title={user.fullName}
                      className="size-9 rounded-full object-cover ring-2 ring-base-100"
                      style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}
                    />
                  ))}
                  {selectedUsers.length > 7 && (
                    <span
                      className="size-9 rounded-full bg-base-300 text-base-content/70 text-[11px] font-semibold flex items-center justify-center ring-2 ring-base-100 tabular-nums"
                      style={{ marginLeft: -10 }}
                    >
                      +{selectedUsers.length - 7}
                    </span>
                  )}
                  <span className="ml-3 text-sm text-base-content/60 tabular-nums">
                    {selectedUsers.length} {selectedUsers.length === 1 ? "person" : "people"}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="flex-shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-base-100">
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="w-full h-12 rounded-2xl bg-primary text-primary-content font-semibold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create group"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateGroupModal;
