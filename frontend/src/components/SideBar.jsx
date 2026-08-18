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
import { useGroupStore } from "../store/useGroupStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { X, Search, Pin, Star, Archive, Bookmark, Users, Plus, Lock } from "lucide-react";
import { useNicknames, displayNameOf } from "../lib/contacts";
import { formatMessageTime } from "../lib/utils";
import toast from "react-hot-toast";
import { haptic } from "../lib/haptics";
import { useChatLockStore } from "../store/useChatLockStore";
import LockPasswordPrompt from "./LockPasswordPrompt";
import { isBiometryAvailable, verifyBiometry, hasStoredLockSecret, readLockSecret } from "../lib/biometrics";

// Mirrors MAX_PINNED_CHATS in backend/controllers/message.controller.js.
const MAX_PINNED_CHATS = 2;

// How far a row must travel before releasing it archives, and how far it can be
// dragged at all. The cap keeps the row from sliding clear of its own width.
const SWIPE_ARCHIVE_THRESHOLD = 88;
const SWIPE_MAX = 120;

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
  const nicknames = useNicknames();
  const { 
    getUsers, 
    users, 
    selectedUser, 
    setSelectedUser, 
    isUsersLoading, 
    latestMessages, 
    unreadCounts, 
    lastReadTimestamps,
    clearChatHistory,
    setProfilePreviewUser,
    toggleContactAction,
    drafts
  } = useChatStore();

  const {
    groups,
    selectedGroup,
    setSelectedGroup,
    getGroups,
    latestGroupMessages,
    unreadGroupCounts,
    mentionedGroups,
    setIsCreateGroupModalOpen,
    setGroupPreview,
    subscribeToGroupEvents,
    unsubscribeFromGroupEvents
  } = useGroupStore();

  const { onlineUsers, authUser } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  // Favourites, archive and pins are stored on the account, not in this
  // browser. They used to live in localStorage, which meant they vanished on
  // reinstall, never followed the user to another device, and — once multi
  // account switching landed — were shared between every account signed in on
  // the same browser, since all of them read one global key.
  const asIds = (list) => (Array.isArray(list) ? list.map((v) => (v?._id ? v._id : v)) : []);
  const favoriteUsers = asIds(authUser?.favorites);
  const archivedUsers = asIds(authUser?.archived);
  const pinnedUserIds = asIds(authUser?.pinnedChats);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, id, kind }
  const [swipe, setSwipe] = useState({ id: null, dx: 0 });
  const [lockPrompt, setLockPrompt] = useState(null); // { id, type }
  const swipeRef = useRef(null);
  const pressTimerRef = useRef(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      getUsers(searchTerm);
    }, searchTerm ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [getUsers, searchTerm]);

  useEffect(() => {
    getGroups();
    subscribeToGroupEvents();
    return () => unsubscribeFromGroupEvents();
  }, [getGroups, subscribeToGroupEvents, unsubscribeFromGroupEvents]);

  // One-time lift of the pre-server lists out of localStorage, so nobody
  // silently loses the favourites and pins they already had. Runs once per
  // account, and only pushes ids the server does not already know about.
  useEffect(() => {
    if (!authUser?._id) return;
    const doneKey = `chatLists:migrated:${authUser._id}`;
    if (localStorage.getItem(doneKey)) return;

    const readLegacy = (key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const jobs = [
      ["favoriteUsers", "favorite", asIds(authUser.favorites)],
      ["archivedUsers", "archive", asIds(authUser.archived)],
      ["pinnedUserIds", "pin", asIds(authUser.pinnedChats)],
    ];

    (async () => {
      for (const [key, action, alreadyOnServer] of jobs) {
        for (const id of readLegacy(key)) {
          if (!alreadyOnServer.includes(id)) {
            await toggleContactAction(id, action, { silent: true });
          }
        }
      }
      localStorage.setItem(doneKey, "1");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?._id]);

  const toggleFavorite = (e, userId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    haptic("tap");
    toggleContactAction(userId, "favorite");
  };

  const toggleArchive = (e, userId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    haptic("tap");
    toggleContactAction(userId, "archive");
  };

  // Groups keep their own lists, because the DM arrays are ref:"User". Both are
  // read through the same helper so the row markup does not care which it is.
  const favoriteGroupIds = asIds(authUser?.favoriteGroups);
  const archivedGroupIds = asIds(authUser?.archivedGroups);
  const pinnedGroupIds = asIds(authUser?.pinnedGroups);
  const lockedChatIds = asIds(authUser?.lockedChats);

  const toggleGroupAction = (groupId, action) => {
    haptic("tap");
    toggleContactAction(groupId, action, { scope: "group" });
  };

  /**
   * Locking asks for proof first — biometry where it is set up, otherwise the
   * password, verified by the server rather than compared here.
   *
   * The request is parked in state and finished by the dialog, because the
   * password now comes from an in-app sheet rather than window.prompt, which
   * could be awaited inline.
   */
  const requestLock = async (id, type) => {
    if (!authUser?.chatLock?.enabled) {
      toast.error("Turn on chat lock in Settings first");
      return;
    }

    const biometry = await isBiometryAvailable();
    if (biometry.available && hasStoredLockSecret(authUser._id)) {
      if (await verifyBiometry("Confirm to change the lock on this chat")) {
        const secret = readLockSecret(authUser._id);
        if (secret && (await useChatLockStore.getState().unlock(secret))) {
          haptic("success");
          await useChatLockStore.getState().toggleChat(id, type);
          return;
        }
      }
      // A sensor that will not read must not make the action unreachable, so it
      // falls through to the password.
    }

    setLockPrompt({ id, type });
  };

  const confirmLockPrompt = async (password) => {
    const target = lockPrompt;
    const ok = await useChatLockStore.getState().unlock(password);
    if (!ok) return;
    setLockPrompt(null);
    haptic("success");
    await useChatLockStore.getState().toggleChat(target.id, target.type);
  };

  const togglePin = (userId) => {
    // The cap is enforced server-side too; this only avoids a pointless
    // round-trip and gives immediate feedback.
    const isPinned = pinnedUserIds.includes(userId);
    if (!isPinned && pinnedUserIds.length >= MAX_PINNED_CHATS) {
      haptic("reject");
      toast.error(`You can only pin up to ${MAX_PINNED_CHATS} chats`);
      return;
    }
    haptic("success");
    toggleContactAction(userId, "pin");
  };

  // Swipe a row left-to-right to archive it, the way Telegram does. Mobile only:
  // on desktop the same action lives in the right-click menu, which is why Lock
  // takes the menu slot on a phone.
  //
  // The row is dragged with the finger rather than snapping at the end, so the
  // gesture shows how far it has to go. Only rightward movement counts, and the
  // long-press timer is cancelled as soon as a drag is recognised — otherwise the
  // context menu would open in the middle of a swipe.
  const handleTouchStart = (userId, e, kind = "user") => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    swipeRef.current = { id: userId, x: clientX, y: clientY, active: false };

    pressTimerRef.current = setTimeout(() => {
      setContextMenu({
        x: clientX,
        y: clientY,
        userId,
        kind: kind || "user",
      });
    }, 600);
  };

  const handleTouchMove = (userId, e) => {
    const start = swipeRef.current;
    if (!start || start.id !== userId) return;

    const touch = e.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // A mostly-vertical move is the list scrolling, so it is left alone.
    if (!start.active && (Math.abs(dy) > Math.abs(dx) || dx < 8)) {
      if (Math.abs(dy) > 8) handleTouchEnd();
      return;
    }

    start.active = true;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setSwipe({ id: userId, dx: Math.min(dx, SWIPE_MAX) });
  };

  const handleTouchEnd = (userId) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    const dx = swipe.id && swipe.id === userId ? swipe.dx : 0;
    setSwipe({ id: null, dx: 0 });
    swipeRef.current = null;

    if (dx >= SWIPE_ARCHIVE_THRESHOLD && userId) {
      haptic("success");
      toggleArchive(null, userId);
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

  // One list for DMs and groups, ordered by most recent activity.
  //
  // Groups used to render as their own block above every DM, so a group that
  // had been silent for weeks still outranked a message from a minute ago.
  // Real chat apps interleave them, with pinned chats held at the top.
  //
  // A group with no messages falls back to when it was created, so a brand new
  // group appears near the top instead of sinking to the bottom.
  const timeOf = (msg) =>
    msg ? new Date(msg.scheduledAt || msg.createdAt).getTime() : 0;

  // Groups now honour the same three lists as DMs, so the merged ordering treats
  // both kinds identically: pinned first, then most recent activity. Before this
  // a pinned group was impossible and an archived one still showed.
  const groupItems =
    filterMode === "groups" || filterMode === "all" || filterMode === "favorites"
      ? groups
          .filter((g) => {
            if (!g.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            const isArchived = archivedGroupIds.includes(g._id);
            if (showArchivedOnly ? !isArchived : isArchived) return false;

            if (filterMode === "favorites") return favoriteGroupIds.includes(g._id);
            if (filterMode === "unread") return (unreadGroupCounts[g._id] || 0) > 0;
            return true;
          })
          .map((g) => ({
            type: "group",
            key: `g:${g._id}`,
            group: g,
            at: timeOf(latestGroupMessages[g._id]) || new Date(g.createdAt || 0).getTime(),
            pinned: pinnedGroupIds.includes(g._id),
          }))
      : [];

  const dmItems =
    filterMode === "groups"
      ? []
      : filteredUsers.map((u) => ({
          type: "dm",
          key: `u:${u._id}`,
          user: u,
          at: timeOf(latestMessages[u._id]),
          pinned: pinnedUserIds.includes(u._id),
        }));

  const conversations = [...dmItems, ...groupItems].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.at - a.at;
  });

  const renderGroupRow = (group) => {
    const isSelected = selectedGroup?._id === group._id;
    const latestMsg = latestGroupMessages[group._id];
    const unread = unreadGroupCounts[group._id] || 0;
    const mentioned = Boolean(mentionedGroups?.[group._id]);

    return (
      <button
        key={group._id}
        onClick={() => setSelectedGroup(group)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, userId: group._id, kind: "group" });
        }}
        onTouchStart={(e) => handleTouchStart(group._id, e, "group")}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        className={`w-full py-3.5 px-4 flex items-center gap-3 hover:bg-base-200/60 transition-colors group select-none ${
          isSelected ? "bg-base-200/80" : ""
        }`}
      >
        <div
          className="relative flex-shrink-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setGroupPreview(group);
          }}
        >
          {group.groupPic ? (
            <img
              src={group.groupPic}
              alt={group.name}
              className="object-cover transition-all rounded-full size-12 hover:opacity-90 active:scale-95"
            />
          ) : (
            <div className="flex items-center justify-center transition-all border rounded-full size-12 bg-secondary/10 border-secondary/20 text-secondary hover:opacity-90 active:scale-95">
              <Users className="size-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base-content truncate flex items-center gap-1.5">
              {group.name}
              {favoriteGroupIds.includes(group._id) && (
                <Star className="size-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
              {pinnedGroupIds.includes(group._id) && (
                <Pin className="size-3 t-dim rotate-45 flex-shrink-0" />
              )}
              <span className="text-[10px] leading-none bg-base-300 px-1.5 py-1 rounded t-dim font-normal">
                {group.members?.length || 0}
              </span>
            </span>
            {latestMsg && (
              <span className="text-xs leading-none t-dim -mt-2 sm:-mt-1">
                {formatMessageTime(latestMsg.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-0.5">
            <div className="text-sm text-base-content/60 truncate pr-2 flex-1 text-left">
              {latestMsg ? (
                <span>
                  <strong className="font-medium text-base-content/80">
                    {latestMsg.isAnonymous ? "Anonymous" : latestMsg.senderId?.fullName?.split(" ")[0]}:{" "}
                  </strong>
                  {latestMsg.poll ? `📊 ${latestMsg.poll.question}` : latestMsg.voice ? "🎤 Voice message" : latestMsg.image ? "📷 Image" : latestMsg.text}
                </span>
              ) : (
                <span className="text-base-content/40 italic">Group created</span>
              )}
            </div>
            {mentioned && (
              <span
                title="You were mentioned"
                className="flex items-center justify-center size-5 text-[11px] font-bold text-primary-content bg-primary rounded-full flex-shrink-0"
              >
                @
              </span>
            )}
            {unread > 0 && (
              <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] leading-none font-bold rounded-full flex-shrink-0 -mt-1 sm:mt-0 ${
                mentioned ? "badge-mention" : "bg-primary text-white"
              }`}>
                {unread}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderUserRow = (user) => (
    // The wrapper exists to hold the affordance revealed underneath. The row
    // itself is opaque and sits above it, so what shows is exactly the distance
    // travelled.
    <div key={user._id} className="relative overflow-hidden">
      {swipe.id === user._id && swipe.dx > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center gap-2 px-4 s-tile"
          style={{ width: `${Math.max(swipe.dx, 56)}px` }}
        >
          <Archive
            size={18}
            className={swipe.dx >= SWIPE_ARCHIVE_THRESHOLD ? "text-primary" : "t-dim"}
          />
          {swipe.dx >= SWIPE_ARCHIVE_THRESHOLD && (
            <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
              {archivedUsers.includes(user._id) ? "Unarchive" : "Archive"}
            </span>
          )}
        </div>
      )}
    <button
      onClick={() => {
        setSelectedUser(user);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          userId: user._id,
          kind: "user",
        });
      }}
      onTouchStart={(e) => handleTouchStart(user._id, e)}
      onTouchEnd={() => handleTouchEnd(user._id)}
      onTouchCancel={() => handleTouchEnd(user._id)}
      onTouchMove={(e) => handleTouchMove(user._id, e)}
      style={
        swipe.id === user._id
          ? { transform: `translateX(${swipe.dx}px)`, transition: "none" }
          : undefined
      }
      className={`relative z-10 w-full py-3.5 px-4 flex items-center gap-3 bg-base-100 hover:bg-base-200/60 transition-transform group select-none
        ${
          selectedUser?._id === user._id
            ? "bg-base-200/80"
            : ""
        }
      `}
    >
      {/* Avatar and Online Indicator */}
      <div 
        className="relative flex-shrink-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setProfilePreviewUser(user);
        }}
      >
        <img
          src={user.profilePic || "/avatar.png"}
          alt={displayNameOf(user, nicknames)}
          className="object-cover rounded-full size-12 hover:opacity-90 active:scale-95 transition-all"
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
            <span className="truncate">{displayNameOf(user, nicknames)}</span>
            {favoriteUsers.includes(user._id) && (
              <Star className="size-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-1.5 flex-shrink-0 -mt-2 sm:-mt-1">
            {pinnedUserIds.includes(user._id) && (
              <Pin className="size-3 text-base-content/35 rotate-45" />
            )}
            {latestMessages[user._id] && (
              <span className="text-xs leading-none t-dim">
                {formatMessageTime(latestMessages[user._id].scheduledAt || latestMessages[user._id].createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Latest Message & Unread Badge */}
        <div className="flex items-center justify-between mt-0.5">
          <div className="text-sm text-base-content/60 truncate pr-2 flex-1 text-left flex items-center gap-1">
            {/* An unsent draft takes precedence over the last message, the way
                WhatsApp and Telegram show it — it is the thing you still have
                to act on. Read ticks are suppressed here because the line is
                describing your draft, not a sent message. */}
            {drafts[user._id]?.trim() ? (
              <span className="truncate">
                <span className="text-primary font-medium">Draft: </span>
                <span className="text-base-content/60">{drafts[user._id]}</span>
              </span>
            ) : (
              <>
            {latestMessages[user._id] && latestMessages[user._id].senderId === authUser?._id && (
              renderTicks(latestMessages[user._id])
            )}
            <span className="truncate">
              {latestMessages[user._id] ? (
                latestMessages[user._id].voice ? (
                  "🎤 Voice message"
                ) : latestMessages[user._id].image ? (
                  "📷 Image"
                ) : (
                  latestMessages[user._id].text
                )
              ) : (
                <span className="text-base-content/40 italic">No messages</span>
              )}
            </span>
              </>
            )}
          </div>

          {unreadCounts[user._id] > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] leading-none font-bold text-white bg-primary rounded-full flex-shrink-0 -mt-1 sm:mt-0">
              {unreadCounts[user._id]}
            </span>
          )}
        </div>
      </div>
    </button>
    </div>
  );

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


  return (
    <aside
      className={`flex flex-col h-full transition-all duration-300 border-r border-base-300 bg-base-100 w-full
        ${selectedUser || selectedGroup ? "hidden lg:flex" : "flex"}
      `}
    >
      <div className="w-full pt-3 px-4 pb-3.5">
        {/* Search Bar & New Group Action */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute -translate-y-1/2 left-4 top-1/2 size-4 text-base-content/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search chats or groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-flat w-full h-10 pl-11 pr-10 transition-colors rounded-full border-0 bg-base-200 text-sm text-base-content ph-dim"
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
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors flex-shrink-0"
            title="Create New Group"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Filter Capsules */}
        <div className="flex items-center gap-2 mt-3.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: "all", label: "All" },
            { id: "groups", label: "Groups" },
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
        {isUsersLoading && users.length === 0 ? (
          Array(8).fill(null).map((_, idx) => (
            <div key={idx} className="flex items-center w-full gap-3 py-3.5 px-4 animate-pulse">
              <div className="relative mx-0 flex-shrink-0">
                <div className="rounded-full bg-base-300 size-12" />
              </div>
              <div className="flex-1 min-w-0 text-left space-y-2">
                <div className="w-32 h-4 bg-base-300 rounded" />
                <div className="w-16 h-3 bg-base-300 rounded" />
              </div>
            </div>
          ))
        ) : (
          <>
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

            {/* DMs and groups in one list, newest activity first */}
            {conversations.map((c) =>
              c.type === "group" ? renderGroupRow(c.group) : renderUserRow(c.user)
            )}

            {conversations.length === 0 && (
              <div className="py-4 text-center text-zinc-500">
                No chats found
              </div>
            )}
          </>
        )}
      </div>

      {lockPrompt && (
        <LockPasswordPrompt
          title="Confirm your lock password"
          description="Needed to move a chat into or out of your locked chats."
          confirmLabel="Confirm"
          onSubmit={confirmLockPrompt}
          onCancel={() => setLockPrompt(null)}
        />
      )}

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
                if (contextMenu.kind === "group") toggleGroupAction(contextMenu.userId, "pin");
                else togglePin(contextMenu.userId);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Pin className="size-3.5 text-neutral rotate-45" />
              <span>
                {(contextMenu.kind === "group" ? pinnedGroupIds : pinnedUserIds).includes(contextMenu.userId)
                  ? "Unpin Chat"
                  : "Pin Chat"}
              </span>
            </button>
            <button
              onClick={(e) => {
                if (contextMenu.kind === "group") toggleGroupAction(contextMenu.userId, "favorite");
                else toggleFavorite(e, contextMenu.userId);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Star
                className={`size-3.5 ${
                  (contextMenu.kind === "group" ? favoriteGroupIds : favoriteUsers).includes(contextMenu.userId)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-neutral"
                }`}
              />
              <span>
                {(contextMenu.kind === "group" ? favoriteGroupIds : favoriteUsers).includes(contextMenu.userId)
                  ? "Unstar Chat"
                  : "Star Chat"}
              </span>
            </button>
            {/* Archive stays on desktop, where a right-click menu is the only way
                to reach it. On a phone it is replaced by Lock, because archiving
                there is the swipe gesture instead — two ways to archive in one
                menu would be clutter, and the menu is short by design. */}
            <button
              onClick={(e) => {
                if (contextMenu.kind === "group") toggleGroupAction(contextMenu.userId, "archive");
                else toggleArchive(e, contextMenu.userId);
                setContextMenu(null);
              }}
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Archive className="size-3.5 text-neutral" />
              <span>
                {(contextMenu.kind === "group" ? archivedGroupIds : archivedUsers).includes(contextMenu.userId)
                  ? "Unarchive"
                  : "Archive"}
              </span>
            </button>

            <button
              onClick={() => {
                const { userId: id, kind } = contextMenu;
                setContextMenu(null);
                requestLock(id, kind === "group" ? "group" : "user");
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 rounded-md transition-colors text-left text-base-content"
            >
              <Lock className="size-3.5 text-primary" />
              <span>
                {(contextMenu.kind === "group" ? asIds(authUser?.lockedGroups) : lockedChatIds).includes(
                  contextMenu.userId
                )
                  ? "Unlock Chat"
                  : "Lock Chat"}
              </span>
            </button>
            {contextMenu.kind !== "group" && <div className="h-[1px] bg-base-300 my-1"></div>}
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
