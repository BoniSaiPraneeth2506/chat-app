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
//     <div className="w-full p-4 py-15">
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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const { sendMessage } = useChatStore();

  useEffect(() => {
    const handleResize = () => {
      // Detect keyboard open/close on mobile
      const isKeyboard = window.visualViewport 
        ? window.visualViewport.height < window.innerHeight * 0.75
        : window.innerHeight < screen.height * 0.75;
      
      setIsKeyboardOpen(isKeyboard);
      
      if (isKeyboard && inputRef.current && inputRef.current === document.activeElement) {
        // Scroll to bottom when keyboard opens and input is focused
        setTimeout(() => {
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    };

    const handleFocus = () => {
      setTimeout(() => {
        setIsKeyboardOpen(true);
        // Scroll to bottom when input is focused
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 300); // Delay to allow keyboard animation
    };

    const handleBlur = () => {
      setTimeout(() => {
        setIsKeyboardOpen(false);
      }, 100);
    };

    // Listen for viewport changes (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleResize);
    }

    // Listen for input focus/blur
    if (inputRef.current) {
      inputRef.current.addEventListener('focus', handleFocus);
      inputRef.current.addEventListener('blur', handleBlur);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
      
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', handleFocus);
        inputRef.current.removeEventListener('blur', handleBlur);
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
      className={`w-full p-4 py-15 transition-all duration-300 ${
        isKeyboardOpen 
          ? 'fixed bottom-0 left-0 right-0 z-50 bg-base-100' 
          : ''
      }`}
      style={{
        paddingBottom: isKeyboardOpen ? 'env(keyboard-inset-height, 0px)' : undefined
      }}
    >
      {imagePreview && (
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="object-cover w-20 h-20 border rounded-lg border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex flex-1 gap-2">
          <input
            ref={inputRef}
            type="text"
            className="w-full h-10 mt-1 rounded-lg sm:h-10 sm:flex sm:items-center input input-bordered input-sm sm:input-md focus:outline-none focus:ring-0 focus:border-primary"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />
          <button
            type="button"
            className={`flex  btn btn-circle sm:mt-1 mt-1
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Image size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !imagePreview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;

