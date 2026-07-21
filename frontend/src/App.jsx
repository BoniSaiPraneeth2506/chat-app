// import React, { useEffect } from 'react'
// import NavBar from './components/NavBar'
// import { Routes,Route, Navigate } from 'react-router-dom'
// import HomePage from './pages/HomePage'
// import LoginPage from './pages/LoginPage'
// import SignUpPage from './pages/SignUpPage'
// import SettingsPage from './pages/SettingsPage'
// import ProfilePage from './pages/ProfilePage'
// import useAuthStore from './store/useAuthStore'
// import { Loader } from 'lucide-react'
// import { Toaster } from 'react-hot-toast'
// import  {useThemeStore}  from './store/useThemeStore'
// const App = () => {
//   const {authUser,checkAuth,isCheckingAuth}=useAuthStore();
//   const {theme}=useThemeStore()
//   useEffect(()=>{
//     checkAuth();
//   },[])
//   console.log(authUser);
//   if(isCheckingAuth && !authUser ){
//      return (
//         <div className="flex items-center justify-center h-screen">
//             <Loader className="w-10 h-10 animate-spin" />
//         </div>
//     );
//   }
  
//   return (
//     <div data-theme={theme}>
//       <NavBar/>
//       <Routes>
//         <Route path='/' element={authUser ? <HomePage/> : <Navigate to='/login'/>}/>
//         <Route path='/login' element={!authUser ? <LoginPage/> : <Navigate to='/'/>}/>
//         <Route path='/signup' element={!authUser?<SignUpPage/> : <Navigate to='/'/> }/>
//         <Route path='/settings' element={<SettingsPage/>}/>
//         <Route path='/profile' element={authUser?<ProfilePage/> : <Navigate to='/login'/>}/>
//       </Routes>
//       <Toaster/>
//     </div>
//   )
// }

// export default App



import React, { useEffect } from 'react'
import NavBar from './components/NavBar'
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import useAuthStore from './store/useAuthStore'
import { useChatStore } from './store/useChatStore'
import { Loader, X, MessageSquare, Phone, Info } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { useThemeStore } from './store/useThemeStore'
import { THEME_COLORS } from './constants'

const ChatRedirectHandler = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { setSelectedUser, users, getUsers } = useChatStore();

  useEffect(() => {
    const performRedirect = async () => {
      let currentUsers = users;
      if (!currentUsers || currentUsers.length === 0) {
        await getUsers();
        currentUsers = useChatStore.getState().users;
      }
      
      const foundUser = currentUsers.find((u) => u._id === userId);
      if (foundUser) {
        setSelectedUser(foundUser);
      } else {
        setSelectedUser({ _id: userId, fullName: "Chat Partner" });
      }
      navigate("/");
    };

    performRedirect();
  }, [userId, users, setSelectedUser, getUsers, navigate]);

  return (
    <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--color-base-100)' }}>
      <span className="loading loading-spinner loading-lg" style={{ color: 'var(--color-primary)' }}></span>
    </div>
  );
};

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, onlineUsers, socket } = useAuthStore();
  const { theme } = useThemeStore()
  const { 
    subscribeToMessages, 
    unsubscribeFromMessages,
    profilePreviewUser,
    setProfilePreviewUser,
    lightboxImage,
    setLightboxImage,
    setSelectedUser,
    startCall,
    setIsRecipientProfileOpen
  } = useChatStore();
  
  console.log("onlineUsers",onlineUsers)
  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_COLORS[theme];
    
    if (colors) {
      root.style.setProperty('--color-primary', colors.primary);
      root.style.setProperty('--color-secondary', colors.secondary);
      root.style.setProperty('--color-accent', colors.accent);
      root.style.setProperty('--color-neutral', colors.neutral);
      root.style.setProperty('--color-base-100', colors.base100);
      root.style.setProperty('--color-base-200', colors.base200);
      root.style.setProperty('--color-base-300', colors.base300);
    }
  }, [theme]);

  useEffect(() => {
    checkAuth();
  }, [])

  useEffect(() => {
    if (authUser && socket) {
      subscribeToMessages();
      return () => unsubscribeFromMessages();
    }
  }, [authUser, socket, subscribeToMessages, unsubscribeFromMessages]);

  console.log(authUser);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen" 
           style={{ backgroundColor: 'var(--color-base-100)' }}>
        <Loader className="w-10 h-10 animate-spin" 
                style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: 'var(--color-base-100)', 
      color: 'var(--color-neutral)',
      minHeight: '100vh' 
    }}>
      <NavBar />
      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <Navigate to='/login' />} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to='/' />} />
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to='/' />} />
        <Route path='/settings' element={<SettingsPage />} />
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to='/login' />} />
        <Route path='/chat-with/:userId' element={authUser ? <ChatRedirectHandler /> : <Navigate to='/login' />} />
        <Route path='*' element={<Navigate to='/' />} />
      </Routes>
      <Toaster />

      {/* WhatsApp-Style Profile Preview Modal */}
      {profilePreviewUser && (
        <div 
          onClick={() => setProfilePreviewUser(null)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-[1px] p-4 select-none animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[250px] bg-base-100 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-base-300 relative"
          >
            {/* Header: User name overlay */}
            <div className="absolute top-0 inset-x-0 bg-black/35 backdrop-blur-[0.5px] px-3 py-2 flex items-center justify-between z-10">
              <span className="text-white text-xs font-semibold truncate max-w-[80%]">
                {profilePreviewUser.fullName}
              </span>
              <button 
                onClick={() => setProfilePreviewUser(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Profile Picture (Square) */}
            <div 
              onClick={() => {
                setLightboxImage(profilePreviewUser.profilePic || "/avatar.png");
                setProfilePreviewUser(null);
              }}
              className="w-full aspect-square cursor-zoom-in relative group"
            >
              <img 
                src={profilePreviewUser.profilePic || "/avatar.png"} 
                alt={profilePreviewUser.fullName} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="text-white/0 group-hover:text-white/90 text-[11px] font-medium bg-black/40 px-2 py-0.5 rounded-full transition-all">
                  Tap to expand
                </span>
              </div>
            </div>

            {/* Action Bar Footer */}
            <div className="flex items-center justify-around py-2.5 bg-base-100 border-t border-base-200">
              <button
                onClick={() => {
                  setSelectedUser(profilePreviewUser);
                  setProfilePreviewUser(null);
                }}
                className="p-2 hover:bg-base-200 rounded-full transition-all text-primary"
                title="Send Message"
              >
                <MessageSquare size={16} />
              </button>
              <button
                onClick={() => {
                  setSelectedUser(profilePreviewUser);
                  startCall("voice");
                  setProfilePreviewUser(null);
                }}
                className="p-2 hover:bg-base-200 rounded-full transition-all text-primary"
                title="Voice Call"
              >
                <Phone size={16} />
              </button>
              <button
                onClick={() => {
                  setSelectedUser(profilePreviewUser);
                  setIsRecipientProfileOpen(true);
                  setProfilePreviewUser(null);
                }}
                className="p-2 hover:bg-base-200 rounded-full transition-all text-primary"
                title="View Info"
              >
                <Info size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Lightbox Modal to see the full profile picture */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
        >
          {/* Close button top right */}
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-full text-white/90 hover:text-white transition-all shadow-md z-30"
          >
            <X size={20} />
          </button>
          
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-[85vh] aspect-square overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <img 
              src={lightboxImage} 
              alt="Profile Pic Expanded" 
              className="w-full h-full object-contain max-h-[85vh]"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App