import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import useAuthStore from "../store/useAuthStore";
import { Image, Send, X, CornerDownLeft, Mic, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  
  const { 
    sendMessage, 
    replyingToMessage, 
    setReplyingToMessage, 
    editingMessage,
    setEditingMessage,
    editMessage,
    sendTypingStatus, 
    selectedUser 
  } = useChatStore();
  const { authUser } = useAuthStore();

  const isBlocked = authUser?.blockedUsers?.includes(selectedUser?._id);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
      if (replyingToMessage) setReplyingToMessage(null); // Cancel reply if editing
    } else {
      setText("");
    }
  }, [editingMessage]);

  useEffect(() => {
    // Reset typing status and recording on unmount
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      compressImage(reader.result, 0.6); // 60% quality
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (base64, quality = 0.6) => {
    const img = document.createElement("img");
    img.src = base64;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 500;

      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      setImagePreview(compressedBase64);
    };
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextChange = (e) => {
    setText(e.target.value);

    // Emit typing status to socket
    sendTypingStatus(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatus(false);

    try {
      if (editingMessage) {
        await editMessage(editingMessage._id, text.trim());
        setEditingMessage(null);
      } else {
        await sendMessage({
          text: text.trim(),
          image: imagePreview,
        });
      }

      // Clear form
      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
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

  return (
    <div className="w-full px-4 py-3 bg-base-200/50 flex flex-col gap-2 relative border-t border-base-300 lg:border-t-0">
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

      {imagePreview && (
        <div className="flex items-center gap-2 mb-1 animate-in slide-in-from-bottom duration-200">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="object-cover w-20 h-20 border rounded-lg border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center shadow-sm"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-3 bg-base-100 rounded-full px-4 py-1.5 min-h-[42px] border border-base-300/30 shadow-sm">
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
                  imagePreview ? "text-emerald-500" : "text-base-content/40 hover:text-base-content"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Image size={18} />
              </button>

              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />

              <input
                type="text"
                className="flex-1 bg-transparent text-sm text-base-content placeholder-base-content/40 focus:outline-none py-1"
                placeholder="Type a message..."
                value={text}
                onChange={handleTextChange}
              />
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
            type={text.trim() || imagePreview ? "submit" : "button"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0
              ${
                text.trim() || imagePreview
                  ? "bg-primary text-primary-content hover:scale-105 active:scale-95"
                  : "bg-base-100 text-base-content/40 border border-base-300/30 hover:bg-base-200"
              }
            `}
            onClick={(e) => {
              if (!text.trim() && !imagePreview) {
                e.preventDefault();
                startRecording();
              }
            }}
          >
            {text.trim() || imagePreview ? <Send size={16} className="ml-0.5" /> : <Mic size={18} />}
          </button>
        )}
      </form>
    </div>
  );
};
export default MessageInput;


