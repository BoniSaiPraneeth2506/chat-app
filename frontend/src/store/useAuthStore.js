import {create } from 'zustand'
import axiosInstance from '../lib/axios.js'
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

const useAuthStore=create((set,get)=>({
    authUser:null,
    isSigningUp:false,
    isLoggingIn:false,
    isUpdatingProfile:false,
    isCheckingAuth:true,
    onlineUsers:[],
    socket:null,
    checkAuth:async()=>{
        try{
           const res=await axiosInstance.get('/auth/check');
           set({authUser:res.data});
           get().connectSocket()
        }catch(err){
          console.log("error in checkauth",err)
        }finally{
            set({isCheckingAuth:false})
        }
    },
    signUp:async(data)=>{
        set({isSigningUp:true})
        try{
           const res=await axiosInstance.post("/auth/signup",data);
           set({authUser:res.data});
           toast.success("Account created successfully")
           get().connectSocket()
        }catch(err){
          toast.error(err.response?.data?.message || err.message || "Something went wrong");

        }finally{
            set({isSigningUp:false})
        }
    },
    logOut:async()=>{
        try{
             await axiosInstance.post('/auth/logout');
             set({authUser:null})
             get().disconnectSocket()
             toast.success("Logout successfull")
        }catch(err){
            toast.error(err.response.data.message)
        }
    },
    login:async(data)=>{
       set({isLoggingIn:true})
        try{
           const res=await axiosInstance.post("/auth/login",data);
           set({authUser:res.data});
           toast.success("Logged in successfully")
           get().connectSocket()

        }catch(err){
          toast.error(err.response?.data?.message || err.message || "Something went wrong");

        }finally{
            set({isLoggingIn:false})
        }
    },
    updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },
  connectSocket:async()=>{
      const {authUser}=get();
      if(!authUser || get().socket?.connected) return;
      const socket=io(BASE_URL,{
        query:{
            userId:authUser._id
        }
      })

      socket.connect();
      set({socket:socket})
      socket.on('getOnlineUsers',(userIds)=>{
        set({onlineUsers:userIds})
      })
  },
  disconnectSocket:async()=>{
    const { socket } = get();
    if (socket?.connected) {
        socket.disconnect();
        set({ socket: null });  
  }
}
}))
export default useAuthStore
