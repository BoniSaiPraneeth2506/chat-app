import { Users } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";

const SidebarSkeleton = () => {
  const { selectedUser } = useChatStore();
  // Create 8 skeleton items
  const skeletonContacts = Array(8).fill(null);

  return (
    <aside
      className={`flex flex-col h-full transition-all duration-200 border-r border-base-300 w-full lg:w-72
        ${selectedUser ? "hidden lg:flex" : "flex"}
      `}
    >
      {/* Header */}
      <div className="w-full pt-1.5 px-4 pb-3">
        <div className="relative w-full">
          <div className="w-full h-10 rounded-full skeleton bg-base-200" />
        </div>
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-0.5">
          {Array(4).fill(null).map((_, i) => (
            <div key={i} className="w-14 h-7 rounded-full skeleton bg-base-200" />
          ))}
        </div>
      </div>

      {/* Skeleton Contacts */}
      <div className="flex-1 overflow-y-auto">
        {skeletonContacts.map((_, idx) => (
          <div key={idx} className="flex items-center w-full gap-3 py-3.5 px-4">
            {/* Avatar skeleton */}
            <div className="relative mx-0 flex-shrink-0">
              <div className="rounded-full skeleton size-12" />
            </div>

            {/* User info skeleton */}
            <div className="flex-1 min-w-0 text-left">
              <div className="w-32 h-4 mb-2 skeleton" />
              <div className="w-16 h-3 skeleton" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default SidebarSkeleton;