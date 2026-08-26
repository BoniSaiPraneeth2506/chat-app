import {create } from 'zustand'
import axiosInstance from '../lib/axios.js'
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { isNetworkError, subscribeOnlineStatus } from '../lib/network.js';
import { deleteUserDb } from '../lib/db.js';
import { rememberAccount, forgetAccount, getAccountToken, listAccounts } from '../lib/accounts.js';

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

/**
 * Clears chat/group state that belongs to whoever was signed in before.
 *
 * The Dexie caches are keyed per user id and are deliberately left alone —
 * each account keeps its own offline history. This only drops the in-memory
 * copy, so one account's conversations can never paint inside another's
 * session while the new data loads.
 */
const resetPerAccountState=async()=>{
    const [{useChatStore},{useGroupStore}]=await Promise.all([
        import("./useChatStore"),
        import("./useGroupStore"),
    ]);
    // lastReadTimestamps is included because read ticks are now held in memory
    // rather than localStorage; without clearing it, one account's read state
    // would bleed into the next after a switch.
    useChatStore.setState({messages:[],users:[],selectedUser:null,latestMessages:{},unreadCounts:{},lastReadTimestamps:{}});
    useGroupStore.setState({groups:[],selectedGroup:null,groupMessages:[],unreadGroupCounts:{},mentionedGroups:{}});
};

/**
 * Loads the sidebar for whoever is signed in now.
 *
 * Switching accounts can't rely on a component effect to refetch: SideBar's
 * getUsers effect is keyed on [getUsers, searchTerm], and neither changes when
 * the identity does — so after the state reset the sidebar would sit empty
 * until a full page reload, making a successful switch look like nothing
 * happened.
 */
const hydrateForCurrentUser=async()=>{
    const [{useChatStore},{useGroupStore}]=await Promise.all([
        import("./useChatStore"),
        import("./useGroupStore"),
    ]);
    await Promise.all([
        useChatStore.getState().getUsers(),
        useGroupStore.getState().getGroups(),
    ]);
};

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
        if(authUser){ deleteUserDb(authUser._id); forgetAccount(authUser._id); }
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
           rememberAccount(res.data, res.data.token);
           toast.success("Account created successfully")
           get().connectSocket()
        }catch(err){
          toast.error(friendlyAuthError(err, "Something went wrong"));
        }finally{
            set({isSigningUp:false})
        }
    },
    deleteAccount:async({password,confirm})=>{
        const currentUser=get().authUser;
        try{
            await axiosInstance.delete('/auth/account',{data:{password,confirm}});
            // Same teardown as logout — the account no longer exists, so any
            // cached conversation on this device is orphaned data.
            localStorage.removeItem("token");
            persistAuthSnapshot(null);
            if(currentUser){ deleteUserDb(currentUser._id); forgetAccount(currentUser._id); }
            get().disconnectSocket();
            set({authUser:null,sessions:[],onlineUsers:[],savedAccounts:listAccounts()});
            toast.success("Your account has been deleted");
            return true;
        }catch(err){
            toast.error(friendlyAuthError(err,"Could not delete the account"));
            return false;
        }
    },
    savedAccounts: listAccounts(),
    // The account being switched to, so the UI can show a deliberate
    // transition instead of a blank sidebar while the new session loads.
    switchingTo: null,
    refreshSavedAccounts:()=>set({savedAccounts:listAccounts()}),

    /**
     * Switches to another account already signed in on this device.
     *
     * The per-account Dexie cache is keyed by user id, so nothing is deleted
     * here — each account keeps its own cached conversations and the one being
     * left behind is untouched. In-memory chat state is cleared instead, so a
     * previous account's messages can never bleed into the new session.
     */
    switchAccount:async(userId)=>{
        const token=getAccountToken(userId);
        if(!token){
            toast.error("Please sign in to that account again");
            return false;
        }
        if(get().authUser?._id===userId) return true;

        const target=get().savedAccounts.find((a)=>a._id===userId) || null;
        const previous=get().authUser;
        set({switchingTo:target});

        // Deliberately does NOT null authUser or raise isCheckingAuth.
        //
        // App renders a full-screen loader whenever `isCheckingAuth && !authUser`,
        // so clearing the user mid-switch tore the whole tree down and put a
        // spinner over the transition — the blink. Keeping the previous user in
        // place means the layout never unmounts; the overlay covers the swap and
        // authUser flips exactly once, when the new session is confirmed.
        const startedAt=Date.now();
        get().disconnectSocket();
        localStorage.setItem("token", token);

        try{
            const res=await axiosInstance.get('/auth/check');

            await resetPerAccountState();
            set({authUser:res.data,onlineUsers:[],sessions:[],isOffline:false});
            persistAuthSnapshot(res.data);
            get().connectSocket();
            await hydrateForCurrentUser();

            // A switch that resolves in 80ms reads as a flicker rather than a
            // transition, so hold the overlay briefly for a steady handoff.
            const elapsed=Date.now()-startedAt;
            if(elapsed<450) await new Promise((r)=>setTimeout(r,450-elapsed));

            set({switchingTo:null});
            return true;
        }catch(err){
            // Put the previous session back so a failed switch leaves the app
            // exactly where it was rather than half-signed-out.
            const previousToken=previous ? getAccountToken(previous._id) : null;
            if(previousToken) localStorage.setItem("token", previousToken);
            else localStorage.removeItem("token");

            if(!isNetworkError(err)){
                // The stored token was rejected — most likely revoked from
                // another device, so drop the dead entry.
                forgetAccount(userId);
                set({savedAccounts:listAccounts()});
                toast.error("That session expired — please sign in again");
            }else{
                toast.error("You're offline — can't switch accounts right now");
            }

            set({switchingTo:null});
            if(previous) get().connectSocket();
            return false;
        }
    },

    forgetSavedAccount:(userId)=>{
        forgetAccount(userId);
        set({savedAccounts:listAccounts()});
    },

    // Shown after logging out when other saved accounts remain and there is
    // more than one to choose between.
    accountChooserOpen:false,
    closeAccountChooser:()=>set({accountChooserOpen:false}),

    logOut:async()=>{
        // Own account's cached messages must not survive a logout on a
        // shared device, or the next person to log in on it would see them.
        const currentUser=get().authUser;

        const finishLogout=async()=>{
            localStorage.removeItem("token");
            persistAuthSnapshot(null);
            if(currentUser){ deleteUserDb(currentUser._id); forgetAccount(currentUser._id); }
            get().disconnectSocket();
            await resetPerAccountState();

            const remaining=listAccounts();
            set({authUser:null,onlineUsers:[],sessions:[],savedAccounts:remaining});

            // Signing out of one account shouldn't dump you at a login screen
            // when this device still has other sessions. Always ask which to
            // continue as — even with a single one left, auto-signing-in would
            // take the choice away from someone who may have meant to leave.
            if(remaining.length>0){
                set({accountChooserOpen:true});
            }
        };

        try{
             await axiosInstance.post('/auth/logout');
             await finishLogout();
             toast.success("Logged out");
        }catch(err){
             // The session is gone locally either way; only the server-side
             // revoke failed, so still hand off to a remaining account.
             await finishLogout();
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
           // Adding a second account signs in over an existing session, so the
           // previous account's chats must not survive into this one.
           const switchedIdentity = Boolean(get().authUser) && get().authUser._id !== res.data._id;
           if (switchedIdentity) await resetPerAccountState();
           set({authUser:res.data});
           persistAuthSnapshot(res.data);
           rememberAccount(res.data, res.data.token);
           toast.success("Logged in successfully")
           get().connectSocket()
           if (switchedIdentity) await hydrateForCurrentUser();
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
           const switchedIdentity = Boolean(get().authUser) && get().authUser._id !== res.data._id;
           if (switchedIdentity) await resetPerAccountState();
           set({authUser:res.data});
           persistAuthSnapshot(res.data);
           rememberAccount(res.data, res.data.token);
           toast.success("Logged in successfully")
           get().connectSocket()
           if (switchedIdentity) await hydrateForCurrentUser();
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
      // Sync updated name/pic into the saved-accounts switcher so the
      // account picker reflects changes without a re-login.
      rememberAccount(res.data, localStorage.getItem("token"));
      get().refreshSavedAccounts();
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
