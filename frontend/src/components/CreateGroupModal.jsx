import { useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { X, Users, Image as ImageIcon, Check, Search, Camera } from "lucide-react";

const CreateGroupModal = () => {
  const { isCreateGroupModalOpen, setIsCreateGroupModalOpen, createGroup } = useGroupStore();
  const { users } = useChatStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupPic, setGroupPic] = useState("");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCreateGroupModalOpen) return null;

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const toggleMemberSelection = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setGroupPic(reader.result);
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await createGroup({
      name: name.trim(),
      description: description.trim(),
      members: selectedMembers,
      groupPic,
    });
    setIsSubmitting(false);
    setName("");
    setDescription("");
    setSelectedMembers([]);
    setGroupPic("");
  };

  return (
    <div
      onClick={() => setIsCreateGroupModalOpen(false)}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200/50">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h3 className="font-bold text-lg">Create New Group</h3>
          </div>
          <button
            onClick={() => setIsCreateGroupModalOpen(false)}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 rounded-full bg-base-300 overflow-hidden flex items-center justify-center border-2 border-primary/30">
                {groupPic ? (
                  <img src={groupPic} alt="Group Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Users className="size-8 text-base-content/40" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                <Camera size={20} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-xs text-base-content/60 font-medium">Group Avatar (Optional)</span>
          </div>

          {/* Group Name */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Group Name *</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Developers Club, Family Chat..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered w-full focus:input-primary"
              required
            />
          </div>

          {/* Group Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Description</span>
            </label>
            <textarea
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea textarea-bordered w-full resize-none h-20 focus:textarea-primary"
            />
          </div>

          {/* Member Selection */}
          <div className="form-control space-y-2">
            <label className="label py-0">
              <span className="label-text font-semibold">
                Add Members ({selectedMembers.length} selected)
              </span>
            </label>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input input-sm input-bordered w-full pl-9"
              />
            </div>

            {/* Contacts list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border border-base-300 rounded-xl p-2 bg-base-200/30">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-4 text-xs text-base-content/50">No contacts found</div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedMembers.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      onClick={() => toggleMemberSelection(user._id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-base-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={user.profilePic || "/avatar.png"}
                          alt={user.fullName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span className="text-sm font-medium">{user.fullName}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-primary border-primary text-primary-content"
                            : "border-base-300"
                        }`}
                      >
                        {isSelected && <Check size={13} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-base-300">
            <button
              type="button"
              onClick={() => setIsCreateGroupModalOpen(false)}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="btn btn-primary btn-sm px-5"
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "Create Group"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
