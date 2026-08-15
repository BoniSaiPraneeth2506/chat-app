import { useState } from "react";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useGroupStore } from "../store/useGroupStore";

const MAX_OPTIONS = 12;

const CreatePollModal = ({ onClose }) => {
  const { createPoll } = useGroupStore();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const updateOption = (index, value) =>
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = options.map((option) => option.trim()).filter(Boolean);

    if (!question.trim()) return toast.error("Add a question");
    if (cleaned.length < 2) return toast.error("Add at least 2 options");

    setIsCreating(true);
    const created = await createPoll({ question: question.trim(), options: cleaned, allowMultiple });
    setIsCreating(false);
    if (created) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-base-100 shadow-xl border border-base-300">
        <div className="flex items-center justify-between px-5 py-3 border-b border-base-300">
          <h3 className="font-semibold">Create poll</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-base-200" title="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <input
            autoFocus
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question"
            className="w-full px-3 py-2 text-sm rounded-lg border border-base-300 bg-base-100 focus:outline-none focus:border-primary"
          />

          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-base-300 bg-base-100 focus:outline-none focus:border-primary"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                    className="p-1.5 rounded-full hover:bg-base-200 text-base-content/50"
                    title="Remove option"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Plus size={14} /> Add option
            </button>
          )}

          <label className="flex items-center justify-between pt-1 text-xs">
            <span>Allow multiple answers</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg hover:bg-base-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-content disabled:opacity-60"
            >
              {isCreating ? "Creating..." : "Create poll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePollModal;
