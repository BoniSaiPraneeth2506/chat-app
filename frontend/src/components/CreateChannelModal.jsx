import { useEffect, useState } from "react";
import { useChannelStore } from "../store/useChannelStore";
import { X, Radio, Loader2, Megaphone } from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = [
  "News",
  "Entertainment",
  "Sports",
  "Tech",
  "Business",
  "Education",
  "Health",
  "Food",
  "Travel",
  "Lifestyle",
  "Other",
];

const CreateChannelModal = () => {
  const { isCreateModalOpen, setCreateModalOpen, createChannel } = useChannelStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [avatar, setAvatar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => setCreateModalOpen(false);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    setName("");
    setDescription("");
    setCategory("");
    setPrivacy("public");
    setAvatar("");
    setIsSubmitting(false);
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setCreateModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCreateModalOpen, setCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setAvatar(reader.result);
    e.target.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createChannel({
        name: name.trim(),
        description: description.trim(),
        category,
        privacy,
        avatar,
      });
      toast.success("Channel created");
      close();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not create channel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full bg-transparent border border-base-content/15 text-base-content placeholder:text-base-content/35 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[2px] cg-fade sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create a new channel"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md h-[92dvh] sm:h-auto sm:max-h-[86dvh] bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col cg-sheet sm:cg-dialog"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
          <span className="w-9 h-1 rounded-full bg-base-content/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 pt-2 pb-3 flex-shrink-0">
          <button
            type="button"
            onClick={close}
            data-modal-close=""
            className="p-2 -ml-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[17px] leading-tight text-base-content">
              Create channel
            </h2>
            <p className="text-xs text-base-content/50 leading-tight mt-0.5">
              Broadcast to anyone who follows
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex-1 overflow-y-auto px-5 pb-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2.5 pt-2 pb-6">
              <label className="relative cursor-pointer group">
                <span className="block size-24 rounded-full overflow-hidden bg-base-200 flex items-center justify-center ring-1 ring-base-content/5">
                  {avatar ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center size-24 bg-secondary/10 text-secondary">
                      <Megaphone size={30} strokeWidth={1.6} />
                    </div>
                  )}
                </span>
                <span className="absolute bottom-0 right-0 size-8 rounded-full bg-primary text-primary-content flex items-center justify-center ring-4 ring-base-100 group-hover:scale-105 group-active:scale-95 transition-transform">
                  <Radio size={15} />
                </span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              <span className="text-xs text-base-content/45">
                {avatar ? "Tap to change photo" : "Add a channel photo"}
              </span>
            </div>

            {/* Name */}
            <div className="space-y-1.5 mb-4">
              <label htmlFor="ch-name" className="block text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                Channel name
              </label>
              <input
                id="ch-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="Tech Updates"
                className={`${fieldClass} h-12 px-4 rounded-2xl text-[15px]`}
                required
              />
              <div className="flex justify-end">
                <span className="text-[11px] text-base-content/35 tabular-nums">{name.length}/50</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5 mb-4">
              <label htmlFor="ch-desc" className="block text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                Description <span className="font-normal normal-case tracking-normal text-base-content/35">· optional</span>
              </label>
              <textarea
                id="ch-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What is this channel about?"
                className={`${fieldClass} px-4 py-3 rounded-2xl text-[15px] resize-none`}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5 mb-4">
              <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                Category <span className="font-normal normal-case tracking-normal text-base-content/35">· optional</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category === c ? "" : c)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all select-none ${
                      category === c
                        ? "bg-primary text-white border-primary"
                        : "bg-base-200 text-base-content/75 border-base-300 hover:bg-base-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div className="space-y-1.5 pb-1">
              <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                Visibility
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrivacy("public")}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    privacy === "public"
                      ? "border-primary bg-primary/5"
                      : "border-base-content/15 hover:bg-base-200"
                  }`}
                >
                  <span className="block text-sm font-semibold text-base-content">Public</span>
                  <span className="block text-xs text-base-content/50 mt-0.5">
                    Anyone can find and follow
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacy("private")}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    privacy === "private"
                      ? "border-primary bg-primary/5"
                      : "border-base-content/15 hover:bg-base-200"
                  }`}
                >
                  <span className="block text-sm font-semibold text-base-content">Private</span>
                  <span className="block text-xs text-base-content/50 mt-0.5">
                    Only via your invite link
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
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
                "Create channel"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
