import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from 'bcryptjs'
import cloudinary from "../lib/cloudinary.js";
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

        
        generateToken(newUser._id, res);

      
        res.status(201).json({
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            profilePic: newUser.profilePic,
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
    generateToken(user._id,res);
    res.status(200).json({
        _id:user._id,
        fullName:user.fullName,
        email:user.email,
        profilePic:user.profilePic
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
    const { profilePic } = req.body;  // Step 1: Get profilePic from request body
    const userId = req.user._id;      // Step 2: Get logged-in user's ID (likely from token middleware)

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic);  // Step 3: Upload image to Cloudinary

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },  // Step 4: Save Cloudinary URL in database
      { new: true }
    );

    res.status(200).json(updatedUser);  // Step 5: Send updated user info back to client

  } catch (error) {
    console.log("error in update profile:", error);
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