import mongoose from "mongoose";
const userSchema=new mongoose.Schema({
     fullName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
        minlength:6
    },
    profilePic:{
        type:String,
        default:""
    },
    bio:{
        type:String,
        default:""
    },
    link:{
        type:String,
        default:""
    },
    onlinePrivacy:{
        type:Boolean,
        default:true
    },
    disappearingTimers:{
        type:Map,
        of:String,
        default:new Map()
    },
    lastSeen:{
        type:Date,
        default:Date.now
    },
    favorites:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default:[]
    }],
    archived:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default:[]
    }],
    blockedUsers:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default:[]
    }],
    chatWallpapers:{
        type:Map,
        of:String,
        default:new Map()
    }
},{timestamps:true}
)

const User=mongoose.model("User",userSchema);
export default User