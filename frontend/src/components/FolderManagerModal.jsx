import { useEffect, useMemo, useState } from "react";
import { Check, Folder, FolderPlus, Plus, Trash2, X } from "lucide-react";
import axiosInstance from "../lib/axios";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";

const DEFAULT_FOLDER_EMOJI = "";

const normalizeFolders = (value) =>
  Array.isArray(value)
    ? value
        .filter((f) => f && typeof f === "object")
        .map((f) => ({
          id: String(f.id || f._id || ""),
          name: String(f.name || "").trim(),
          emoji: String(f.emoji || ""),
          users: Array.isArray(f.users) ? f.users.map(String) : [],
          groups: Array.isArray(f.groups) ? f.groups.map(String) : [],
          createdAt: f.createdAt || null,
        }))
        .filter((f) => f.name)
    : [];

const FolderManagerModal = ({ users = [], groups = [], onClose }) => {
  const authUser = useAuthStore((s) => s.authUser);
  const setAuthUser = useAuthStore((s) => s.setAuthUser);

  const initialFolders = useMemo(() => normalizeFolders(authUser?.folders), [authUser?.folders]);
  const [folders, setFolders] = useState(initialFolders);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_FOLDER_EMOJI);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/auth/folders");
        if (!active) return;
        const next = normalizeFolders(Array.isArray(res.data) ? res.data : res.data?.folders);
        setFolders(next);
        const current = useAuthStore.getState().authUser;
        if (current) setAuthUser({ ...current, folders: next });
      } catch {
        // Keep local auth snapshot if endpoint is temporarily unavailable.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [setAuthUser]);

  const toggle = (list, setList, id) => {
    const value = String(id);
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const resetDraft = () => {
    setName("");
    setEmoji(DEFAULT_FOLDER_EMOJI);
    setSelectedUsers([]);
    setSelectedGroups([]);
  };

  const addFolder = () => {
    const clean = name.trim();
    if (!clean) return toast.error("Give the folder a name");
    if (clean.length > 24) return toast.error("Folder name is too long");
    if (folders.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
      return toast.error("A folder with that name already exists");
    }
    if (folders.length >= 5) return toast.error("You can keep up to 5 folders");

    setFolders((current) => [
      ...current,
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: clean,
        emoji,
        users: [...selectedUsers],
        groups: [...selectedGroups],
        createdAt: new Date().toISOString(),
      },
    ]);
    resetDraft();
  };

  const removeFolder = (id) => {
    setFolders((current) => current.filter((f) => String(f.id) !== String(id)));
  };

  const save = async () => {
    if (saving) return;
    const draftName = name.trim();
    let foldersToSave = folders;

    if (draftName) {
      if (draftName.length > 24) return toast.error("Folder name is too long");
      if (folders.some((f) => f.name.toLowerCase() === draftName.toLowerCase())) {
        return toast.error("A folder with that name already exists");
      }
      if (folders.length >= 5) return toast.error("You can keep up to 5 folders");
      foldersToSave = [
        ...folders,
        {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: draftName,
          emoji,
          users: [...selectedUsers],
          groups: [...selectedGroups],
        },
      ];
    }

    setSaving(true);
    try {
      const payload = foldersToSave.map((f) => ({
        id: String(f.id || ""),
        name: String(f.name || "").trim().slice(0, 24),
        emoji: String(f.emoji || "").slice(0, 8),
        users: Array.isArray(f.users) ? f.users.map(String) : [],
        groups: Array.isArray(f.groups) ? f.groups.map(String) : [],
      }));
      const res = await axiosInstance.put("/auth/folders", { folders: payload });
      const nextFolders = normalizeFolders(Array.isArray(res.data) ? res.data : res.data?.folders);
      const current = useAuthStore.getState().authUser;
      if (current) setAuthUser({ ...current, folders: nextFolders });
      setFolders(nextFolders);
      resetDraft();
      toast.success("Folders saved");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save folders");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[86dvh] flex flex-col rounded-3xl bg-base-100 shadow-2xl cg-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div>
            <h3 className="font-semibold text-base text-base-content">Chat folders</h3>
            <p className="text-[11px] t-dim">Create folders and pick chats for them.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-base-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide t-dim">Saved folders</p>
            {loading ? (
              <div className="rounded-2xl border border-base-300 px-3 py-3 text-xs t-dim">Loading folders...</div>
            ) : folders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-base-300 px-3 py-4 text-center">
                <div className="mx-auto mb-2 size-9 rounded-full bg-base-200 grid place-items-center text-base-content/60">
                  <Folder size={16} />
                </div>
                <p className="text-xs font-medium text-base-content/80">No folders yet</p>
                <p className="text-[11px] t-dim">Create one below, then tap Save folders.</p>
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder.id || folder.name} className="flex items-center gap-3 rounded-2xl border border-base-300 px-3 py-2.5">
                  <span className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                    <Folder size={17} strokeWidth={1.9} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate text-base-content">{folder.name}</span>
                    <span className="block text-[10px] t-dim">
                      {(folder.users?.length || 0) + (folder.groups?.length || 0)} chats
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFolder(folder.id)}
                    className="p-2 rounded-full hover:bg-base-200 hover:text-error"
                    aria-label={`Delete ${folder.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-base-300 p-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide t-dim">New folder</p>
            <p className="text-[11px] t-dim -mt-2">Type a name and tap Save folders. Use + to add another folder before saving.</p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Folder name"
                className="field-flat flex-1 min-w-0 h-10 px-3 rounded-xl bg-base-200 text-sm text-base-content"
              />
              <button
                type="button"
                onClick={addFolder}
                disabled={folders.length >= 5}
                className="size-10 grid place-items-center rounded-xl bg-primary text-primary-content disabled:opacity-40"
                aria-label="Add folder"
                title="Add folder"
              >
                <Plus size={18} />
              </button>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide t-dim mb-2">People</p>
              <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                {users.map((user) => {
                  const id = String(user._id);
                  const active = selectedUsers.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(selectedUsers, setSelectedUsers, id)}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-base-300 s-chip"
                      }`}
                    >
                      {active && <Check size={11} />}
                      {user.fullName || "User"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide t-dim mb-2">Groups</p>
              <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                {groups.map((group) => {
                  const id = String(group._id);
                  const active = selectedGroups.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(selectedGroups, setSelectedGroups, id)}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-base-300 s-chip"
                      }`}
                    >
                      {active && <Check size={11} />}
                      {group.name || "Group"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-base-300">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full hover:bg-base-200 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-full bg-primary text-primary-content text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save folders"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderManagerModal;
