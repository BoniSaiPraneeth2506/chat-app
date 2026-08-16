import { useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";
import { GROUP_PERMISSIONS, levelFor, canDo } from "../lib/groupPermissions";
import { buildInviteLink } from "../lib/utils";

const sectionLabel = "text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1";
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
    createGroupInvite,
    revokeGroupInvite,
  } = useGroupStore();

  const { users } = useChatStore();
  const { authUser } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(selectedGroup?.name || "");
  const [description, setDescription] = useState(selectedGroup?.description || "");
  const [groupPic, setGroupPic] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isInviteBusy, setIsInviteBusy] = useState(false);

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

  // Sends only the one key being changed; the server merges it over whatever
  // is already stored, so two admins editing different rows can't clobber
  // each other.
  const handleSetPermission = async (key, level) => {
    if (levelFor(selectedGroup, key) === level) return;
    setIsUpdatingGroup(true);
    try {
      await updateGroup(selectedGroup._id, { permissions: { [key]: level } });
    } finally {
      setIsUpdatingGroup(false);
    }
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[2px] cg-fade sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg h-[92dvh] sm:h-auto sm:max-h-[88dvh] bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col cg-sheet sm:cg-dialog"
      >
        {/* Header */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
          <span className="w-9 h-1 rounded-full bg-base-content/20" />
        </div>
        <div className="flex items-center gap-3 px-5 pt-2 pb-3 flex-shrink-0">
          <button
            onClick={() => setIsGroupDetailsModalOpen(false)}
            data-modal-close
            className="p-2 -ml-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <h3 className="font-semibold text-[17px] text-base-content">Group info</h3>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-6">
          {/* Group Overview Banner */}
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="relative group">
              <img
                src={groupPic || selectedGroup.groupPic || "/avatar.png"}
                alt={selectedGroup.name}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-base-200 shadow-lg"
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
                  className="w-full h-11 px-1 text-center font-semibold text-[15px] bg-transparent border-0 border-b border-base-content/15 rounded-none outline-none transition-colors focus:border-primary focus:ring-0"
                  placeholder="Group Name"
                  required
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-1 py-2 text-center text-[14px] bg-transparent border-0 border-b border-base-content/15 rounded-none resize-none outline-none transition-colors focus:border-primary focus:ring-0"
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
                  className="flex items-center gap-1 px-3 h-8 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-semibold transition-colors active:scale-95"
                >
                  <Plus size={14} /> Add Members
                </button>
              )}
            </div>

            {/* Add New Members Panel */}
            {showAddMembers && (
              <div className="rounded-2xl bg-base-200 p-3 space-y-3">
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
            <div className="rounded-2xl bg-base-200">
              {selectedGroup.members.map((member, index) => {
                const u = member.user;
                if (!u) return null;
                const isSelf = u._id?.toString() === authUser?._id?.toString();

                return (
                  <div
                    key={u._id}
                    className="flex items-center justify-between p-3 text-sm hover:bg-base-300/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
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
                            ? "bg-red-500/15 text-red-500"
                            : member.role === "moderator"
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-base-300/70 text-base-content/70"
                        }`}
                      >
                        {member.role === "admin" && <ShieldAlert size={12} />}
                        {member.role === "moderator" && <ShieldCheck size={12} />}
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>

                      {/* Admin Controls Dropdown for this member */}
                      {isAdmin && !isSelf && (
                        <div
                          className={`dropdown dropdown-end ${
                            index >= selectedGroup.members.length - 2 ? "dropdown-top" : ""
                          }`}
                        >
                          <label tabIndex={0} className="btn btn-ghost btn-xs btn-circle">
                            •••
                          </label>
                          <ul
                            tabIndex={0}
                            className="dropdown-content z-[1] menu p-2 shadow-2xl bg-base-100 rounded-2xl w-44 text-xs space-y-1"
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

          {/* Invite link — gated on the same permission as adding members,
              since handing out a join link is that same act by another route. */}
          {canDo(selectedGroup, currentUserRole, "addMembers") && (
            <div className="space-y-2">
              <span className={sectionLabel}>Invite link</span>
              <div className="rounded-2xl bg-base-200 p-4 space-y-3">
                {selectedGroup.inviteCode ? (
                  <>
                    <p className="text-[11px] text-base-content/50 break-all select-all">
                      {buildInviteLink(selectedGroup.inviteCode)}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(buildInviteLink(selectedGroup.inviteCode));
                            toast.success("Invite link copied");
                          } catch {
                            toast.error("Couldn't copy — long-press the link");
                          }
                        }}
                        className="h-10 rounded-xl bg-base-300/70 hover:bg-base-300 text-[12px] font-medium transition-colors"
                      >
                        Copy
                      </button>
                      <button
                        disabled={isInviteBusy}
                        onClick={async () => {
                          setIsInviteBusy(true);
                          const code = await createGroupInvite(selectedGroup._id);
                          setIsInviteBusy(false);
                          if (code) toast.success("New link created — the old one no longer works");
                        }}
                        className="h-10 rounded-xl bg-base-300/70 hover:bg-base-300 text-[12px] font-medium transition-colors disabled:opacity-40"
                      >
                        Reset
                      </button>
                      <button
                        disabled={isInviteBusy}
                        onClick={async () => {
                          setIsInviteBusy(true);
                          await revokeGroupInvite(selectedGroup._id);
                          setIsInviteBusy(false);
                        }}
                        className="h-10 rounded-xl bg-error/10 hover:bg-error/20 text-error text-[12px] font-semibold transition-colors disabled:opacity-40"
                      >
                        Revoke
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-base-content/50">
                      Anyone with the link can join. You can reset or revoke it at any time.
                    </p>
                    <button
                      disabled={isInviteBusy}
                      onClick={async () => {
                        setIsInviteBusy(true);
                        await createGroupInvite(selectedGroup._id);
                        setIsInviteBusy(false);
                      }}
                      className="w-full h-11 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-[13px] font-semibold transition-colors disabled:opacity-40"
                    >
                      Create invite link
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Group permissions — one row per restricted action.
              Visible to admins and moderators so everyone in charge can see
              the rules; only admins can change them, which the server enforces
              independently. */}
          {isAdminOrMod && (
            <div className="rounded-2xl bg-base-200 p-4 space-y-3.5">
              <div className="flex items-center gap-2">
                {levelFor(selectedGroup, "sendMessages") === "admins" ? (
                  <Lock className="size-4 text-amber-500" />
                ) : (
                  <Unlock className="size-4 text-green-500" />
                )}
                <h4 className="text-sm font-semibold">Permissions</h4>
              </div>

              {GROUP_PERMISSIONS.map(({ key, label, hint }) => {
                const current = levelFor(selectedGroup, key);
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-base-content truncate">{label}</p>
                      <p className="text-[10px] text-base-content/50 truncate">{hint}</p>
                    </div>
                    <div className="flex rounded-lg bg-base-300/60 p-0.5 flex-shrink-0">
                      {["everyone", "admins"].map((level) => (
                        <button
                          key={level}
                          type="button"
                          disabled={!isAdmin || isUpdatingGroup}
                          onClick={() => handleSetPermission(key, level)}
                          className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            current === level
                              ? "bg-primary text-primary-content"
                              : "text-base-content/60 hover:text-base-content"
                          }`}
                        >
                          {level === "everyone" ? "Everyone" : "Admins"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {!isAdmin && (
                <p className="text-[10px] text-base-content/45 pt-1">
                  Only admins can change these.
                </p>
              )}
            </div>
          )}

          {/* Leave Group Action */}
          <button
            onClick={() => removeGroupMember(selectedGroup._id, authUser._id)}
            className="w-full h-12 rounded-2xl bg-error/10 hover:bg-error/15 text-error font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <LogOut size={17} /> Leave group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailsModal;
