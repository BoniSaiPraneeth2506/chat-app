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

import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, X, Search } from "lucide-react";

const SideBar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const filteredUsers = users.filter((user) => {
    const isOnline = onlineUsers.includes(user._id);
    const matchesSearch = user.fullName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return (showOnlineOnly ? isOnline : true) && matchesSearch;
  });

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`flex flex-col h-full transition-all duration-300 border-r border-base-300 bg-base-100
        ${
          isMobileOpen
            ? "fixed inset-y-0 left-0 z-50 w-full sm:w-80"
            : "w-20 lg:w-72"
        }
      `}
      >
        <div className="w-full p-3 ml-2 border-b sm:p-5 border-base-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isMobileOpen && (
                <button
                  onClick={() => setIsMobileOpen(true)}
                  className="p-2 transition-colors rounded-lg lg:hidden hover:bg-base-200"
                >
                  <Users className="size-6" />
                </button>
              )}

              <div
                className={`flex items-center gap-2 ${
                  isMobileOpen ? "flex" : "hidden lg:flex"
                }`}
              >
                <Users className="size-6" />
                <span className="font-medium sm:text-xl">Contacts</span>
              </div>
            </div>

            {isMobileOpen && (
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 transition-colors rounded-lg lg:hidden hover:bg-base-200"
              >
                <X className="size-5" />
              </button>
            )}
          </div>

          <div
            className={`items-center gap-2 mt-3 ${
              isMobileOpen ? "flex" : "hidden lg:flex"
            }`}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={(e) => setShowOnlineOnly(e.target.checked)}
                className="checkbox checkbox-xs"
              />
              <span className="text-sm">Show online only</span>
            </label>
            <span className="text-xs text-zinc-500">
              ({onlineUsers.length - 1} online)
            </span>
          </div>

          {/* Search Bar - Only visible when sidebar is open */}
          {isMobileOpen && (
            <div className="relative mt-3 mr-2 ml-[-6px]">
              <Search className="absolute -translate-y-1/2 left-3 top-1/2 size-4 text-neutral" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pr-3 transition border rounded-lg pl-9 border-base300 bg-base-200 text-neutral placeholder-neutral/70 focus:outline-none focus:ring-1 "
              />
            </div>
          )}
        </div>

        <div className="w-full py-3 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => {
                setSelectedUser(user);
                setIsMobileOpen(false);
              }}
              className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors
                ${
                  selectedUser?._id === user._id
                    ? "bg-base-300 ring-1 ring-base-300"
                    : ""
                }
              `}
            >
              <div
                className={`relative ${
                  isMobileOpen ? "mx-0" : "mx-auto lg:mx-0"
                }`}
              >
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.name}
                  className="object-cover rounded-full size-12"
                />
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-0 right-0 bg-green-500 rounded-full size-3 ring-2 ring-zinc-900" />
                )}
              </div>

              <div
                className={`min-w-0 text-left ${
                  isMobileOpen ? "block" : "hidden lg:block"
                }`}
              >
                <div className="font-medium truncate">{user.fullName}</div>
                <div className="text-sm text-zinc-400">
                  {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                </div>
              </div>
            </button>
          ))}

          {filteredUsers.length === 0 && (
            <div
              className={`py-4 text-center text-zinc-500 ${
                isMobileOpen ? "block" : "hidden lg:block"
              }`}
            >
              No users found
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default SideBar;
