import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from 'bcryptjs'
import cloudinary from "../lib/cloudinary.js";
import { updateUserPrivacyState } from "../lib/socket.js";
const signup = async (req, res) => {
    const { fullName, email, password } = req.body;

    try {
       
        if (!password || !fullName || !email) {
            return res.status(400).json({ message: "All fields are required" });
        }

       
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already exists" });
        }

       
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        
        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        
        const token = generateToken(newUser._id, res);

      
        res.status(201).json({
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            profilePic: newUser.profilePic,
            token,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const login =async (req,res)=>{
   const {email,password}=req.body;
   try{
    const user=await User.findOne({email})
    if(!user){
       return  res.status(500).json({ message: "invalid credentials" });
    }
    const isPassword= await bcrypt.compare(password,user.password);
    if(!isPassword){
      return  res.status(500).json({ message: "invalid password" });  
    }
    const token = generateToken(user._id,res);
    res.status(200).json({
        _id:user._id,
        fullName:user.fullName,
        email:user.email,
        profilePic:user.profilePic,
        token
    })
   }catch(err){
    console.log(err);
    res.status(500).json({
        message:"internal server error"
    })
    
   }
}

const logout =async (req,res)=>{
   try{
      res.cookie("jwt","",{maxAge:0});
       res.status(200).json({message:"logged out succesfully"})
   }catch(err){
      console.log(err);
      res.status(500).json({message:"internal server error"})
   }
}

 const updateProfile = async (req, res) => {
  try {
    const { profilePic, fullName, email, bio, link, onlinePrivacy, messageTimer } = req.body;
    const userId = req.user._id;

    const updateData = {};

    if (fullName) updateData.fullName = fullName;
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        return res.status(400).json({ message: "Email is already taken" });
      }
      updateData.email = email;
    }
    if (bio !== undefined) updateData.bio = bio;
    if (link !== undefined) updateData.link = link;
    if (onlinePrivacy !== undefined) {
      updateData.onlinePrivacy = onlinePrivacy;
      updateUserPrivacyState(userId, onlinePrivacy === false);
    }
    if (messageTimer !== undefined) updateData.messageTimer = messageTimer;

    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      updateData.profilePic = uploadResponse.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    res.status(200).json(updatedUser);

  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const checkAuth=(req,res)=>{
   try{
   res.status(200).json(req.user)
   }catch(err){
    console.log(err);
   }
}
export {signup,login,logout,updateProfile,checkAuth}