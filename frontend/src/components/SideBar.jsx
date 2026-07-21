// import { useEffect, useState } from "react";
// import { useChatStore } from "../store/useChatStore";
// import  useAuthStore  from "../store/useAuthStore";
// import SidebarSkeleton from "./skeletons/SidebarSkeleton";
// import { Users } from "lucide-react";

// const Sidebar = () => {
//   const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();

//   const { onlineUsers } = useAuthStore();
//   const [showOnlineOnly, setShowOnlineOnly] = useState(false);

//   useEffect(() => {
//     getUsers();
//   }, [getUsers]);

//   const filteredUsers = showOnlineOnly
//     ? users.filter((user) => onlineUsers.includes(user._id))
//     : users;

//   if (isUsersLoading) return <SidebarSkeleton />;

//   return (
//     <aside className="flex flex-col w-20 h-full transition-all duration-200 border-r lg:w-72 border-base-300">
//       <div className="w-full p-5 border-b border-base-300">
//         <div className="flex items-center gap-2">
//           <Users className="ml-2 size-6" />
//           <span className="hidden font-medium lg:block">Contacts</span>
//         </div>
//         {/* TODO: Online filter toggle */}
//         <div className="items-center hidden gap-2 mt-3 lg:flex">
//           <label className="flex items-center gap-2 cursor-pointer">
//             <input
//               type="checkbox"
//               checked={showOnlineOnly}
//               onChange={(e) => setShowOnlineOnly(e.target.checked)}
//               className="checkbox checkbox-sm"
//             />
//             <span className="text-sm">Show online only</span>
//           </label>
//           <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
//         </div>
//       </div>

//       <div className="w-full py-3 overflow-y-auto">
//         {filteredUsers.map((user) => (
//           <button
//             key={user._id}
//             onClick={() => setSelectedUser(user)}
//             className={`
//               w-full p-3 flex items-center gap-3
//               hover:bg-base-300 transition-colors
//               ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
//             `}
//           >
//             <div className="relative mx-auto lg:mx-0">
//               <img
//                 src={user.profilePic || "/avatar.png"}
//                 alt={user.name}
//                 className="object-cover rounded-full size-12"
//               />
//               {onlineUsers.includes(user._id) && (
//                 <span
//                   className="absolute bottom-0 right-0 bg-green-500 rounded-full size-3 ring-2 ring-zinc-900"
//                 />
//               )}
//             </div>

//             {/* User info - only visible on larger screens */}
//             <div className="hidden min-w-0 text-left lg:block">
//               <div className="font-medium truncate">{user.fullName}</div>
//               <div className="text-sm text-zinc-400">
//                 {onlineUsers.includes(user._id) ? "Online" : "Offline"}
//               </div>
//             </div>
//           </button>
//         ))}

//         {filteredUsers.length === 0 && (
//           <div className="py-4 text-center text-zinc-500">No online users</div>
//         )}
//       </div>
//     </aside>
//   );
// };
// export default Sidebar;

// import { useEffect, useState } from "react";
// import { useChatStore } from "../store/useChatStore";
// import useAuthStore from "../store/useAuthStore";
// import SidebarSkeleton from "./skeletons/SidebarSkeleton";
// import { Users, X } from "lucide-react";

// const Sidebar = () => {
//   const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
//   const { onlineUsers } = useAuthStore();
//   const [showOnlineOnly, setShowOnlineOnly] = useState(false);
//   const [isMobileOpen, setIsMobileOpen] = useState(false);

//   useEffect(() => {
//     getUsers();
//   }, [getUsers]);

//   const filteredUsers = showOnlineOnly
//     ? users.filter((user) => onlineUsers.includes(user._id))
//     : users;

//   if (isUsersLoading) return <SidebarSkeleton />;

//   return (
//     <>
//       {/* Mobile Overlay */}
//       {isMobileOpen && (
//         <div
//           className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
//           onClick={() => setIsMobileOpen(false)}
//         />
//       )}

//       {/* Mobile Toggle Button */}
//       <button
//         onClick={() => setIsMobileOpen(true)}
//         className="fixed z-50 p-2 rounded-lg top-4 left-4 bg-base-200 lg:hidden"
//       >
//         <Users className="size-5" />
//       </button>

//       {/* Sidebar */}
//       <aside className={`
//         flex flex-col h-full transition-all duration-300 border-r border-base-300 bg-base-100
//         ${isMobileOpen
//           ? 'fixed inset-y-0 left-0 z-50 w-full sm:w-80'
//           : selectedUser
//             ? 'hidden lg:flex lg:w-72'
//             : 'w-20 lg:w-72'
//         }
//       `}>
//         {/* Header */}
//         <div className="w-full p-5 border-b border-base-300">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Users className="size-6" />
//               <span className={`font-medium ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
//                 Contacts
//               </span>
//             </div>

//             {/* Close button for mobile */}
//             {isMobileOpen && (
//               <button
//                 onClick={() => setIsMobileOpen(false)}
//                 className="p-1 rounded-lg lg:hidden hover:bg-base-200"
//               >
//                 <X className="size-5" />
//               </button>
//             )}
//           </div>

//           {/* Online filter toggle */}
//           <div className={`items-center gap-2 mt-3 ${isMobileOpen ? 'flex' : 'hidden lg:flex'}`}>
//             <label className="flex items-center gap-2 cursor-pointer">
//               <input
//                 type="checkbox"
//                 checked={showOnlineOnly}
//                 onChange={(e) => setShowOnlineOnly(e.target.checked)}
//                 className="checkbox checkbox-sm"
//               />
//               <span className="text-sm">Show online only</span>
//             </label>
//             <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
//           </div>
//         </div>

//         {/* Users List */}
//         <div className="w-full py-3 overflow-y-auto">
//           {filteredUsers.map((user) => (
//             <button
//               key={user._id}
//               onClick={() => {
//                 setSelectedUser(user);
//                 setIsMobileOpen(false); // Close sidebar on mobile after selection
//               }}
//               className={`
//                 w-full p-3 flex items-center gap-3
//                 hover:bg-base-300 transition-colors
//                 ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
//               `}
//             >
//               <div className={`relative ${isMobileOpen ? 'mx-0' : 'mx-auto lg:mx-0'}`}>
//                 <img
//                   src={user.profilePic || "/avatar.png"}
//                   alt={user.name}
//                   className="object-cover rounded-full size-12"
//                 />
//                 {onlineUsers.includes(user._id) && (
//                   <span className="absolute bottom-0 right-0 bg-green-500 rounded-full size-3 ring-2 ring-zinc-900" />
//                 )}
//               </div>

//               {/* User info */}
//               <div className={`min-w-0 text-left ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
//                 <div className="font-medium truncate">{user.fullName}</div>
//                 <div className="text-sm text-zinc-400">
//                   {onlineUsers.includes(user._id) ? "Online" : "Offline"}
//                 </div>
//               </div>
//             </button>
//           ))}

//           {filteredUsers.length === 0 && (
//             <div className="py-4 text-center text-zinc-500">No online users</div>
//           )}
//         </div>
//       </aside>
//     </>
//   );
// };

// export default Sidebar;

// import { useEffect, useState } from "react";
// import { useChatStore } from "../store/useChatStore";
// import useAuthStore from "../store/useAuthStore";
// import SidebarSkeleton from "./skeletons/SidebarSkeleton";
// import { Users, X } from "lucide-react";

// const Sidebar = () => {
//   const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
//   const { onlineUsers } = useAuthStore();
//   const [showOnlineOnly, setShowOnlineOnly] = useState(false);
//   const [isMobileOpen, setIsMobileOpen] = useState(false);

//   useEffect(() => {
//     getUsers();
//   }, [getUsers]);

//   const filteredUsers = showOnlineOnly
//     ? users.filter((user) => onlineUsers.includes(user._id))
//     : users;

//   if (isUsersLoading) return <SidebarSkeleton />;

//   return (
//     <>
//       {/* Mobile Overlay */}
//       {isMobileOpen && (
//         <div
//           className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
//           onClick={() => setIsMobileOpen(false)}
//         />
//       )}

//       {/* Sidebar */}
//       <aside className={`
//         flex flex-col h-full transition-all duration-300 border-r border-base-300 bg-base-100
//         ${isMobileOpen
//           ? 'fixed inset-y-0 left-0 z-50 w-full sm:w-80'
//           : 'w-20 lg:w-72'
//         }
//       `}>
//         {/* Header */}
//         <div className="w-full p-3 ml-2 border-b sm:p-5 border-base-300">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               {/* Toggle button - only visible on small screens when sidebar is collapsed */}
//               {!isMobileOpen && (
//                 <button
//                   onClick={() => setIsMobileOpen(true)}
//                   className="p-2 transition-colors rounded-lg lg:hidden hover:bg-base-200"
//                   aria-label="Open sidebar"
//                 >
//                   <Users className="size-6" />
//                 </button>
//               )}

//               {/* Users icon and title - visible when expanded */}
//               <div className={`flex items-center gap-2 ${isMobileOpen ? 'flex' : 'hidden lg:flex'}`}>
//                 <Users className="size-6" />
//                 <span className="font-medium sm:text-xl">Contacts</span>
//               </div>
//             </div>

//             {/* Close button for mobile */}
//             {isMobileOpen && (
//               <button
//                 onClick={() => setIsMobileOpen(false)}
//                 className="p-1 transition-colors rounded-lg lg:hidden hover:bg-base-200"
//                 aria-label="Close sidebar"
//               >
//                 <X className="size-5" />
//               </button>
//             )}
//           </div>

//           {/* Online filter toggle */}
//           <div className={`items-center gap-2 mt-3 ${isMobileOpen ? 'flex' : 'hidden lg:flex'}`}>
//             <label className="flex items-center gap-2 cursor-pointer">
//               <input
//                 type="checkbox"
//                 checked={showOnlineOnly}
//                 onChange={(e) => setShowOnlineOnly(e.target.checked)}
//                 className="checkbox checkbox-sm"
//               />
//               <span className="text-sm">Show online only</span>
//             </label>
//             <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
//           </div>
//         </div>

//         {/* Users List */}
//         <div className="w-full py-3 overflow-y-auto">
//           {filteredUsers.map((user) => (
//             <button
//               key={user._id}
//               onClick={() => {
//                 setSelectedUser(user);
//                 setIsMobileOpen(false); // Close sidebar on mobile after selection
//               }}
//               className={`
//                 w-full p-3 flex items-center gap-3
//                 hover:bg-base-300 transition-colors
//                 ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
//               `}
//             >
//               <div className={`relative ${isMobileOpen ? 'mx-0' : 'mx-auto lg:mx-0'}`}>
//                 <img
//                   src={user.profilePic || "/avatar.png"}
//                   alt={user.name}
//                   className="object-cover rounded-full size-12"
//                 />
//                 {onlineUsers.includes(user._id) && (
//                   <span className="absolute bottom-0 right-0 bg-green-500 rounded-full size-3 ring-2 ring-zinc-900" />
//                 )}
//               </div>

//               {/* User info */}
//               <div className={`min-w-0 text-left ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
//                 <div className="font-medium truncate">{user.fullName}</div>
//                 <div className="text-sm text-zinc-400">
//                   {onlineUsers.includes(user._id) ? "Online" : "Offline"}
//                 </div>
//               </div>
//             </button>
//           ))}

//           {filteredUsers.length === 0 && (
//             <div className={`py-4 text-center text-zinc-500 ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
//               No online users
//             </div>
//           )}
//         </div>
//       </aside>
//     </>
//   );
// };

// export default Sidebar;
import { useEffect, useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { X, Search, Pin, Star, Archive, Bookmark } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import toast from "react-hot-toast";

const SingleCheck = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 8.5L6.5 12L13.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DoubleCheck = ({ className }) => (
  <svg viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1.5 8.5L5 12L12 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 8.5L9.5 12L16.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SideBar = () => {
  const { 
    getUsers, 
    users, 
    selectedUser, 
    setSelectedUser, 
    isUsersLoading, 
    latestMessages, 
    unreadCounts, 
    lastReadTimestamps,
    clearChatHistory 
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [favoriteUsers, setFavoriteUsers] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("favoriteUsers"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [archivedUsers, setArchivedUsers] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("archivedUsers"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [pinnedUserIds, setPinnedUserIds] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("pinnedUserIds"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, userId }
  const pressTimerRef = useRef(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      getUsers(searchTerm);
    }, searchTerm ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [getUsers, searchTerm]);

  const toggleFavorite = (e, userId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const isFav = Array.isArray(favoriteUsers) && favoriteUsers.includes(userId);
    const updated = isFav
      ? favoriteUsers.filter((id) => id !== userId)
      : [...(Array.isArray(favoriteUsers) ? favoriteUsers : []), userId];
    setFavoriteUsers(updated);
    localStorage.setItem("favoriteUsers", JSON.stringify(updated));
  };

  const toggleArchive = (e, userId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const isArchived = Array.isArray(archivedUsers) && archivedUsers.includes(userId);
    const updated = isArchived
      ? archivedUsers.filter((id) => id !== userId)
      : [...(Array.isArray(archivedUsers) ? archivedUsers : []), userId];
    setArchivedUsers(updated);
    localStorage.setItem("archivedUsers", JSON.stringify(updated));
  };

  const togglePin = (userId) => {
    const isPinned = Array.isArray(pinnedUserIds) && pinnedUserIds.includes(userId);
    let updated;
    if (isPinned) {
      updated = pinnedUserIds.filter((id) => id !== userId);
    } else {
      if (Array.isArray(pinnedUserIds) && pinnedUserIds.length >= 2) {
        toast.error("You can only pin up to 2 chats");
        return;
      }
      updated = [...(Array.isArray(pinnedUserIds) ? pinnedUserIds : []), userId];
    }
    setPinnedUserIds(updated);
    localStorage.setItem("pinnedUserIds", JSON.stringify(updated));
  };

  const handleTouchStart = (userId, e) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    pressTimerRef.current = setTimeout(() => {
      setContextMenu({
        x: clientX,
        y: clientY,
        userId: userId
      });
    }, 600);
  };

  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const filteredUsers = Array.isArray(users)
    ? users.filter((user) => {
        if (!user || !user.fullName) return false;

        // Archive check
        const isArchived = Array.isArray(archivedUsers) && archivedUsers.includes(user._id);
        if (showArchivedOnly) {
          if (!isArchived) return false;
        } else {
          if (isArchived) return false;
        }

        const isOnline = user._id && Array.isArray(onlineUsers) ? onlineUsers.includes(user._id) : false;
        const matchesSearch = user.fullName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Filters
        if (filterMode === "unread") {
          const hasUnread = unreadCounts[user._id] > 0;
          if (!hasUnread) return false;
        } else if (filterMode === "favorites") {
          const isFav = Array.isArray(favoriteUsers) && favoriteUsers.includes(user._id);
          if (!isFav) return false;
        } else if (filterMode === "online") {
          if (!isOnline) return false;
        }

        return true;
      })
    : [];

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const isPinnedA = Array.isArray(pinnedUserIds) && pinnedUserIds.includes(a._id);
    const isPinnedB = Array.isArray(pinnedUserIds) && pinnedUserIds.includes(b._id);

    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;

    const msgA = latestMessages[a._id];
    const msgB = latestMessages[b._id];
    const timeA = msgA ? new Date(msgA.createdAt).getTime() : 0;
    const timeB = msgB ? new Date(msgB.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const renderTicks = (msg) => {
    if (!msg || !authUser || msg.senderId !== authUser._id) return null;

    const receiverId = msg.receiverId;
    const isOnline = onlineUsers.includes(receiverId);

    // If recipient has read it
    const lastReadTime = lastReadTimestamps[receiverId] || 0;
    const messageTime = new Date(msg.createdAt).getTime();

    if (messageTime <= lastReadTime) {
      return <DoubleCheck className="w-[15px] h-[13px] text-blue-500 flex-shrink-0" />;
    }

    // If recipient is online
    if (isOnline) {
      return <DoubleCheck className="w-[15px] h-[13px] text-zinc-400 flex-shrink-0" />;
    }

    // Otherwise, sent
    return <SingleCheck className="w-[13px] h-[13px] text-zinc-400 flex-shrink-0" />;
  };

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside
      className={`flex flex-col h-full transition-all duration-300 border-r border-base-300 bg-base-100 w-full lg:w-72
        ${selectedUser ? "hidden lg:flex" : "flex"}
      `}
    >
      <div className="w-full pt-1.5 px-4 pb-3">
        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute -translate-y-1/2 left-4 top-1/2 size-4 text-base-content/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search or start a new chat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-11 pr-10 transition-all rounded-full border-0 border-transparent focus:border-transparent hover:border-transparent bg-base-200 text-sm text-base-content placeholder-base-content/40 focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-transparent focus:bg-base-200/60"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute -translate-y-1/2 right-3 top-1/2 p-1 hover:bg-base-300 rounded-full text-base-content/40 hover:text-base-content transition-colors flex items-center justify-center"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Capsules */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "favorites", label: "Favorites" },
            { id: "online", label: "Online" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterMode(tab.id);
                setShowArchivedOnly(false);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-full border transition-all flex-shrink-0 select-none
                ${
                  filterMode === tab.id && !showArchivedOnly
                    ? "bg-primary text-white border-primary"
                    : "bg-base-200 text-base-content/75 border-base-300 hover:bg-base-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Archived Chats Header/Toggle row */}
        {showArchivedOnly ? (
          <div className="w-full px-4 py-3 flex items-center gap-3 bg-base-200 select-none">
            <button
              onClick={() => setShowArchivedOnly(false)}
              className="p-1 hover:bg-base-300 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-base-content" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <span className="font-semibold text-xs text-base-content">Archived Chats</span>
          </div>
        ) : (
          archivedUsers.length > 0 && (
            <button
              onClick={() => setShowArchivedOnly(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-base-200/40 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4.5 text-neutral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span className="font-semibold text-xs text-base-content">Archived</span>
              </div>
              <span className="text-xs font-semibold text-primary">{archivedUsers.length}</span>
            </button>
          )
        )}

        {/* Personal Notes (Self-Chat) */}
        {!showArchivedOnly && (!searchTerm || "personal notes drafts you".includes(searchTerm.toLowerCase())) && (
          <button
            onClick={() => setSelectedUser(authUser)}
            className={`w-full py-3.5 px-4 flex items-center gap-3 hover:bg-base-200/60 transition-colors group select-none
              ${selectedUser?._id === authUser?._id ? "bg-base-200/80" : ""}
            `}
          >
            <div className="relative flex-shrink-0">
              <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Bookmark className="size-5" />
              </div>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-base-content truncate">Personal Notes (You)</span>
              </div>
              <div className="text-sm text-base-content/60 truncate">
                {latestMessages[authUser?._id] ? (
                  latestMessages[authUser?._id].text || "📷 Image"
                ) : (
                  <span className="text-base-content/40 italic">Drafts, links, ideas...</span>
                )}
              </div>
            </div>
          </button>
        )}

        {sortedUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => {
              setSelectedUser(user);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                userId: user._id
              });
            }}
            onTouchStart={(e) => handleTouchStart(user._id, e)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            className={`w-full py-3.5 px-4 flex items-center gap-3 hover:bg-base-200/60 transition-colors group select-none
              ${
                selectedUser?._id === user._id
                  ? "bg-base-200/80"
                  : ""
              }
            `}
          >
            {/* Avatar and Online Indicator */}
            <div className="relative flex-shrink-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullName}
                className="object-cover rounded-full size-12"
              />
              {onlineUsers.includes(user._id) && (
                <span className="absolute bottom-0 right-0 bg-green-500 rounded-full size-3 ring-2 ring-zinc-900" />
              )}
            </div>

            {/* User Details */}
            <div className="min-w-0 flex-1">
              {/* Row 1: Name & Time */}
              <div className="flex items-center justify-between">
                <div className="font-medium truncate text-base-content flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{user.fullName}</span>
                  {favoriteUsers.includes(user._id) && (
                    <Star className="size-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-1.5 flex-shrink-0">
                  {pinnedUserIds.includes(user._id) && (
                    <Pin className="size-3 text-base-content/35 rotate-45" />
                  )}
                  {latestMessages[user._id] && (
                    <span className="text-xs text-base-content/50">
                      {formatMessageTime(latestMessages[user._id].createdAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Latest Message & Unread Badge */}
              <div className="flex items-center justify-between mt-0.5">
                <div className="text-sm text-base-content/60 truncate pr-2 flex-1 text-left flex items-center gap-1">
                  {latestMessages[user._id] && latestMessages[user._id].senderId === authUser?._id && (
                    renderTicks(latestMessages[user._id])
                  )}
                  <span className="truncate">
                    {latestMessages[user._id] ? (
                      latestMessages[user._id].image ? (
                        "📷 Image"
                      ) : (
                        latestMessages[user._id].text
                      )
                    ) : (
                      <span className="text-base-content/40 italic">No messages</span>
                    )}
                  </span>
                </div>

                {unreadCounts[user._id] > 0 && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold text-white bg-primary rounded-full flex-shrink-0">
                    {unreadCounts[user._id]}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {sortedUsers.length === 0 && (
          <div className="py-4 text-center text-zinc-500">
            No users found
          </div>
        )}
      </div>

      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          
          {/* Action Menu Dropdown */}
          <div 
            style={{ 
              top: Math.min(contextMenu.y, window.innerHeight - 150), 
              left: Math.min(contextMenu.x, window.innerWidth - 170) 
            }}
            className="fixed z-50 min-w-[150px] bg-base-100 border border-base-300 rounded-lg shadow-xl p-1 flex flex-col gap-0.5 select-none"
          >
            <button
              onClick={() => {
                togglePin(contextMenu.userId);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Pin className="size-3.5 text-neutral rotate-45" />
              <span>{pinnedUserIds.includes(contextMenu.userId) ? "Unpin Chat" : "Pin Chat"}</span>
            </button>
            <button
              onClick={(e) => {
                toggleFavorite(e, contextMenu.userId);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Star className={`size-3.5 ${favoriteUsers.includes(contextMenu.userId) ? "text-yellow-500 fill-yellow-500" : "text-neutral"}`} />
              <span>{favoriteUsers.includes(contextMenu.userId) ? "Unstar Chat" : "Star Chat"}</span>
            </button>
            <button
              onClick={(e) => {
                toggleArchive(e, contextMenu.userId);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Archive className="size-3.5 text-neutral" />
              <span>{archivedUsers.includes(contextMenu.userId) ? "Unarchive" : "Archive"}</span>
            </button>
            <div className="h-[1px] bg-base-300 my-1"></div>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this chat? This will clear all messages in this conversation.")) {
                  clearChatHistory(contextMenu.userId);
                }
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-red-500/10 rounded-md transition-colors text-left text-red-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Chat</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

export default SideBar;
