import { useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import {
  X,
  Users,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Plus,
  LogOut,
  Edit2,
  Lock,
  Unlock,
  Check,
  Camera,
} from "lucide-react";

const GroupDetailsModal = () => {
  const {
    selectedGroup,
    isGroupDetailsModalOpen,
    setIsGroupDetailsModalOpen,
    updateGroup,
    addGroupMembers,
    removeGroupMember,
    updateMemberRole,
  } = useGroupStore();

  const { users } = useChatStore();
  const { authUser } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(selectedGroup?.name || "");
  const [description, setDescription] = useState(selectedGroup?.description || "");
  const [groupPic, setGroupPic] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

  if (!isGroupDetailsModalOpen || !selectedGroup) return null;

  const currentMemberObj = selectedGroup.members.find(
    (m) => m.user?._id?.toString() === authUser?._id?.toString()
  );
  const currentUserRole = currentMemberObj ? currentMemberObj.role : "member";
  const isAdminOrMod = currentUserRole === "admin" || currentUserRole === "moderator";
  const isAdmin = currentUserRole === "admin";

  const nonMembers = users.filter(
    (u) => !selectedGroup.members.some((m) => m.user?._id?.toString() === u._id.toString())
  );

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    await updateGroup(selectedGroup._id, {
      name: name.trim(),
      description: description.trim(),
      groupPic,
    });
    setIsEditing(false);
  };

  const handleToggleReadOnly = async () => {
    await updateGroup(selectedGroup._id, {
      isReadOnly: !selectedGroup.isReadOnly,
    });
  };

  const handleAddMembersSubmit = async () => {
    if (selectedNewMembers.length === 0) return;
    await addGroupMembers(selectedGroup._id, selectedNewMembers);
    setSelectedNewMembers([]);
    setShowAddMembers(false);
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

  return (
    <div
      onClick={() => setIsGroupDetailsModalOpen(false)}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200/50">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h3 className="font-bold text-lg">Group Details & Settings</h3>
          </div>
          <button
            onClick={() => setIsGroupDetailsModalOpen(false)}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Group Overview Banner */}
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="relative group">
              <img
                src={groupPic || selectedGroup.groupPic || "/avatar.png"}
                alt={selectedGroup.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 shadow-md"
              />
              {isAdminOrMod && isEditing && (
                <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer text-white">
                  <Camera size={22} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {!isEditing ? (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-xl font-bold">{selectedGroup.name}</h2>
                  {isAdminOrMod && (
                    <button
                      onClick={() => {
                        setName(selectedGroup.name);
                        setDescription(selectedGroup.description || "");
                        setIsEditing(true);
                      }}
                      className="p-1 text-base-content/50 hover:text-primary transition-colors"
                      title="Edit Group Info"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
                {selectedGroup.description && (
                  <p className="text-sm text-base-content/70 max-w-xs mx-auto">
                    {selectedGroup.description}
                  </p>
                )}
                <span className="text-xs text-base-content/50 block pt-1 font-medium">
                  {selectedGroup.members.length} Members
                </span>
              </div>
            ) : (
              <form onSubmit={handleUpdateGroup} className="w-full space-y-3 mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input input-sm input-bordered w-full font-bold text-center"
                  placeholder="Group Name"
                  required
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="textarea textarea-sm textarea-bordered w-full resize-none text-center"
                  placeholder="Group Description"
                />
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn btn-xs btn-ghost"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-xs btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Admin Permissions & Read-Only Toggle */}
          {isAdminOrMod && (
            <div className="bg-base-200/50 border border-base-300 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedGroup.isReadOnly ? (
                  <Lock className="size-5 text-amber-500" />
                ) : (
                  <Unlock className="size-5 text-green-500" />
                )}
                <div>
                  <h4 className="text-sm font-semibold">Read-Only Mode</h4>
                  <p className="text-xs text-base-content/60">
                    {selectedGroup.isReadOnly
                      ? "Only Admins and Moderators can send messages"
                      : "All members can send messages"}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={selectedGroup.isReadOnly || false}
                onChange={handleToggleReadOnly}
                className="toggle toggle-primary toggle-sm"
              />
            </div>
          )}

          {/* Members List Header & Add Member Button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <Users size={16} className="text-primary" /> Members (
                {selectedGroup.members.length})
              </h4>
              {isAdminOrMod && (
                <button
                  onClick={() => setShowAddMembers(!showAddMembers)}
                  className="btn btn-xs btn-outline btn-primary gap-1"
                >
                  <Plus size={14} /> Add Members
                </button>
              )}
            </div>

            {/* Add New Members Panel */}
            {showAddMembers && (
              <div className="bg-base-200 border border-base-300 rounded-xl p-3 space-y-3 animate-in fade-in duration-150">
                <h5 className="text-xs font-bold text-base-content/70">Select contacts to add:</h5>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {nonMembers.length === 0 ? (
                    <div className="text-xs text-base-content/50 py-2 text-center">
                      All contacts are already in this group
                    </div>
                  ) : (
                    nonMembers.map((user) => {
                      const isSel = selectedNewMembers.includes(user._id);
                      return (
                        <div
                          key={user._id}
                          onClick={() => {
                            if (isSel) {
                              setSelectedNewMembers(
                                selectedNewMembers.filter((id) => id !== user._id)
                              );
                            } else {
                              setSelectedNewMembers([...selectedNewMembers, user._id]);
                            }
                          }}
                          className="flex items-center justify-between p-2 hover:bg-base-100 rounded-lg cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={user.profilePic || "/avatar.png"}
                              alt={user.fullName}
                              className="w-6 h-6 rounded-full"
                            />
                            <span>{user.fullName}</span>
                          </div>
                          {isSel && <Check size={14} className="text-primary" />}
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedNewMembers.length > 0 && (
                  <button
                    onClick={handleAddMembersSubmit}
                    className="btn btn-xs btn-primary w-full"
                  >
                    Add {selectedNewMembers.length} Members
                  </button>
                )}
              </div>
            )}

            {/* Existing Member List */}
            <div className="border border-base-300 rounded-xl divide-y divide-base-300 bg-base-100">
              {selectedGroup.members.map((member) => {
                const u = member.user;
                if (!u) return null;
                const isSelf = u._id?.toString() === authUser?._id?.toString();

                return (
                  <div
                    key={u._id}
                    className="flex items-center justify-between p-3 text-sm hover:bg-base-200/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={u.profilePic || "/avatar.png"}
                        alt={u.fullName}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{u.fullName}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-base-300 px-1.5 py-0.5 rounded text-base-content/70">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-base-content/50 block">
                          {u.bio || u.email}
                        </span>
                      </div>
                    </div>

                    {/* Role Badge & Controls */}
                    <div className="flex items-center gap-2">
                      {/* Role Badge */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                          member.role === "admin"
                            ? "bg-red-500/10 text-red-500 border border-red-500/20"
                            : member.role === "moderator"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-base-200 text-base-content/70"
                        }`}
                      >
                        {member.role === "admin" && <ShieldAlert size={12} />}
                        {member.role === "moderator" && <ShieldCheck size={12} />}
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>

                      {/* Admin Controls Dropdown for this member */}
                      {isAdmin && !isSelf && (
                        <div className="dropdown dropdown-end">
                          <label tabIndex={0} className="btn btn-ghost btn-xs btn-circle">
                            •••
                          </label>
                          <ul
                            tabIndex={0}
                            className="dropdown-content z-[1] menu p-2 shadow-xl bg-base-100 border border-base-300 rounded-xl w-44 text-xs space-y-1"
                          >
                            <li className="menu-title text-[10px]">Set Role</li>
                            {member.role !== "admin" && (
                              <li>
                                <button
                                  onClick={() =>
                                    updateMemberRole(selectedGroup._id, u._id, "admin")
                                  }
                                >
                                  Make Admin
                                </button>
                              </li>
                            )}
                            {member.role !== "moderator" && (
                              <li>
                                <button
                                  onClick={() =>
                                    updateMemberRole(selectedGroup._id, u._id, "moderator")
                                  }
                                >
                                  Make Moderator
                                </button>
                              </li>
                            )}
                            {member.role !== "member" && (
                              <li>
                                <button
                                  onClick={() =>
                                    updateMemberRole(selectedGroup._id, u._id, "member")
                                  }
                                >
                                  Make Member
                                </button>
                              </li>
                            )}
                            <div className="divider my-0"></div>
                            <li>
                              <button
                                onClick={() => removeGroupMember(selectedGroup._id, u._id)}
                                className="text-red-500 hover:bg-red-500/10"
                              >
                                <UserX size={14} /> Remove Member
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <div className="pt-4 border-t border-base-300">
            <button
              onClick={() => removeGroupMember(selectedGroup._id, authUser._id)}
              className="btn btn-outline btn-error btn-sm w-full gap-2"
            >
              <LogOut size={16} /> Leave Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailsModal;
