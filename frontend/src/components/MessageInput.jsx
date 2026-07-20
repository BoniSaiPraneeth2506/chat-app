import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const { sendMessage } = useChatStore();


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
  const img = document.createElement("img"); // Correct way in browser
  img.src = base64;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    const maxSize = 500; // Max width or height

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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    try {
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
      });

      // Clear form
      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="w-full px-4 py-3 bg-base-200/50 flex flex-col gap-2">
      {imagePreview && (
        <div className="flex items-center gap-2 mb-1">
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
          {/* Image attachment button inside the input container */}
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
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Send button as a clean circular action button */}
        <button
          type="submit"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0
            ${
              text.trim() || imagePreview
                ? "bg-primary text-primary-content hover:scale-105 active:scale-95"
                : "bg-base-100 text-base-content/25 border border-base-300/30 cursor-not-allowed"
            }
          `}
          disabled={!text.trim() && !imagePreview}
        >
          <Send size={16} className="ml-0.5" />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;


