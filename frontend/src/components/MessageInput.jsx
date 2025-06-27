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
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const fileInputRef = useRef(null);
  const { sendMessage } = useChatStore();

  // Only add keyboard detection - like WhatsApp behavior
  useEffect(() => {
    let isInputFocused = false;

    const handleViewportChange = () => {
      if (window.visualViewport && isInputFocused) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        // Only move up if keyboard is actually open AND input is focused
        setKeyboardOffset(keyboardHeight > 150 ? keyboardHeight : 0);
      }
    };

    const handleInputFocus = () => {
      isInputFocused = true;
      // Small delay to ensure keyboard is opening
      setTimeout(() => {
        if (window.visualViewport) {
          const keyboardHeight = window.innerHeight - window.visualViewport.height;
          setKeyboardOffset(keyboardHeight > 150 ? keyboardHeight : 0);
        }
      }, 100);
    };

    const handleInputBlur = () => {
      isInputFocused = false;
      setKeyboardOffset(0);
    };

    // Add event listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // Get the input element and add focus/blur listeners
    const inputElement = document.querySelector('input[type="text"]');
    if (inputElement) {
      inputElement.addEventListener('focus', handleInputFocus);
      inputElement.addEventListener('blur', handleInputBlur);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
      if (inputElement) {
        inputElement.removeEventListener('focus', handleInputFocus);
        inputElement.removeEventListener('blur', handleInputBlur);
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
      style={{ 
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : 'translateY(0)',
        transition: 'transform 0.3s ease'
      }}
    >
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="w-20 h-20 object-cover rounded-xl border border-zinc-700"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-zinc-800 text-white rounded-full p-1 hover:bg-zinc-700 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-3 p-4 bg-zinc-900 rounded-2xl">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="w-full px-4 py-3 pr-12 bg-zinc-800 text-white placeholder-zinc-400 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-zinc-600"
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
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Image size={20} />
          </button>
        </div>

        <button
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="bg-zinc-700 text-white p-3 rounded-xl hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
