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

import { X, ArrowLeft } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();

  const isOnline = onlineUsers.includes(selectedUser._id);

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        
        {/* Left Section: Avatar & Info */}
        <div className="flex items-center gap-3">
          
          {/* Back button for mobile view */}
          <button 
            onClick={() => setSelectedUser(null)} 
            className="p-1 -ml-1 rounded-full lg:hidden hover:bg-base-200 transition-colors"
          >
            <ArrowLeft className="size-6" />
          </button>

          {/* Avatar */}
          <div className="avatar">
            <div className="relative rounded-full size-10">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User Info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="flex items-center gap-1 text-sm text-base-content/70">
              
              {/* Online Dot Left Side */}
              <span
                className={`size-[8px] rounded-full mt-[2.3px] ${
                  isOnline ? "bg-green-500" : "bg-gray-400"
                }`}
              ></span>

              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Close Button - hidden on mobile since we have back arrow */}
        <button onClick={() => setSelectedUser(null)} className="hidden lg:block">
          <X />
        </button>

      </div>
    </div>
  );
};

export default ChatHeader;





