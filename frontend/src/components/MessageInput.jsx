// import { useRef, useState } from "react";
// import { useChatStore } from "../store/useChatStore";
// import { Image, Send, X } from "lucide-react";
// import toast from "react-hot-toast";

// const MessageInput = () => {
//   const [text, setText] = useState("");
//   const [imagePreview, setImagePreview] = useState(null);
//   const fileInputRef = useRef(null);
//   const { sendMessage } = useChatStore();
//  const handleImageChange = (e) => {
//   const file = e.target.files[0];
//   if (!file.type.startsWith("image/")) {
//     toast.error("Please select an image file");
//     return;
//   }

//   const reader = new FileReader();
//   reader.onloadend = () => {
//     compressImage(reader.result, 0.6); // 60% quality
//   };
//   reader.readAsDataURL(file);
// };

// const compressImage = (base64, quality = 0.6) => {
//   const img = document.createElement("img"); // Correct way in browser
//   img.src = base64;

//   img.onload = () => {
//     const canvas = document.createElement("canvas");
//     const maxSize = 500; // Max width or height

//     const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
//     canvas.width = img.width * scale;
//     canvas.height = img.height * scale;

//     const ctx = canvas.getContext("2d");
//     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

//     const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
//     setImagePreview(compressedBase64);
//   };
// };



//   const removeImage = () => {
//     setImagePreview(null);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   const handleSendMessage = async (e) => {
//     e.preventDefault();
//     if (!text.trim() && !imagePreview) return;

//     try {
//       await sendMessage({
//         text: text.trim(),
//         image: imagePreview,
//       });

//       // Clear form
//       setText("");
//       setImagePreview(null);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     } catch (error) {
//       console.error("Failed to send message:", error);
//     }
//   };

//   return (
//     <div className="w-full p-4 py-7">
//       {imagePreview && (
//         <div className="flex items-center gap-2 mb-3">
//           <div className="relative">
//             <img
//               src={imagePreview}
//               alt="Preview"
//               className="object-cover w-20 h-20 border rounded-lg border-zinc-700"
//             />
//             <button
//               onClick={removeImage}
//               className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
//               flex items-center justify-center"
//               type="button"
//             >
//               <X className="size-3" />
//             </button>
//           </div>
//         </div>
//       )}

//       <form onSubmit={handleSendMessage} className="flex items-center gap-2">
//         <div className="flex flex-1 gap-2">
//           <input
//             type="text"
//             className="w-full h-10 mt-1 rounded-lg sm:h-10 sm:flex sm:items-center input input-bordered input-sm sm:input-md focus:outline-none focus:ring-0 focus:border-primary"
//             placeholder="Type a message..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//           />
//           <input
//             type="file"
//             accept="image/*"
//             className="hidden"
//             ref={fileInputRef}
//             onChange={handleImageChange}
//           />

//           <button
//             type="button"
//             className={`flex  btn btn-circle sm:mt-1 mt-1
//                      ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
//             onClick={() => fileInputRef.current?.click()}
//           >
//             <Image size={20} />
//           </button>
//         </div>
//         <button
//           type="submit"
//           className="btn btn-sm btn-circle"
//           disabled={!text.trim() && !imagePreview}
//         >
//           <Send size={22} />
//         </button>
//       </form>
//     </div>
//   );
// };
// export default MessageInput;


import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const { sendMessage } = useChatStore();

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      // Detect if keyboard is open by checking viewport height change
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.screen.height;
      const keyboardThreshold = windowHeight * 0.75; // Keyboard likely open if viewport < 75% of screen
      
      setKeyboardVisible(viewportHeight < keyboardThreshold);
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.screen.height - window.visualViewport.height;
        setKeyboardVisible(keyboardHeight > 150); // Keyboard threshold
      }
    };

    // Listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    } else {
      window.addEventListener('resize', handleResize);
    }

    // Focus handling for iOS
    const handleFocus = () => {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 300);
    };

    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('focus', handleFocus);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      } else {
        window.removeEventListener('resize', handleResize);
      }
      if (inputElement) {
        inputElement.removeEventListener('focus', handleFocus);
      }
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
    <div 
      className={`
        fixed bottom-0 left-0 right-0 z-50 
        bg-white border-t border-gray-200 
        transition-all duration-300 ease-in-out
        ${keyboardVisible ? 'pb-safe-area-inset-bottom' : 'pb-4'}
      `}
      style={{
        // Ensure it stays above the keyboard on mobile
        bottom: keyboardVisible && window.visualViewport 
          ? `${window.screen.height - window.visualViewport.height - window.visualViewport.offsetTop}px`
          : '0px'
      }}
    >
      <div className="px-4 pt-4">
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-gray-300"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 min-h-[48px]"
              rows={1}
              style={{
                height: 'auto',
                minHeight: '48px'
              }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-3 bottom-3 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Image size={20} />
            </button>
          </div>

          <button
            type="submit"
            disabled={!text.trim() && !imagePreview}
            className="bg-blue-500 text-white p-3 rounded-2xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;
