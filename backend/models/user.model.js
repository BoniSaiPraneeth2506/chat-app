import mongoose from "mongoose";

const sessionSchema=new mongoose.Schema({
    sid:{
        type:String,
        required:true
    },
    ip:{
        type:String,
        default:""
    },
    userAgent:{
        type:String,
        default:""
    },
    browser:{
        type:String,
        default:"Unknown browser"
    },
    os:{
        type:String,
        default:"Unknown OS"
    },
    device:{
        type:String,
        default:"Desktop"
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    lastActive:{
        type:Date,
        default:Date.now
    }
},{_id:false})

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
    },
    resetPasswordOtp:{
        type:String,
        default:undefined
    },
    resetPasswordExpires:{
        type:Date,
        default:undefined
    },
    sessions:{
        type:[sessionSchema],
        default:[]
    }
},{timestamps:true}
)

const User=mongoose.model("User",userSchema);
export default User