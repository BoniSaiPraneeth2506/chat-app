// import { X } from "lucide-react";
// import  useAuthStore  from "../store/useAuthStore";
// import { useChatStore } from "../store/useChatStore";

// const ChatHeader = () => {
//   const { selectedUser, setSelectedUser } = useChatStore();
//   const { onlineUsers } = useAuthStore();

//   return (
//     <div className="p-2.5 border-b border-base-300">
//       <div className="flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           {/* Avatar */}
//           <div className="avatar">
//             <div className="relative rounded-full size-10">
//               <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
//             </div>
//           </div>

//           {/* User info */}
//           <div>
//             <h3 className="font-medium">{selectedUser.fullName}</h3>
//             <p className="text-sm text-base-content/70">
//               {/* {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"} */}
//             </p>
//           </div>
//         </div>

//         {/* Close button */}
//         <button onClick={() => setSelectedUser(null)}>
//           <X />
//         </button>
//       </div>
//     </div>
//   );
// };
// export default ChatHeader;


// import { X } from "lucide-react";
// import  useAuthStore  from "../store/useAuthStore";
// import { useChatStore } from "../store/useChatStore";

// const ChatHeader = () => {
//   const { selectedUser, setSelectedUser } = useChatStore();
//   const { onlineUsers } = useAuthStore();

//   return (
//     <div className="p-2.5 border-b border-base-300">
//       <div className="flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           {/* Avatar */}
//           <div className="avatar">
//             <div className="relative rounded-full size-10">
//               <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
//             </div>
//           </div>

//           {/* User info */}
//           <div>
//             <h3 className="font-medium">{selectedUser.fullName}</h3>
//             <p className="text-sm text-base-content/70">
//               {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
//             </p>
//           </div>
//         </div>

//         {/* Close button */}
//         <button onClick={() => setSelectedUser(null)}>
//           <X />
//         </button>
//       </div>
//     </div>
//   );
// };
// export default ChatHeader;

import { X, ArrowLeft, Bookmark, Clock, Search } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useState } from "react";

const formatLastSeen = (lastSeenTime) => {
  if (!lastSeenTime) return "Offline";
  const date = new Date(lastSeenTime);
  const now = new Date();

  const pad = (n) => String(n).padStart(2, "0");
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const timeStr = `${hours}:${minutes}`;

  const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = dNow.getTime() - dDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Last seen today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Last seen yesterday at ${timeStr}`;
  } else {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `Last seen on ${year}-${month}-${day} at ${timeStr}`;
  }
};

const ChatHeader = () => {
  const { 
    selectedUser, 
    setSelectedUser, 
    isRecipientProfileOpen, 
    setIsRecipientProfileOpen,
    messageSearchQuery,
    setMessageSearchQuery,
    typingUsers
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isSelf = selectedUser?._id === authUser?._id;
  const isOnline = onlineUsers.includes(selectedUser?._id);
  const showLastSeen = selectedUser?.onlinePrivacy !== false;
  const isTyping = typingUsers?.[selectedUser?._id];

  return (
    <div className="p-2.5 border-b border-base-300 min-h-[61px] flex items-center">
      {isSearchOpen ? (
        /* Full-width Search Bar mode */
        <div className="flex items-center gap-3 w-full bg-base-200/60 px-3 py-1.5 rounded-lg border border-base-300 animate-in fade-in duration-200">
          <Search size={16} className="text-base-content/50" />
          <input
            type="text"
            placeholder="Search messages in this chat..."
            className="flex-1 bg-transparent text-xs outline-none text-base-content placeholder-base-content/40"
            value={messageSearchQuery}
            onChange={(e) => setMessageSearchQuery(e.target.value)}
            autoFocus
          />
          <button 
            onClick={() => {
              setIsSearchOpen(false);
              setMessageSearchQuery("");
            }} 
            className="p-1 hover:bg-base-300 rounded-full transition-colors text-base-content/70 hover:text-red-500"
            title="Close search"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* Normal Chat Header mode */
        <div className="flex items-center justify-between w-full">
          
          {/* Left Section: Avatar & Info */}
          <div className="flex items-center gap-3">
            
            {/* Back button for mobile view */}
            <button 
              onClick={() => setSelectedUser(null)} 
              className="p-1 -ml-1 rounded-full lg:hidden hover:bg-base-200 transition-colors"
            >
              <ArrowLeft className="size-6" />
            </button>

            {isSelf ? (
              /* Personal Notes self-chat header details */
              <div className="flex items-center gap-3 select-none">
                <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Bookmark className="size-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-base-content text-sm sm:text-base">Personal Notes</h3>
                  <p className="text-xs text-base-content/60">Organize drafts, links, and ideas</p>
                </div>
              </div>
            ) : (
              /* Clickable Avatar and User Info details to open Sidebar details */
              <div 
                onClick={() => setIsRecipientProfileOpen(!isRecipientProfileOpen)}
                className="flex items-center gap-3 cursor-pointer select-none group"
              >
                {/* Avatar */}
                <div className="avatar group-hover:opacity-90 transition-opacity">
                  <div className="relative rounded-full size-10">
                    <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                  </div>
                </div>

                {/* User Info */}
                <div className="text-left select-none">
                  <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-1.5">
                    {selectedUser.fullName}
                    {authUser?.disappearingTimers?.[selectedUser._id] && authUser?.disappearingTimers?.[selectedUser._id] !== "off" && (
                      <Clock className="size-3 text-zinc-400" title={`Disappearing messages: ${authUser.disappearingTimers[selectedUser._id]}`} />
                    )}
                  </h3>
                  {isTyping ? (
                    <div className="flex items-center gap-1 text-xs text-primary font-medium">
                      <span>typing</span>
                      <span className="flex gap-0.5 mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]"></span>
                      </span>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1 text-sm text-base-content/70">
                      {isOnline && (
                        <span className="size-[8px] rounded-full mt-[2.3px] bg-green-500"></span>
                      )}
                      {isOnline ? "Online" : showLastSeen ? formatLastSeen(selectedUser?.lastSeen || selectedUser?.updatedAt || selectedUser?.createdAt) : "Offline"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Section: Search & Sidebar Toggle */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSearchOpen(true)} 
              className="p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-primary"
              title="Search chat"
            >
              <Search size={18} />
            </button>

            {/* Close Button - hidden on mobile since we have back arrow */}
            <button 
              onClick={() => setSelectedUser(null)} 
              className="hidden lg:block p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-red-500"
              title="Close chat"
            >
              <X size={18} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default ChatHeader;





