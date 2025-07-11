import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'

const protectRoute=async (req,res,next)=>{
  try{
     const token=req.cookies.jwt;
     if(!token){
        return res.status(401).json({message:"user is not authenticated"})
     }
     const decoded=jwt.verify(token,process.env.JWT_SECRET);
     if(!decoded){
         return res.status(401).json({message:"unAuthorized-invalid token"})
     }
     const user=await User.findById(decoded.userId).select("-password")
     if(!user){
        return res.status(401).json({message:"user not found"})
     }
     req.user=user;
     next();

  }catch(err){
    console.log(err);
    res.status(500).json({message:"internal server error"})
    
  }
}

export default protectRoute;