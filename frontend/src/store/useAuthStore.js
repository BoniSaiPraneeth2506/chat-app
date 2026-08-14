import {create } from 'zustand'
import axiosInstance from '../lib/axios.js'
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "") 
  : (import.meta.env.MODE === "development" ? "http://localhost:5001" : "/");

const useAuthStore=create((set,get)=>({
    authUser:null,
    isSigningUp:false,
    isLoggingIn:false,
    isUpdatingProfile:false,
    isCheckingAuth:true,
    isSendingReset:false,
    isResettingPassword:false,
    onlineUsers:[],
    socket:null,
    checkAuth:async()=>{
        try{
           const res=await axiosInstance.get('/auth/check');
           set({authUser:res.data});
           get().connectSocket()
        }catch(err){
           console.log("error in checkauth",err);
           localStorage.removeItem("token");
           set({authUser:null});
        }finally{
            set({isCheckingAuth:false})
        }
    },
    signUp:async(data)=>{
        set({isSigningUp:true})
        try{
           const res=await axiosInstance.post("/auth/signup",data);
           if (res.data && res.data.token) {
             localStorage.setItem("token", res.data.token);
           }
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
             localStorage.removeItem("token");
             set({authUser:null})
             get().disconnectSocket()
             toast.success("Logout successfull")
        }catch(err){
             localStorage.removeItem("token");
             set({authUser:null});
             toast.error(err.response?.data?.message || err.message || "Logout failed");
        }
    },
    forgotPassword: async (email) => {
        set({ isSendingReset: true });
        try {
            const res = await axiosInstance.post("/auth/forgot-password", { email });
            toast.success(res.data?.message || "Reset code sent");
            if (res.data?.devOtp) {
                toast.success(`Dev code: ${res.data.devOtp}`);
            }
            return res.data;
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to send reset code");
            return null;
        } finally {
            set({ isSendingReset: false });
        }
    },
    resetPassword: async (data) => {
        set({ isResettingPassword: true });
        try {
            const res = await axiosInstance.post("/auth/reset-password", data);
            toast.success(res.data?.message || "Password reset successfully");
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to reset password");
            return false;
        } finally {
            set({ isResettingPassword: false });
        }
    },
    login:async(data)=>{
       set({isLoggingIn:true})
        try{
           const res=await axiosInstance.post("/auth/login",data);
           if (res.data && res.data.token) {
             localStorage.setItem("token", res.data.token);
           }
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
      toast.error(error.response?.data?.message || "Failed to update profile");
      throw error;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },
  connectSocket:async()=>{
      const {authUser, socket}=get();
      if(!authUser) return;
      
      if(socket) {
        if (socket.connected) {
          console.log("Socket already connected, skipping creation");
          return;
        }
        socket.disconnect();
      }
      
      console.log("Creating new Socket.IO connection for user:", authUser._id);
      
      const token = localStorage.getItem("token");
      const newSocket = io(BASE_URL, {
        auth: {
          token,  // verified by Socket.IO JWT middleware on the server
        },
        query: {
          userId: authUser._id  // kept for legacy display only, NOT used for auth
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
      })

      newSocket.on('connect', () => {
        console.log("Socket connected successfully:", newSocket.id);
      });

      newSocket.on('disconnect', () => {
        console.log("Socket disconnected - will attempt to reconnect");
      });

      newSocket.on('error', (error) => {
        console.error("Socket error:", error);
      });

      newSocket.on('getOnlineUsers',(userIds)=>{
        console.log("Online users updated:", userIds);
        set({onlineUsers:userIds})
      })

      set({socket:newSocket})
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
