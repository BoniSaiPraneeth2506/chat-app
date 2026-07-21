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

import { X, ArrowLeft, Bookmark, Clock, Search, Phone, Video, UserX, UserCheck, MoreVertical, Palette, Image } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useState } from "react";
import toast from "react-hot-toast";

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
    return `Today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  } else {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day} at ${timeStr}`;
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
    typingUsers,
    startCall,
    toggleBlockUser,
    setConversationWallpaper
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [pendingWallpaper, setPendingWallpaper] = useState(null);
  const [dimLevel, setDimLevel] = useState(35);

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

          {/* Right Section: Calls, Search, Three Dots Menu & Close */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {!isSelf && (
              <>
                <button 
                  onClick={() => startCall("video")} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-primary"
                  title="Video Call"
                >
                  <Video size={18} />
                </button>
                <button 
                  onClick={() => startCall("voice")} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-primary"
                  title="Voice Call"
                >
                  <Phone size={18} />
                </button>
              </>
            )}

            {/* Search Icon (Left of Three Dots) */}
            <button 
              onClick={() => setIsSearchOpen(true)} 
              className="p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-primary"
              title="Search chat"
            >
              <Search size={18} />
            </button>

            {/* Three Dots More Options Menu (Right of Search) */}
            <div className="dropdown dropdown-bottom dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-primary cursor-pointer"
                title="More options"
              >
                <MoreVertical size={18} />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-2xl w-56 text-xs text-base-content mt-1 space-y-1"
              >
                <li className="menu-title text-[10px] uppercase tracking-wider text-base-content/50 font-bold px-2 py-1 select-none flex items-center gap-1">
                  <Palette size={12} />
                  Chat Theme
                </li>
                <li>
                  <label className="flex items-center justify-between py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold cursor-pointer transition-colors mb-1">
                    <div className="flex items-center gap-2">
                      <Image size={14} />
                      <span>Upload from Gallery</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error("Image size must be less than 5MB");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPendingWallpaper(reader.result);
                            setDimLevel(35);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </li>
                {[
                  { id: "default", name: "Default", color: "bg-base-300" },
                  { id: "sage", name: "Sage", color: "bg-[#e5ddd5]" },
                  { id: "sky", name: "Sky", color: "bg-[#d4e6f1]" },
                  { id: "lavender", name: "Lavender", color: "bg-[#ebdef0]" },
                  { id: "sunset", name: "Sunset", color: "bg-gradient-to-br from-amber-200 to-rose-200" },
                ].map((wp) => (
                  <li key={wp.id}>
                    <button
                      onClick={() => setConversationWallpaper(wp.id)}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-base-200 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-3 rounded-full ${wp.color} border border-base-content/10`} />
                        <span>{wp.name}</span>
                      </div>
                      {((authUser?.chatWallpapers?.[selectedUser?._id] || selectedUser?.chatWallpapers?.[authUser?._id]) === wp.id) && (
                        <span className="text-primary font-bold text-xs">✓</span>
                      )}
                    </button>
                  </li>
                ))}

                {!isSelf && (
                  <>
                    <div className="divider my-1"></div>
                    <li>
                      <button
                        onClick={() => {
                          if (authUser?.blockedUsers?.includes(selectedUser?._id)) {
                            toggleBlockUser(selectedUser._id);
                          } else {
                            setShowBlockConfirm(true);
                          }
                        }}
                        className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs transition-colors ${
                          authUser?.blockedUsers?.includes(selectedUser?._id)
                            ? "text-red-500 font-semibold hover:bg-red-50"
                            : "text-red-500 hover:bg-red-500/10"
                        }`}
                      >
                        {authUser?.blockedUsers?.includes(selectedUser?._id) ? (
                          <>
                            <UserCheck size={14} />
                            <span>Unblock User</span>
                          </>
                        ) : (
                          <>
                            <UserX size={14} />
                            <span>Block User</span>
                          </>
                        )}
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>

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

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 text-left">
            <h3 className="font-bold text-lg text-base-content mb-2">Block {selectedUser?.fullName}?</h3>
            <p className="text-sm text-base-content/70 mb-6">Are you sure you want to block this user? You will not be able to send or receive messages from them.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowBlockConfirm(false)} 
                className="btn btn-sm btn-ghost hover:bg-base-200 text-base-content"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  toggleBlockUser(selectedUser._id);
                  setShowBlockConfirm(false);
                }} 
                className="btn btn-sm btn-error text-white font-semibold"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dimness Adjustment Modal */}
      {pendingWallpaper && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
          <div className="bg-base-100 border border-base-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-5 text-left">
            <div className="w-full text-center">
              <h3 className="font-bold text-lg text-base-content">
                Adjust Wallpaper Dimness
              </h3>
              <p className="text-xs text-base-content/60 mt-0.5">
                Set background brightness for optimal message contrast
              </p>
            </div>

            {/* Live Preview Box */}
            <div 
              className="w-full h-44 rounded-2xl overflow-hidden border border-base-300 relative flex flex-col justify-end p-3 shadow-inner transition-all"
              style={{
                backgroundImage: `linear-gradient(rgba(0, 0, 0, ${dimLevel / 100}), rgba(0, 0, 0, ${dimLevel / 100})), url('${pendingWallpaper}')`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              {/* Sample Message Bubbles for Live Preview */}
              <div className="space-y-2 w-full select-none">
                <div className="bg-base-200/90 text-base-content px-3 py-1.5 rounded-2xl text-[11px] w-fit max-w-[80%] shadow-sm">
                  Hey! How does this look?
                </div>
                <div className="bg-primary text-primary-content px-3 py-1.5 rounded-2xl text-[11px] w-fit max-w-[80%] ml-auto shadow-sm">
                  Looks great! Messages are super clear.
                </div>
              </div>
            </div>

            {/* Dimness Slider Controls */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-base-content/80">
                <span>Wallpaper Dim Level</span>
                <span className="text-primary font-bold">{dimLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={dimLevel}
                onChange={(e) => setDimLevel(Number(e.target.value))}
                className="range range-primary range-xs w-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-base-content/50 font-medium">
                <span>Original (0%)</span>
                <span>Dark (80%)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setPendingWallpaper(null)}
                className="btn btn-ghost flex-1 text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const finalWallpaper = `${pendingWallpaper}#dim=${dimLevel}`;
                  setConversationWallpaper(finalWallpaper);
                  setPendingWallpaper(null);
                }}
                className="btn btn-primary flex-1 text-xs rounded-xl shadow-md text-primary-content"
              >
                Set Wallpaper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;





