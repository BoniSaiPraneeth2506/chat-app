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

import { X, ArrowLeft, Bookmark, Clock, Search, Phone, Video, UserX, UserCheck, MoreVertical, Palette, CheckSquare, Users, Info, Mic, MicOff, Maximize2, CornerUpLeft, Pin, Trash2, Forward, Pencil, Tag, Download, Copy, Sparkles, BellOff, Bell, ChevronRight } from "lucide-react";
import { useNicknames, displayNameOf, hasNickname } from "../lib/contacts";
import { saveTextFile } from "../lib/download";
import { copyText, messagesToClipboardText } from "../lib/clipboard";
import { haptic } from "../lib/haptics";
import { isChatMuted, muteConversation, unmuteConversation } from "../lib/mute";
import { getConvAutoTranslate, setConvAutoTranslate } from "../lib/translatePrefs";
import { AI_LANGUAGES, languageName } from "../lib/sarvamApi";
import { scheduleReminder } from "../lib/reminders";
import {
  getSavedMessages,
  toggleSaveMessage,
  removeSavedMessage,
} from "../lib/savedMessages";
import MessageInfoSheet from "./MessageInfoSheet";
import AiActionMenu from "./ai/AiActionMenu";
import ChatThemeScreen from "./ChatThemeScreen";
import BubbleThemeScreen from "./BubbleThemeScreen";
import SavedMessagesScreen from "./SavedMessagesScreen";
import axiosInstance from "../lib/axios";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useThemeStore } from "../store/useThemeStore";
import { Fragment, useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  }
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} at ${timeStr}`;
};

const ChatHeader = ({ overlayRef }) => {
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
    setContactNickname,
    setConversationWallpaper,
    setLightboxImage,
    isSelectionMode,
    setSelectionMode,
    messages,
    selectedMessageIds,
    deleteMessagesBulk,
    setReplyingToMessage,
    setEditingMessage,
    setForwardingMessage,
    setForwardingMessages,
    togglePinMessage,
  } = useChatStore();

  const {
    selectedGroup,
    setSelectedGroup,
    setIsGroupDetailsModalOpen,
    startOrJoinGroupCall,
    groupMessages,
  } = useGroupStore();

  const { onlineUsers, authUser } = useAuthStore();
  // Per-chat bubble palette (Feature 3): an override chosen here beats the
  // app-wide bubble style for this conversation only.
  const { bubbleOverrides, setBubbleOverride } = useThemeStore();
  const bubbleConvKey = selectedGroup?._id || selectedUser?._id || "";
  const selectedBubblePreset = bubbleOverrides[bubbleConvKey] || "auto";
  const [savedScreenOpen, setSavedScreenOpen] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  // Saved messages for this conversation (re-read when savedTick changes).
  const savedMessages = useMemo(
    () => getSavedMessages(bubbleConvKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bubbleConvKey, savedTick]
  );
  const savedIds = useMemo(() => new Set(savedMessages.map((m) => m.messageId)), [savedMessages]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { callState, isScreenSharing, toggleLocalMute, toggleScreenShare, isMuted } = useChatStore();
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(null); // null = dialog closed
  const nicknames = useNicknames();
  const contactName = displayNameOf(selectedUser, nicknames);
  const [pendingWallpaper, setPendingWallpaper] = useState(null);
  const [dimLevel, setDimLevel] = useState(35);
  const [infoMessageId, setInfoMessageId] = useState(null);
  const [themeScreenOpen, setThemeScreenOpen] = useState(false);
  const [bubbleScreenOpen, setBubbleScreenOpen] = useState(false);

  // The overflow tray must stay open while the AI sub-menu (language list) is
  // shown. DaisyUI's default focus-based dropdown closes the instant you click
  // "Translate"/"Change Script" (focus moves to the button), so this one is
  // controlled: it opens on the trigger click and closes only when an action
  // finishes or the user clicks outside.
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const aiMenuRef = useRef(null);

  useEffect(() => {
    if (!aiMenuOpen) return;
    const onDown = (e) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [aiMenuOpen]);

  // Same controlled-dropdown treatment for the selection ⋯ (More) tray so its
  // nested "Remind me" / time submenu stays open while choosing.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  // Bump this to re-read the per-chat auto-translate pref (stored locally).
  const [autoTranslateTick, setAutoTranslateTick] = useState(0);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onDown = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [moreMenuOpen]);

  const isSelf = selectedUser?._id === authUser?._id;
  const isOnline = onlineUsers.includes(selectedUser?._id);
  const mutedConvId = selectedGroup ? selectedGroup._id : selectedUser?._id;
  const chatIsMuted = isChatMuted(mutedConvId);
  // Per-chat wallpaper currently stored on the server for this conversation
  // (matches ChatContainer's resolution: either side of the pair wins).
  const activeChatWall =
    authUser?.chatWallpapers?.[selectedUser?._id] ||
    selectedUser?.chatWallpapers?.[authUser?._id];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoTranslatePref = useMemo(
    () => getConvAutoTranslate(mutedConvId || ""),
    [mutedConvId, autoTranslateTick]
  );
  const autoTranslateOn = autoTranslatePref.on;
  const autoTranslateLang = autoTranslatePref.lang;
  const showLastSeen = selectedUser?.onlinePrivacy !== false;
  const isTyping = typingUsers?.[selectedUser?._id];

  // Serves both DMs and groups. Group messages arrive with senderId populated
  // as an object while DM messages carry a bare id, so ownership has to be
  // compared through senderOf — a direct `senderId === authUser._id` silently
  // failed for every group message, which hid "delete for everyone" and edit.
  const senderOf = (m) => m?.senderId?._id || m?.senderId;
  const activeMessages = selectedGroup ? groupMessages : messages;
  const selectedMsgs = selectedMessageIds
    .map((id) => activeMessages.find((m) => m._id === id))
    .filter(Boolean);
  const soleSelected = selectedMsgs.length === 1 ? selectedMsgs[0] : null;
  const allOwnMessages = selectedMsgs.length > 0 && selectedMsgs.every((m) => senderOf(m) === authUser?._id);
  const isSoleOwn = soleSelected && senderOf(soleSelected) === authUser?._id;
  const canEditSole = isSoleOwn && !soleSelected.isDeletedForEveryone && soleSelected.text
    && (Date.now() - new Date(soleSelected.createdAt).getTime() <= 15 * 60 * 1000);

  // The AI actions (Listen / Translate / Change Script) apply to any single
  // text message, whether or not the user sent it.
  const aiActionable = Boolean(
    soleSelected && soleSelected.text && !soleSelected.isDeletedForEveryone
  );
  // The ⋯ tray shows whenever a single message is selected (for an own text
  // message that means "Message info" plus the Pin / Copy / Remind me actions).
  const showOverflow = Boolean(soleSelected && !soleSelected.isDeletedForEveryone);

  const exitSelection = () => setSelectionMode(false);

  // Multi-select actions. Rendered mobile-only (lg:hidden); on desktop the
  // toolbar shows Reply, Delete, Forward, Edit, AI and ⋯ as above.
  const copyableCount = selectedMsgs.filter((m) => m.text && !m.isDeletedForEveryone && !m.restricted).length;
  const forwardableMsgs = selectedMsgs.filter((m) => !m.isDeletedForEveryone && !m.restricted);

  const handleCopySelected = async () => {
    const text = messagesToClipboardText(selectedMsgs, {
      authUserId: authUser?._id,
      contactName,
    });
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    const ok = await copyText(text);
    haptic(ok ? "success" : "reject");
    if (ok) toast.success(copyableCount > 1 ? `${copyableCount} messages copied` : "Copied");
    else toast.error("Couldn't copy");
    exitSelection();
  };

  // Gallery upload for the Chat Theme screen — reads the picture to a data URL
  // and hands it to the existing dimness assistant (same flow as before).
  const handleGalleryFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
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
  };

  if (isSelectionMode) {
    return (
      <div className="p-2.5 border-b border-base-300 min-h-[64px] flex items-center justify-between bg-base-100 relative z-30 animate-in fade-in duration-150">
        <div className="flex items-center gap-3">
          <button onClick={exitSelection} className="p-1 -ml-1 rounded-full hover:bg-base-200 transition-colors" title="Cancel selection">
            <X className="size-5" />
          </button>
          <span className="text-sm font-semibold text-base-content">{selectedMessageIds.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {soleSelected && (
            <button
              onClick={() => { setReplyingToMessage(soleSelected); exitSelection(); }}
              className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
              title="Reply"
            >
              <CornerUpLeft size={18} />
            </button>
          )}
          {selectedMessageIds.length > 0 && (
            <div className="dropdown dropdown-bottom dropdown-end">
              <div tabIndex={0} role="button" className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-red-500 cursor-pointer" title="Delete">
                <Trash2 size={18} />
              </div>
              <ul tabIndex={0} className="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 border border-base-300 rounded-box w-48 text-xs text-base-content mt-1">
                <li>
                  <button
                    onClick={() => { haptic("success"); deleteMessagesBulk(selectedMessageIds, "me"); exitSelection(); document.activeElement.blur(); }}
                    className="hover:bg-base-200 py-2 text-left font-medium"
                  >
                    Delete for me
                  </button>
                </li>
                {allOwnMessages && (
                  <li>
                    <button
                      onClick={() => { haptic("success"); deleteMessagesBulk(selectedMessageIds, "everyone"); exitSelection(); document.activeElement.blur(); }}
                      className="hover:bg-red-500 hover:text-white py-2 text-left font-medium text-red-500"
                    >
                      Delete for everyone
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
          {/* Copy — mobile-only, multi-select only (single-selection copy lives in
              the ⋯ dropdown which is shared by both breakpoints). */}
          {copyableCount > 0 && selectedMessageIds.length >= 2 && (
            <button
              onClick={handleCopySelected}
              className="lg:hidden p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
              title="Copy"
            >
              <Copy size={18} />
            </button>
          )}
          {/* Forward for 2+ — mobile-only; the single-message case below shows
              on both breakpoints. */}
          {forwardableMsgs.length >= 2 && (
            <button
              onClick={() => { haptic("tap"); setForwardingMessages(forwardableMsgs); exitSelection(); }}
              className="lg:hidden p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
              title={`Forward ${forwardableMsgs.length} messages`}
            >
              <Forward size={18} />
            </button>
          )}
          {soleSelected && !soleSelected.isDeletedForEveryone && !soleSelected.restricted && (
            <button
              onClick={() => { setForwardingMessage(soleSelected); exitSelection(); }}
              className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
              title="Forward"
            >
              <Forward size={18} />
            </button>
          )}
          {canEditSole && (
            <button
              onClick={() => { setEditingMessage(soleSelected); exitSelection(); }}
              className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
              title="Edit"
            >
              <Pencil size={18} />
            </button>
          )}

          {/* AI (Sparkles) — first-class toolbar action shared by DMs, groups and
              both breakpoints. */}
          {aiActionable && (
            <div
              className={`dropdown dropdown-bottom dropdown-end ${aiMenuOpen ? "dropdown-open" : ""}`}
              ref={aiMenuRef}
            >
              <div
                role="button"
                className="p-2 hover:bg-base-300 rounded-full transition-colors hover:text-primary cursor-pointer"
                title="AI actions"
                onClick={() => setAiMenuOpen((o) => !o)}
              >
                <Sparkles size={18} />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-box w-48 text-xs text-base-content mt-1"
              >
                <AiActionMenu
                  message={soleSelected}
                  onFinish={() => {
                    setAiMenuOpen(false);
                    exitSelection();
                  }}
                />
              </ul>
            </div>
          )}

          {/* ⋯ (More) dropdown — shared by both breakpoints: Message info, Pin,
              Copy and Remind me (1h / 1d). Controlled dropdown so the nested
              "Remind me" time options stay open while choosing. */}
          {showOverflow && (
            <div
              className={`dropdown dropdown-bottom dropdown-end ${moreMenuOpen ? "dropdown-open" : ""}`}
              ref={moreMenuRef}
            >
              <div
                role="button"
                className="p-2 hover:bg-base-300 rounded-full transition-colors hover:text-primary cursor-pointer"
                title="More"
                onClick={() => setMoreMenuOpen((o) => !o)}
              >
                <MoreVertical size={18} />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-box w-48 text-xs text-base-content mt-1"
              >
                {isSoleOwn && (
                  <li>
                    <button
                      onClick={() => {
                        haptic("tap");
                        setMoreMenuOpen(false);
                        setInfoMessageId(soleSelected._id);
                      }}
                      className="hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 hover:text-primary focus:text-primary py-2 text-left font-medium flex items-center gap-2"
                    >
                      <Info size={14} />
                      Message info
                    </button>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => {
                      haptic("tap");
                      togglePinMessage(soleSelected._id);
                      setMoreMenuOpen(false);
                      exitSelection();
                    }}
                    className={`hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2 ${soleSelected.isPinned ? "text-amber-600" : ""}`}
                  >
                    <Pin size={14} />
                    {soleSelected.isPinned ? "Unpin" : "Pin"}
                  </button>
                </li>
                {soleSelected.text && !soleSelected.isDeletedForEveryone && !soleSelected.restricted && (
                  <li>
                    <button
                      onClick={() => {
                        handleCopySelected();
                        setMoreMenuOpen(false);
                      }}
                      className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => {
                      haptic("tap");
                      toggleSaveMessage(bubbleConvKey, soleSelected, authUser?._id);
                      setSavedTick((t) => t + 1);
                      setMoreMenuOpen(false);
                      exitSelection();
                    }}
                    className={`hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2 ${
                      savedIds.has(soleSelected._id) ? "text-amber-600" : ""
                    }`}
                  >
                    <Bookmark size={14} />
                    {savedIds.has(soleSelected._id) ? "Saved (tap to unsave)" : "Save message"}
                  </button>
                </li>
                <li>
                  <details className="text-xs">
                    <summary className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2 cursor-pointer">
                      <Bell size={14} />
                      Remind me
                    </summary>
                    <ul>
                      <li>
                        <button
                          onClick={() => {
                            scheduleReminder({
                              conversationId: mutedConvId,
                              title: selectedGroup ? selectedGroup.name : contactName,
                              message: soleSelected,
                              afterMs: 60 * 60 * 1000,
                            });
                            setMoreMenuOpen(false);
                            exitSelection();
                          }}
                          className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2"
                        >
                          <Clock size={14} />
                          In 1 hour
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            scheduleReminder({
                              conversationId: mutedConvId,
                              title: selectedGroup ? selectedGroup.name : contactName,
                              message: soleSelected,
                              afterMs: 24 * 60 * 60 * 1000,
                            });
                            setMoreMenuOpen(false);
                            exitSelection();
                          }}
                          className="hover:bg-base-200 py-2 text-left font-medium flex items-center gap-2"
                        >
                          <Clock size={14} />
                          In 1 day
                        </button>
                      </li>
                    </ul>
                  </details>
                </li>
              </ul>
            </div>
          )}
        </div>

        {infoMessageId && (
          <MessageInfoSheet
            messageId={infoMessageId}
            onClose={() => {
              setInfoMessageId(null);
              exitSelection();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-2.5 border-b border-base-300 min-h-[64px] flex items-center bg-base-100 relative z-30">
      {isSearchOpen ? (
        /* Full-width Search Bar mode */
        <div className="relative w-full cg-fade">
          <Search className="absolute -translate-y-1/2 left-4 top-1/2 size-4 text-base-content/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search in this chat..."
            value={messageSearchQuery}
            onChange={(e) => setMessageSearchQuery(e.target.value)}
            autoFocus
            className="field-flat w-full h-10 pl-11 pr-10 transition-colors rounded-full border-0 bg-base-200 text-sm text-base-content ph-dim"
          />
          <button
            onClick={() => {
              if (messageSearchQuery) {
                setMessageSearchQuery("");
                return;
              }
              setIsSearchOpen(false);
            }}
            title={messageSearchQuery ? "Clear" : "Close search"}
            className="absolute -translate-y-1/2 right-3 top-1/2 p-1 hover:bg-base-300 rounded-full text-base-content/40 hover:text-base-content transition-colors flex items-center justify-center"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        /* Normal Chat Header mode */
        <div className="flex items-center justify-between w-full gap-2">
          
          {/* Left Section: Avatar & Info */}
          <div className="flex items-center min-w-0 gap-3">
            
            {/* Back button for mobile view */}
            <button 
              onClick={() => {
                if (selectedGroup) setSelectedGroup(null);
                else setSelectedUser(null);
              }} 
              className="p-1 -ml-1 rounded-full lg:hidden hover:bg-base-200 transition-colors"
            >
              <ArrowLeft className="size-6" />
            </button>

            {selectedGroup ? (
              /* Group Chat Header details */
              <div 
                onClick={() => setIsGroupDetailsModalOpen(true)}
                className="flex items-center min-w-0 gap-3 cursor-pointer select-none group"
              >
                <div className="transition-opacity hover:opacity-80 shrink-0">
                  <div className="flex items-center justify-center overflow-hidden border rounded-full size-10 text-secondary">
                    {selectedGroup.groupPic ? (
                      <img src={selectedGroup.groupPic} alt={selectedGroup.name} className="object-cover w-full h-full" />
                    ) : (
                      <Users className="size-5" />
                    )}
                  </div>
                </div>
                <div className="min-w-0 text-left select-none">
                  <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-1.5 text-sm sm:text-base min-w-0">
                    <span className="truncate">{selectedGroup.name}</span>
                  </h3>
                  <p className="text-xs truncate">
                    {selectedGroup.members?.length || 0} members {selectedGroup.isReadOnly ? "• Read Only" : ""}
                  </p>
                </div>
              </div>
            ) : isSelf ? (
              /* Personal Notes self-chat header details */
              <div className="flex items-center gap-3 select-none">
                <div className="size-10 rounded-full border flex items-center justify-center text-primary shrink-0">
                  <Bookmark className="size-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-base-content text-sm sm:text-base">Personal Notes</h3>
                  <p className="text-xs">Organize drafts, links, and ideas</p>
                </div>
              </div>
            ) : (
              /* Clickable Avatar and User Info details to open Sidebar details */
              <div 
                onClick={() => setIsRecipientProfileOpen(!isRecipientProfileOpen)}
                className="flex items-center min-w-0 gap-3 cursor-pointer select-none group"
              >
                {/* Avatar */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImage(selectedUser?.profilePic || "/avatar.png");
                  }}
                  className="avatar hover:opacity-80 transition-opacity cursor-zoom-in shrink-0"
                >
                  <div className="relative rounded-full size-10">
                    <img src={selectedUser?.profilePic || "/avatar.png"} alt={contactName} />
                  </div>
                </div>

                {/* User Info */}
                <div className="min-w-0 text-left select-none">
                  <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{contactName}</span>
                    {authUser?.disappearingTimers?.[selectedUser?._id] && authUser?.disappearingTimers?.[selectedUser?._id] !== "off" && (
                      <Clock className="size-3 text-zinc-400" title={`Disappearing messages: ${authUser.disappearingTimers[selectedUser._id]}`} />
                    )}
                  </h3>
                  {isTyping ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium select-none">
                      {isTyping === "recording" ? (
                        <>
                          <span className="text-red-500 font-semibold flex items-center gap-1 animate-pulse">
                            🎙️ recording audio
                          </span>
                        </>
                      ) : (
                        <>
                          <span>typing...</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="flex items-center gap-1 text-sm truncate">
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

          {/* Right Section: Calls, Search, Info & Menu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {selectedGroup ? (
              <>
                <button 
                  onClick={() => startOrJoinGroupCall(selectedGroup._id, "video")} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
                  title="Group Video Call"
                >
                  <Video size={18} />
                </button>
                <button 
                  onClick={() => startOrJoinGroupCall(selectedGroup._id, "voice")} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
                  title="Group Voice Call"
                >
                  <Phone size={18} />
                </button>
                <button 
                  onClick={() => setIsGroupDetailsModalOpen(true)} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
                  title="Group Info & Members"
                >
                  <Info size={18} />
                </button>
              </>
            ) : !isSelf && (
              <>
                <button 
                  onClick={() => startCall("video")} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
                  title="Video Call"
                >
                  <Video size={18} />
                </button>
                <button 
                  onClick={() => startCall("voice")} 
                  className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
                  title="Voice Call"
                >
                  <Phone size={18} />
                </button>
                {/* Quick call controls when in a call */}
                {callState && (
                  <>
                    <button
                      onClick={() => toggleLocalMute()}
                      className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
                      title="Toggle mute"
                    >
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <button
                      onClick={() => toggleScreenShare()}
                      className={`p-2 hover:bg-base-200 rounded-full transition-colors ${isScreenSharing ? 'text-primary' : ''}`}
                      title={isScreenSharing ? "Stop screen share" : "Share screen"}
                    >
                      <Maximize2 size={16} />
                    </button>
                  </>
                )}
              </>
            )}

            {/* Search Icon (Left of Three Dots) */}
            <button 
              onClick={() => setIsSearchOpen(true)} 
              className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary"
              title="Search chat"
            >
              <Search size={18} />
            </button>

            {/* Select Messages toggle — groups included, same as DMs */}
            {(
              <button
                onClick={() => setSelectionMode(!isSelectionMode)}
                className={`hidden sm:flex p-2 rounded-full transition-colors ${isSelectionMode ? "bg-primary text-primary-content" : "hover:bg-base-200 hover:text-primary"}`}
                title="Select Messages"
              >
                <CheckSquare size={18} />
              </button>
            )}

            {/* Three Dots More Options Menu (Right of Search) */}
            <div className="dropdown dropdown-bottom dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="p-2 hover:bg-base-200 rounded-full transition-colors hover:text-primary cursor-pointer"
                title="More options"
              >
                <MoreVertical size={18} />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-2xl w-56 text-xs text-base-content mt-1 space-y-1"
              >
{/* Select Messages */}
                <li>
                  <button
                    onClick={() => {
                      setSelectionMode(!isSelectionMode);
                      document.activeElement.blur();
                    }}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs hover:bg-base-200 transition-colors w-full text-left text-base-content"
                  >
                    <CheckSquare size={15} className="shrink-0" />
                    <span className="flex-1">{isSelectionMode ? "Cancel Selection" : "Select Messages"}</span>
                  </button>
                </li>

                {!isSelf && (
                  <li>
                    <details className="text-xs">
                      <summary className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-base-200 transition-colors cursor-pointer">
                        {chatIsMuted ? <BellOff size={15} className="shrink-0" /> : <Bell size={15} className="shrink-0" />}
                        <span className="flex-1">{chatIsMuted ? "Notifications Muted" : "Mute Notifications"}</span>
                      </summary>
                      <ul>
                        <li>
                          <button
                            onClick={() => {
                              muteConversation(mutedConvId, 8 * 60 * 60 * 1000);
                              document.activeElement.blur();
                              toast.success(chatIsMuted ? "Mute duration updated (8 hours)" : "Notifications muted for 8 hours");
                            }}
                            className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-base-200 transition-colors"
                          >
                            <Clock size={14} />
                            <span>Mute for 8 hours</span>
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => {
                              muteConversation(mutedConvId, null);
                              document.activeElement.blur();
                              toast.success(chatIsMuted ? "Mute duration updated" : "Notifications muted permanently");
                            }}
                            className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-base-200 transition-colors"
                          >
                            <BellOff size={14} />
                            <span>Mute always</span>
                          </button>
                        </li>
                        {chatIsMuted && (
                          <li>
                            <button
                              onClick={() => {
                                unmuteConversation(mutedConvId);
                                document.activeElement.blur();
                                toast.success("Notifications unmuted");
                              }}
                              className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-base-200 transition-colors text-red-500"
                            >
                              <Bell size={14} />
                              <span>Unmute</span>
                            </button>
                          </li>
                        )}
                      </ul>
                    </details>
                  </li>
                )}

                {!isSelf && !selectedGroup && (
                  <li>
                    <button
                      onClick={async () => {
                        document.activeElement.blur();
                        try {
                          const res = await axiosInstance.get(`/messages/export/${selectedUser._id}`);
                          const name = (contactName || "chat").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
                          const result = await saveTextFile(
                            `chatty-${name}-${new Date().toISOString().slice(0, 10)}.json`,
                            JSON.stringify(res.data, null, 2)
                          );
                          if (result.savedTo) toast.success(`Saved to ${result.savedTo}`);
                          else if (result.downloaded) toast.success("Chat exported");
                        } catch (err) {
                          const msg = String(err?.message || "");
                          if (!/cancel|abort/i.test(msg)) {
                            toast.error(err.response?.data?.message || "Could not export this chat");
                          }
                        }
                      }}
                      className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs hover:bg-base-200 transition-colors w-full text-left"
                    >
                      <Download size={15} className="shrink-0" />
                      <span className="flex-1">Export Chat</span>
                    </button>
                  </li>
                )}

                {/* Chat Theme → full-screen picker (DMs only; matches the
                    per-conversation wallpaper sync on the server) */}
                {!selectedGroup && (
                  <li>
                    <button
                      onClick={() => {
                        document.activeElement.blur();
                        setThemeScreenOpen(true);
                      }}
                      className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs hover:bg-base-200 transition-colors w-full text-left"
                    >
                      <Palette size={15} className="shrink-0" />
                      <span className="flex-1">Chat Theme</span>
                      <ChevronRight size={14} className="opacity-40" />
                    </button>
                  </li>
                )}

                {/* Bubble Theme → full-screen picker */}
                <li>
                  <button
                    onClick={() => {
                      document.activeElement.blur();
                      setBubbleScreenOpen(true);
                    }}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs hover:bg-base-200 transition-colors w-full text-left"
                  >
                    <Sparkles size={15} className="shrink-0" />
                    <span className="flex-1">Bubble Theme</span>
                    <ChevronRight size={14} className="opacity-40" />
                  </button>
                </li>

                {/* Saved Messages → full-screen picker */}
                <li>
                  <button
                    onClick={() => {
                      document.activeElement.blur();
                      setSavedScreenOpen(true);
                    }}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs hover:bg-base-200 transition-colors w-full text-left"
                  >
                    <Bookmark size={15} className="shrink-0" />
                    <span className="flex-1">Saved Messages</span>
                    {savedMessages.length > 0 && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                        {savedMessages.length}
                      </span>
                    )}
                    <ChevronRight size={14} className="opacity-40" />
                  </button>
                </li>

                <li className="my-0.5 border-t border-base-300 mx-1"></li>

                {!isSelf && !selectedGroup && (
                  <>
                    <li>
                      <button
                        onClick={() => {
                          setNicknameDraft(nicknames[selectedUser._id] || "");
                          document.activeElement.blur();
                        }}
                        className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs hover:bg-base-200 transition-colors w-full text-left"
                      >
                        <Tag size={15} className="shrink-0" />
                        <span className="flex-1">
                          {hasNickname(selectedUser, nicknames) ? "Edit nickname" : "Add nickname"}
                        </span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          if (authUser?.blockedUsers?.includes(selectedUser?._id)) {
                            toggleBlockUser(selectedUser._id);
                          } else {
                            setShowBlockConfirm(true);
                          }
                          document.activeElement.blur();
                        }}
                        className={`flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs transition-colors w-full text-left ${
                          authUser?.blockedUsers?.includes(selectedUser?._id)
                            ? "text-red-500 font-semibold hover:bg-red-50"
                            : "text-red-500 hover:bg-red-500/10"
                        }`}
                      >
                        {authUser?.blockedUsers?.includes(selectedUser?._id) ? (
                          <>
                            <UserCheck size={15} className="shrink-0" />
                            <span className="flex-1">Unblock User</span>
                          </>
                        ) : (
                          <>
                            <UserX size={15} className="shrink-0" />
                            <span className="flex-1">Block User</span>
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
              className="hidden lg:block p-2 hover:bg-base-200 rounded-full transition-colors hover:text-red-500"
              title="Close chat"
            >
              <X size={18} />
            </button>
          </div>

        </div>
      )}

      {/* Nickname Dialog — private rename, only ever visible to you */}
      {nicknameDraft !== null && (
        <div
          onClick={() => setNicknameDraft(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[1.5px] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-6 bg-base-100 rounded-2xl shadow-2xl text-left"
          >
            <h3 className="text-lg font-semibold text-base-content">Nickname</h3>
            <p className="mt-1 mb-5 text-sm">
              Only you see this. {selectedUser?.fullName} keeps their real name everywhere else,
              and is never told.
            </p>

            <input
              autoFocus
              type="text"
              maxLength={40}
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setContactNickname(selectedUser._id, nicknameDraft);
                  setNicknameDraft(null);
                }
              }}
              placeholder={selectedUser?.fullName || "Nickname"}
              className="w-full h-12 px-1 text-[15px] bg-transparent border-0 border-b rounded-none text-base-content outline-none transition-colors focus:border-primary focus:ring-0"
            />

            <div className="flex items-center justify-between gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setContactNickname(selectedUser._id, "");
                  setNicknameDraft(null);
                }}
                disabled={!hasNickname(selectedUser, nicknames)}
                className="text-[13px] font-medium text-error disabled:opacity-30 disabled:cursor-default"
              >
                Remove
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNicknameDraft(null)}
                  className="h-10 px-4 rounded-xl hover:bg-base-300 text-[13px] font-medium text-base-content transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactNickname(selectedUser._id, nicknameDraft);
                    setNicknameDraft(null);
                  }}
                  className="h-10 px-5 rounded-xl bg-primary text-primary-content text-[13px] font-semibold transition-transform active:scale-[0.97]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1.5px] animate-in fade-in duration-200">
          <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 text-left">
            <h3 className="font-bold text-lg text-base-content mb-2">Block {contactName}?</h3>
            <p className="text-sm mb-6">Are you sure you want to block this user? You will not be able to send or receive messages from them.</p>
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

      {/* Chat Theme full-screen picker (rendered first so the dimness
          assistant and modals below stay on top of it) */}
      {/* Panel-scoped overlays: rendered through a portal into the chat panel
          root (ChatContainer) so on desktop they cover only the chat column
          and never the sidebar. On mobile the panel fills the screen, so these
          still look full-screen there. */}
      {overlayRef?.current &&
        createPortal(
          <Fragment>
            {/* Chat Theme full-screen picker */}
            {themeScreenOpen && (
              <ChatThemeScreen
                onClose={() => setThemeScreenOpen(false)}
                activeWall={activeChatWall}
                onPickTheme={(id) => {
                  haptic("tap");
                  setConversationWallpaper(id);
                }}
                onPickGalleryFile={handleGalleryFile}
              />
            )}

            {/* Bubble Theme full-screen picker */}
            {bubbleScreenOpen && (
              <BubbleThemeScreen
                onClose={() => setBubbleScreenOpen(false)}
                current={selectedBubblePreset}
                onSelect={(id) => {
                  haptic("tap");
                  setBubbleOverride(bubbleConvKey, id);
                }}
              />
            )}

            {/* Saved Messages full-screen picker */}
            {savedScreenOpen && (
              <SavedMessagesScreen
                onClose={() => setSavedScreenOpen(false)}
                savedMessages={savedMessages}
                onUnsave={(messageId) => {
                  haptic("tap");
                  removeSavedMessage(bubbleConvKey, messageId);
                  setSavedTick((t) => t + 1);
                }}
              />
            )}

            {/* Dimness Adjustment Modal */}
            {pendingWallpaper && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
                <div className="bg-base-100 border border-base-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-5 text-left">
                  <div className="w-full text-center">
                    <h3 className="font-bold text-lg text-base-content">
                      Adjust Wallpaper Dimness
                    </h3>
                    <p className="text-xs mt-0.5">
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
                      <div className="text-base-content px-3 py-1.5 rounded-2xl text-[11px] w-fit max-w-[80%] shadow-sm">
                        Hey! How does this look?
                      </div>
                      <div className="bg-primary text-primary-content px-3 py-1.5 rounded-2xl text-[11px] w-fit max-w-[80%] ml-auto shadow-sm">
                        Looks great! Messages are super clear.
                      </div>
                    </div>
                  </div>

                  {/* Dimness Slider Controls */}
                  <div className="w-full space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
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
                    <div className="flex justify-between text-[10px] font-medium">
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
          </Fragment>,
          overlayRef.current
        )}
    </div>
  );
};

export default ChatHeader;





