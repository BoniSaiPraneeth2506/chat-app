// import Message from "../models/message.model.js";
// import User from "../models/user.model.js";
// import cloudinary from "../lib/cloudinary.js";

// const getUsersForSidebar=async (req,res)=>{
//     try{
//         const loggedinUserId=req.user._id;
//         const filteredUsers=await User.find({_id:{$ne:loggedinUserId}}).select("-password")
//         res.status(200).json(filteredUsers);
//     }catch(err){
//         console.log(err);
//         res.status(500).json({message:"internal server error"})
//     }
// }


// const getMessages=async (req,res)=>{
//     try{
//       const {id:userToChatId}=req.params;
//     const myId=req.user._id;

//     const messages=await Message.find({
//         $or :[
//             {senderId:myId,receiverId:userToChatId},
//             {senderId:userToChatId,receiverId:myId}
//         ]
//     })
//     res.status(200).json(messages)
//     }catch(err){
//         console.log(err);
//         res.status(500).json({message:"internal server error"})
//     }
   
// }

// const sendMessage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { text, image } = req.body;
//     const senderId = req.user._id;

//     let imageUrl = "";

//     if (image) {
//       const uploadResponse = await cloudinary.uploader.upload(image);
//       imageUrl = uploadResponse.secure_url;
//     }

//     const newMessage = new Message({
//       senderId,
//       receiverId:id,
//       text,
//       image: imageUrl
//     });

//     await newMessage.save();

//     res.status(201).json(newMessage);

//   } catch (error) {
//     console.log("Error in sendMessage:", error);
//     res.status(500).json({ message: "Failed to send message" });
// }
// };
// export {getUsersForSidebar,getMessages,sendMessage}


import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId }
      ]
    }).sort({ createdAt: 1 }); // Optional: Sort messages by time

    res.status(200).json(messages);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const { text, image } = req.body;
    const senderId = req.user._id;

    let imageUrl = "";

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl
    });

    await newMessage.save();
    const receiverSocketId=getReceiverSocketId(receiverId);
    if(receiverSocketId){
      io.to(receiverSocketId).emit("newMessage",newMessage)
    }

    res.status(201).json(newMessage);

  } catch (error) {
    console.log("Error in sendMessage:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

export { getUsersForSidebar, getMessages, sendMessage };
