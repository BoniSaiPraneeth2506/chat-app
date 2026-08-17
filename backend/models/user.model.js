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

// Structured social/portfolio links, replacing the single free-text `link`
// field for networking use. `link` is kept alongside it so existing profiles
// (and every place that already renders it) keep working untouched.
const socialLinksSchema=new mongoose.Schema({
    github:{
        type:String,
        default:""
    },
    twitter:{
        type:String,
        default:""
    },
    linkedin:{
        type:String,
        default:""
    },
    youtube:{
        type:String,
        default:""
    },
    portfolio:{
        type:String,
        default:""
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
        // Not required: Google-only accounts have no local password.
        minlength:6
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true
    },
    profilePic:{
        type:String,
        default:""
    },
    // Wide cover photo shown behind the avatar on the profile header.
    bannerPic:{
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
    socialLinks:{
        type:socialLinksSchema,
        default:()=>({})
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
    // Private per-contact renames, keyed by the other user's id. Only ever
    // visible to the person who set them — the contact's real fullName is
    // untouched, and nobody else can see or is notified about the alias.
    // Stored server-side rather than in localStorage so it follows the account
    // across devices, unlike favorites/archive.
    contactNicknames:{
        type:Map,
        of:String,
        default:new Map()
    },
    // When this user last read each conversation: keyed by the other user's id
    // for a DM, and by the group's id for a group. Unread counts were previously held only in browser memory,
    // so they were lost whenever the app was closed or the user logged out —
    // messages that arrived while away came back looking already read.
    // Persisting the read mark here makes the count survive restarts and
    // stay consistent across devices.
    lastReadAt:{
        type:Map,
        of:Date,
        default:new Map()
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
    // Pinned conversations. Previously browser-only (localStorage), so a
    // reinstall lost them and they never followed the user to another device —
    // which multi-account switching made worse, since each account on a shared
    // browser read the same single key.
    pinnedChats:[{
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