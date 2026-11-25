import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import axiosInstance from "../lib/axios";
import { useGroupStore } from "../store/useGroupStore";
import { useChannelStore } from "../store/useChannelStore";
import toast from "react-hot-toast";

const MutualGroupsPanel = ({ userId }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const setSelectedGroup = useGroupStore((s) => s.setSelectedGroup);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setGroups([]);
      return () => { active = false; };
    }
    setLoading(true);
    axiosInstance
      .get(`/messages/contact/${userId}/groups`)
      .then((res) => {
        if (active) setGroups(Array.isArray(res.data) ? res.data : Array.isArray(res.data?.groups) ? res.data.groups : []);
      })
      .catch(() => {
        if (active) setGroups([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  if (!userId) return null;

  return (
    <section>
      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide t-dim mb-2">
        <Users size={12} />
        Groups in common
      </h4>
      {loading ? (
        <div className="py-3 flex justify-center">
          <span className="loading loading-spinner loading-xs" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-xs t-dim">No shared groups yet</p>
      ) : (
        <div className="space-y-1.5">
          {groups.map((group) => (
            <button
              key={group._id}
              type="button"
              onClick={() => {
                const full = useGroupStore.getState().groups.find((g) => String(g._id) === String(group._id));
                if (!full) {
                  toast.error("Open groups once to show this one");
                  return;
                }
                useChannelStore.getState().closeChannel();
                setSelectedGroup(full);
              }}
              className="w-full flex items-center gap-2.5 rounded-xl s-chip px-2.5 py-2 text-left hover:s-row transition-colors"
            >
              {group.groupPic ? (
                <img src={group.groupPic} alt="" className="size-8 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="size-8 rounded-lg grid place-items-center bg-primary/10 text-primary shrink-0">
                  <Users size={14} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium truncate">{group.name || "Group"}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default MutualGroupsPanel;
