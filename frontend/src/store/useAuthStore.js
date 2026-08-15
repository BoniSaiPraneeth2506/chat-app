import {create } from 'zustand'
import axiosInstance from '../lib/axios.js'
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { isNetworkError, subscribeOnlineStatus } from '../lib/network.js';
import { deleteUserDb } from '../lib/db.js';

const BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "")
  : (import.meta.env.MODE === "development" ? "http://localhost:5001" : "/");

// A snapshot of the last known signed-in user, so a cold app launch with no
// network yet can render the logged-in shell instantly instead of a blank
// login screen while checkAuth() confirms things in the background.
const AUTH_SNAPSHOT_KEY = "authUserSnapshot";
const loadAuthSnapshot = () => {
  try {
    const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const persistAuthSnapshot = (user) => {
  try {
    if (user) localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_SNAPSHOT_KEY);
  } catch {
    // Storage unavailable/full — snapshotting is a nice-to-have, never fatal.
  }
};

// Axios's own message for a network failure is the literal string "Network
// Error" — never show that verbatim; every auth action below can plausibly
// be attempted while offline (e.g. opening the app and trying to log in
// without noticing there's no connection yet).
const friendlyAuthError = (err, fallback) =>
  isNetworkError(err) ? "You're offline — check your connection and try again" : (err.response?.data?.message || err.message || fallback);

const useAuthStore=create((set,get)=>({
    authUser:loadAuthSnapshot(),
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    isSigningUp:false,
    isLoggingIn:false,
    isUpdatingProfile:false,
    isCheckingAuth:true,
    isSendingReset:false,
    isResettingPassword:false,
    onlineUsers:[],
    socket:null,
    sessions:[],
    isLoadingSessions:false,
    // Clears the client once this device's session is revoked elsewhere.
    // Idempotent, and stays client-side so the login page is not reloaded.
    handleSessionRevoked:()=>{
        const {socket,authUser}=get();
        if(socket){
            socket.removeAllListeners?.();
            socket.disconnect();
        }
        localStorage.removeItem("token");
        persistAuthSnapshot(null);
        if(authUser) deleteUserDb(authUser._id);
        set({authUser:null,socket:null,sessions:[],onlineUsers:[],isCheckingAuth:false});
        if(authUser) toast.error("This device was logged out from another session");
    },
    getSessions:async()=>{
        set({isLoadingSessions:true})
        try{
            const res=await axiosInstance.get('/auth/sessions');
            set({sessions:Array.isArray(res.data)?res.data:[]});
        }catch(err){
            toast.error(err.response?.data?.message || "Failed to load sessions");
        }finally{
            set({isLoadingSessions:false})
        }
    },
    revokeSession:async(sid)=>{
        try{
            await axiosInstance.delete(`/auth/sessions/${sid}`);
            set((state)=>({sessions:state.sessions.filter((s)=>s.sid!==sid)}));
            toast.success("Device logged out");
        }catch(err){
            toast.error(err.response?.data?.message || "Failed to log out device");
        }
    },
    revokeOtherSessions:async()=>{
        try{
            const res=await axiosInstance.post('/auth/sessions/logout-others');
            set((state)=>({sessions:state.sessions.filter((s)=>s.isCurrent)}));
            toast.success(res.data?.message || "Other sessions logged out");
        }catch(err){
            toast.error(err.response?.data?.message || "Failed to log out other sessions");
        }
    },
    checkAuth:async()=>{
        try{
           const res=await axiosInstance.get('/auth/check');
           set({authUser:res.data,isOffline:false});
           persistAuthSnapshot(res.data);
           get().connectSocket()
        }catch(err){
           console.log("error in checkauth",err);
           if(isNetworkError(err)){
               // Server unreachable (offline/cold start) — keep whatever
               // cached session we already have instead of logging the
               // user out just because the network hiccuped.
               set({isOffline:true});
           }else{
               // A real response came back and it wasn't OK: the session
               // is genuinely invalid, so this is the only case that clears it.
               localStorage.removeItem("token");
               persistAuthSnapshot(null);
               set({authUser:null});
           }
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
           persistAuthSnapshot(res.data);
           toast.success("Account created successfully")
           get().connectSocket()
        }catch(err){
          toast.error(friendlyAuthError(err, "Something went wrong"));
        }finally{
            set({isSigningUp:false})
        }
    },
    logOut:async()=>{
        // Own account's cached messages must not survive a logout on a
        // shared device, or the next person to log in on it would see them.
        const currentUser=get().authUser;
        try{
             await axiosInstance.post('/auth/logout');
             localStorage.removeItem("token");
             persistAuthSnapshot(null);
             if(currentUser) deleteUserDb(currentUser._id);
             set({authUser:null})
             get().disconnectSocket()
             toast.success("Logout successfull")
        }catch(err){
             localStorage.removeItem("token");
             persistAuthSnapshot(null);
             if(currentUser) deleteUserDb(currentUser._id);
             set({authUser:null});
             toast.error(friendlyAuthError(err, "Logout failed"));
        }
    },
    forgotPassword: async (email) => {
        set({ isSendingReset: true });
        try {
            const res = await axiosInstance.post("/auth/forgot-password", { email }, { timeout: 45000 });
            toast.success(res.data?.message || "Reset code sent");
            if (res.data?.devOtp) {
                toast.success(`Dev code: ${res.data.devOtp}`);
            }
            return res.data;
        } catch (err) {
            toast.error(
              err.code === "ECONNABORTED"
                ? "Request timed out. Open the backend URL once to wake it, then try again."
                : friendlyAuthError(err, "Failed to send reset code")
            );
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
            toast.error(friendlyAuthError(err, "Failed to reset password"));
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
           persistAuthSnapshot(res.data);
           toast.success("Logged in successfully")
           get().connectSocket()
        }catch(err){
          toast.error(friendlyAuthError(err, "Something went wrong"));
        }finally{
            set({isLoggingIn:false})
        }
    },
    loginWithGoogle:async(idToken)=>{
       set({isLoggingIn:true})
        try{
           const res=await axiosInstance.post("/auth/google",{idToken});
           if (res.data && res.data.token) {
             localStorage.setItem("token", res.data.token);
           }
           set({authUser:res.data});
           persistAuthSnapshot(res.data);
           toast.success("Logged in successfully")
           get().connectSocket()
        }catch(err){
          toast.error(friendlyAuthError(err, "Google sign-in failed"));
        }finally{
            set({isLoggingIn:false})
        }
    },
    updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      persistAuthSnapshot(res.data);
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
        set({isOffline:false});
        // Back online (first connect or a reconnect): flush anything that
        // was queued while offline. Dynamic import avoids a circular
        // dependency, same pattern as the axios interceptor in lib/axios.js.
        import("./useChatStore").then(({ useChatStore }) => useChatStore.getState().flushOutbox());
        import("./useGroupStore").then(({ useGroupStore }) => useGroupStore.getState().flushOutbox());
      });

      newSocket.on('disconnect', () => {
        console.log("Socket disconnected - will attempt to reconnect");
      });

      newSocket.on('error', (error) => {
        console.error("Socket error:", error);
      });

      newSocket.on('sessionRevoked', () => {
        get().handleSessionRevoked();
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

// Keep isOffline in sync with the browser/WebView's connectivity status.
// This is a plain network signal (separate from the socket's own connect/
// disconnect events above), so the offline banner reacts immediately when
// it fires. But when checkAuth() failed offline, no socket was ever created
// (connectSocket only runs from checkAuth's success path), so there's
// nothing for socket.io's own reconnection logic to reconnect — recovery
// depends entirely on checkAuth running again.
subscribeOnlineStatus((isOnline) => {
  useAuthStore.setState({ isOffline: !isOnline });
  if (isOnline) {
    useAuthStore.getState().checkAuth();
  }
});

// Belt-and-suspenders: the browser's online/offline events don't reliably
// fire in every WebView for OS-level connectivity toggles (observed on
// Android when network is restored via ADB/system settings rather than the
// user's own airplane-mode switch). While we still think we're offline,
// actively re-probe with the real network request instead of only trusting
// navigator.onLine — self-limiting, since it stops once checkAuth succeeds.
setInterval(() => {
  if (useAuthStore.getState().isOffline) {
    useAuthStore.getState().checkAuth();
  }
}, 10000);

export default useAuthStore
