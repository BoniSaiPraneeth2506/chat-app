import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import useAuthStore from "../store/useAuthStore";
import { Image, Send, X, CornerDownLeft, Mic, Trash2, Lock, Clock, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import CreatePollModal from "./CreatePollModal";

const MessageInput = () => {
  const [text, setText] = useState("");
  // Mentions are tracked explicitly rather than re-parsed from the text, so a
  // name that merely looks like "@someone" never notifies a real person.
  const [mentionIds, setMentionIds] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // null = picker closed
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isOneView, setIsOneView] = useState(false);
  const [isSendingAnimation, setIsSendingAnimation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadAbortRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  // Poll composer
  const [showPollModal, setShowPollModal] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  // Scheduling states
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(""); // format: yyyy-MM-ddTHH:mm (datetime-local)
  
  const { 
    sendMessage, 
    replyingToMessage, 
    setReplyingToMessage, 
    editingMessage,
    setEditingMessage,
    editMessage,
    sendTypingStatus, 
    selectedUser,
    drafts,
    setDraft
  } = useChatStore();

  const {
    selectedGroup,
    sendGroupMessage,
    sendGroupTypingStatus,
  } = useGroupStore();

  const { authUser } = useAuthStore();

  const isBlocked = authUser?.blockedUsers?.includes(selectedUser?._id);

  // Evaluate Read-Only Group Restrictions
  let isReadOnlyRestricted = false;
  if (selectedGroup && selectedGroup.isReadOnly) {
    const member = selectedGroup.members?.find((m) => (m.user?._id || m.user)?.toString() === authUser?._id?.toString());
    if (member && member.role === "member") {
      isReadOnlyRestricted = true;
    }
  }

  // Load draft when switching users
  useEffect(() => {
    if (selectedUser) {
      setText(drafts[selectedUser._id] || "");
    } else {
      setText("");
    }
  }, [selectedUser]);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
      if (replyingToMessage) setReplyingToMessage(null); // Cancel reply if editing
    }
  }, [editingMessage]);

  useEffect(() => {
    // Reset typing status and recording on unmount
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);

  const handleKeyDown = (e) => {
    if (isMobile) return;
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      // simulate submit
      const fakeEvent = { preventDefault: () => {} };
      handleSendMessage(fakeEvent);
    }
    // ArrowUp to edit last message when input empty
    if (e.key === 'ArrowUp' && !text.trim()) {
      try {
        const last = useChatStore.getState().messages?.slice().reverse().find(m => (m.senderId?._id || m.senderId) === useAuthStore.getState().authUser?._id && m.text);
        if (last) setEditingMessage(last);
      } catch (err) {}
    }
  };

  const addImageFiles = (files) => {
    if (files.length === 0) return;

    if (imagePreviews.length + files.length > 5) {
      toast.error("You can select up to 5 images per message");
      return;
    }

    const nonImage = files.find(f => !f.type.startsWith("image/"));
    if (nonImage) {
      toast.error("Please select only image files");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        compressImage(reader.result, 0.6);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = (e) => {
    addImageFiles(Array.from(e.target.files));
  };

  // Ctrl/Cmd+V of an image anywhere in the chat attaches it as a preview.
  const handlePaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    addImageFiles(files);
  };

  const handleDragOver = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleDrop = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    setIsDraggingFiles(false);
    addImageFiles(Array.from(e.dataTransfer.files));
  };

  // Paste and drag-and-drop are window level so the whole chat window is a drop target.
  useEffect(() => {
    if (isBlocked || isReadOnlyRestricted) return;

    const onDragLeave = (e) => {
      if (e.relatedTarget === null) setIsDraggingFiles(false);
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [imagePreviews, isBlocked, isReadOnlyRestricted]);

  const compressImage = (base64, quality = 0.6) => {
    const img = document.createElement("img");
    img.src = base64;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 600;

      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      setImagePreviews(prev => [...prev, compressedBase64].slice(0, 5));
    };
  };

  const removeImage = (indexToRemove) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (imagePreviews.length <= 1) {
      setIsOneView(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (selectedUser) {
      setDraft(selectedUser._id, val);
    }

    // Emit typing status to socket
    sendTypingStatus(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 1500);
  };

  // Opens the picker when the caret sits on an "@word" and we're in a group.
  const handleMentionScan = (value) => {
    if (!selectedGroup) return setMentionQuery(null);
    const match = /(?:^|\s)@([\w]*)$/.exec(value);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const mentionCandidates =
    selectedGroup && mentionQuery !== null
      ? (selectedGroup.members || [])
          .map((m) => m.user)
          .filter(Boolean)
          .filter((u) => u._id !== authUser?._id)
          .filter((u) => (u.fullName || "").toLowerCase().includes(mentionQuery))
          .slice(0, 6)
      : [];

  const applyMention = (user) => {
    // Replace the partial "@word" the caret is sitting on with the full name.
    const next = text.replace(/(?:^|\s)@[\w]*$/, (m) =>
      `${m.startsWith(" ") ? " " : ""}@${user.fullName} `
    );
    setText(next);
    setMentionIds((prev) => (prev.includes(user._id) ? prev : [...prev, user._id]));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && imagePreviews.length === 0) return;

    const messageText = text.trim();
    const currentImages = [...imagePreviews];
    const messageOneView = isOneView;
    const currentEditing = editingMessage;

    const willUploadImages = imagePreviews.length > 0;

    // Clear text & draft instantly, but keep previews visible during upload
    setText("");
    if (selectedUser) {
      setDraft(selectedUser._id, "");
    }
    if (!willUploadImages) {
      setImagePreviews([]);
      setIsOneView(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatus(false);
    
    setIsSendingAnimation(true);
    setTimeout(() => setIsSendingAnimation(false), 250);

    try {
      if (selectedGroup) {
        await sendGroupMessage({
          text: messageText,
          image: currentImages[0] || "",
          images: currentImages.length > 1 ? currentImages : [],
          replyTo: replyingToMessage?._id || null,
          mentions: mentionIds,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        });
        setMentionIds([]);
        setShowScheduler(false);
        setScheduledAt("");
        if (replyingToMessage) setReplyingToMessage(null);
      } else if (currentEditing) {
        await editMessage(currentEditing._id, messageText);
        setEditingMessage(null);
      } else {
        if (currentImages.length > 0) {
          // Use progress-enabled send for images so we can show upload progress and allow cancel
          setIsUploading(true);
          setUploadProgress(0);
          const controller = new AbortController();
          uploadAbortRef.current = controller;
          try {
            await useChatStore.getState().sendMessageWithProgress({
              text: messageText,
              image: currentImages[0] || "",
              images: currentImages.length > 1 ? currentImages : [],
              isOneView: messageOneView,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            }, {
              onProgress: (p) => setUploadProgress(p),
              signal: controller.signal
            });
            setShowScheduler(false);
            setScheduledAt("");
          } catch (err) {
            if (err.message === 'aborted') {
              toast.error('Upload cancelled');
            } else {
              console.error('Failed to send message with progress', err);
              toast.error('Failed to send');
            }
          } finally {
            setIsUploading(false);
            setUploadProgress(0);
            uploadAbortRef.current = null;
            setImagePreviews([]);
            setIsOneView(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        } else {
          if (currentImages.length > 1) {
            await sendMessage({
              text: messageText,
              images: currentImages,
              isOneView: false, // Multi-image doesn't use View Once
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            });
            setShowScheduler(false);
            setScheduledAt("");
          } else {
            await sendMessage({
              text: messageText,
              image: currentImages[0] || "",
              isOneView: messageOneView,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            });
            setShowScheduler(false);
            setScheduledAt("");
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const cancelUpload = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          try {
            await sendMessage({
              voice: base64Audio
            });
          } catch (error) {
            console.error("Failed to send voice message:", error);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      sendTypingStatus("recording");

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    sendTypingStatus(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (!shouldSend) {
        mediaRecorderRef.current.onstop = () => {
          // Discard
        };
      }
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (isBlocked) {
    return (
      <div className="w-full px-4 py-4 bg-base-200/50 flex items-center justify-center text-sm text-base-content/60 font-medium border-t border-base-300">
        <span>You have blocked this user. Unblock to send messages.</span>
      </div>
    );
  }

  if (isReadOnlyRestricted) {
    return (
      <div className="w-full px-4 py-4 bg-base-200/50 flex items-center justify-center text-sm text-amber-500 font-medium border-t border-base-300 gap-2 select-none">
        <Lock size={16} />
        <span>Only Admins and Moderators can send messages in this group.</span>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-3 bg-base-200/50 flex flex-col gap-2 relative border-t border-base-300 lg:border-t-0">
      {showPollModal && <CreatePollModal onClose={() => setShowPollModal(false)} />}
      {isDraggingFiles && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-base-100/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 px-8 py-6 border-2 border-dashed border-primary rounded-2xl bg-base-100 shadow-xl">
            <Image size={28} className="text-primary" />
            <span className="text-sm font-semibold">Drop images to attach</span>
            <span className="text-xs text-base-content/60">Up to 5 images per message</span>
          </div>
        </div>
      )}
      {/* Quoted Reply Banner */}
        {replyingToMessage && (
          <div className="flex items-center justify-between bg-base-200/90 px-4 py-2 border-l-4 border-primary rounded-r-lg mb-1 relative text-left">
            <div className="text-xs">
              <span className="text-primary font-semibold select-none flex items-center gap-1">
                <CornerDownLeft size={10} />
                Replying to {replyingToMessage.senderId === authUser?._id ? "yourself" : selectedUser?.fullName}
              </span>
              <p className="text-base-content/75 truncate max-w-[200px] sm:max-w-[400px] mt-0.5">
                {replyingToMessage.text || (replyingToMessage.image ? "📷 Photo" : replyingToMessage.voice ? "🎙️ Voice Message" : "Message")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              className="p-1 hover:bg-base-300 rounded-full transition-colors text-base-content/50"
              title="Cancel reply"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {/* Editing Message Banner */}
        {editingMessage && (
          <div className="flex items-center justify-between bg-base-200/90 px-4 py-2 border-l-4 border-warning rounded-r-lg mb-1 relative text-left">
            <div className="text-xs">
              <span className="text-warning font-semibold select-none flex items-center gap-1">
                Editing Message
              </span>
              <p className="text-base-content/75 truncate max-w-[200px] sm:max-w-[400px] mt-0.5">
                {editingMessage.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingMessage(null)}
              className="p-1 hover:bg-base-300 rounded-full transition-colors text-base-content/50"
              title="Cancel edit"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {imagePreviews.length > 0 && (
          <div className="flex items-center gap-2 mb-1 overflow-x-auto pb-1 max-w-full animate-in slide-in-from-bottom duration-200">
            {imagePreviews.map((imgSrc, idx) => (
              <div key={idx} className="relative shrink-0">
                <img
                  src={imgSrc}
                  alt={`Preview ${idx + 1}`}
                  className="object-cover w-20 h-20 border rounded-lg border-zinc-700 shadow-sm"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-black/30 rounded-lg flex items-end">
                    <div className="w-full px-2 pb-2">
                      <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-1 bg-primary" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-white/90 mt-1">
                        <span>{uploadProgress}%</span>
                        <button onClick={cancelUpload} type="button" className="text-xs text-red-200 hover:text-red-300">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
                  flex items-center justify-center shadow-md hover:bg-base-200"
                  type="button"
                >
                  <X className="size-3 text-base-content" />
                </button>
                {imagePreviews.length === 1 && (
                  <button
                    onClick={() => setIsOneView(!isOneView)}
                    className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md font-bold text-xs transition-all border select-none
                      ${isOneView 
                        ? "bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-500/20 scale-110" 
                        : "bg-base-300 text-base-content border-base-300 hover:bg-base-200"
                      }
                    `}
                    title={isOneView ? "View Once Photo enabled" : "Set as View Once Photo"}
                    type="button"
                  >
                    1
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mention picker — floats above the composer, group chats only */}
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 rounded-2xl bg-base-100 shadow-2xl overflow-hidden z-30">
            {mentionCandidates.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => applyMention(user)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-base-200 transition-colors text-left"
              >
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt=""
                  className="object-cover rounded-full size-8 flex-shrink-0"
                />
                <span className="text-sm text-base-content truncate">{user.fullName}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-3 bg-base-100 rounded-full px-4 py-1.5 min-h-[42px] border border-base-300/30 shadow-sm">
          {isRecording ? (
            <div className="flex items-center justify-between w-full px-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span className="text-xs text-base-content font-medium">Recording {formatTime(recordingTime)}</span>
              </div>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="text-red-500 hover:text-red-600 transition-colors p-1 hover:bg-base-200 rounded-full"
                title="Discard recording"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`p-1 hover:bg-base-200 rounded-full transition-colors flex items-center justify-center ${
                  imagePreviews.length > 0 ? "text-emerald-500" : "text-base-content/40 hover:text-base-content"
                }`}
                onClick={() => fileInputRef.current?.click()}
                title="Attach images (up to 5)"
              >
                <Image size={18} />
              </button>

              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />

              {selectedGroup && (
                <button
                  type="button"
                  onClick={() => setShowPollModal(true)}
                  title="Create a poll"
                  className="p-1 hover:bg-base-200 rounded-full transition-colors flex items-center justify-center text-base-content/40 hover:text-base-content"
                >
                  <BarChart3 size={18} />
                </button>
              )}

              <input
                id="message-input"
                ref={inputRef}
                type="text"
                aria-label="Write a message"
                aria-describedby="msg-help"
                className="flex-1 min-w-0 bg-transparent text-sm text-base-content placeholder-base-content/40 focus:outline-none py-1"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => { handleTextChange(e); handleMentionScan(e.target.value); }}
                onKeyDown={handleKeyDown}
              />
              <div id="msg-help" className="sr-only">Press Ctrl+Enter to send on desktop. Use Arrow Up to edit your last message.</div>
              {/* Scheduler toggle + picker */}
              <div className="flex items-center gap-2 ml-2">
                <button
                  type="button"
                  title={showScheduler ? "Hide scheduler" : "Schedule message"}
                  onClick={() => setShowScheduler((s) => !s)}
                  className={`p-1 rounded-full hover:bg-base-200 text-base-content/50`}
                >
                  <Clock size={16} />
                </button>
                {showScheduler && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-xs bg-base-100 border rounded px-2 py-1"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {isRecording ? (
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0 bg-red-500 text-white hover:scale-105 active:scale-95"
            title="Stop & Send Voice Note"
          >
            <Send size={16} className="ml-0.5" />
          </button>
        ) : (
          <button
            type={text.trim() || imagePreviews.length > 0 || isSendingAnimation ? "submit" : "button"}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0 overflow-hidden
              ${
                text.trim() || imagePreviews.length > 0 || isSendingAnimation
                  ? "bg-primary text-primary-content hover:scale-105 active:scale-95"
                  : "bg-base-100 text-base-content/40 border border-base-300/30 hover:bg-base-200"
              }
            `}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              if (!text.trim() && imagePreviews.length === 0 && !isSendingAnimation) {
                e.preventDefault();
                startRecording();
              }
            }}
          >
            {text.trim() || imagePreviews.length > 0 || isSendingAnimation ? (
              <Send 
                size={16} 
                className={`ml-0.5 transition-all duration-300 ease-in-out ${isSendingAnimation ? "translate-x-5 -translate-y-5 opacity-0 scale-50" : "translate-x-0 translate-y-0 opacity-100 scale-100"}`} 
              />
            ) : (
              <Mic size={18} />
            )}
          </button>
        )}
      </form>
    </div>
  );
};
export default MessageInput;


