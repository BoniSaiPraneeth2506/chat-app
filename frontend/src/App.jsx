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



import React, { useEffect, useState } from 'react'
import NavBar from './components/NavBar'
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import LinkedDevicesPage from './pages/LinkedDevicesPage'
import BlockedUsersPage from './pages/BlockedUsersPage'
import JoinGroupPage from './pages/JoinGroupPage'
import useAuthStore from './store/useAuthStore'
import { useChatStore } from './store/useChatStore'
import { setScreenSecure } from './lib/secureScreen'
import { setBadgeCount, clearBadge } from './lib/badge'
import { Loader, X, MessageSquare, Phone, Info } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useThemeStore } from './store/useThemeStore'
import { THEME_COLORS } from './constants'
import CreateGroupModal from './components/CreateGroupModal'
import GroupDetailsModal from './components/GroupDetailsModal'
import GroupWelcomeSheet from './components/GroupWelcomeSheet'
import AboutPage from './pages/AboutPage'
import GroupCallModal from './components/GroupCallModal'
import CallModal from './components/CallModal'
import { useGroupStore } from './store/useGroupStore'
import { App as CapacitorApp } from '@capacitor/app'
import OfflineBanner from './components/OfflineBanner'

const PENDING_CHAT_KEY = "pendingChatUserId";

/**
 * The login screen, reachable even while signed in.
 *
 * Normally /login bounces an authenticated user home. That made "Add another
 * account" a dead click: the switcher sends you to /login precisely *because*
 * you are already signed in. `?add=1` is the explicit opt-out — the existing
 * session stays saved in the switcher while a second one is signed into.
 */
const LoginRoute = ({ authUser }) => {
  const location = useLocation();
  const isAddingAccount = new URLSearchParams(location.search).get("add") === "1";

  // Who was signed in when this screen opened. In add mode the guard below
  // can't simply key off "is anyone signed in" — someone always is — so it
  // watches for the identity *changing* instead. The moment a different
  // account signs in, the screen hands off to it, the way switching does.
  const startedAsRef = React.useRef(authUser?._id ?? null);

  if (authUser && !isAddingAccount) return <Navigate to="/" replace />;
  if (isAddingAccount && authUser?._id && authUser._id !== startedAsRef.current) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage isAddingAccount={isAddingAccount} />;
};

const ChatRedirectHandler = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const hasRunRef = React.useRef(false);

  // Opening a QR deep link must land directly in that user's chat, so the users
  // list is always refreshed before selecting: a freshly signed-up contact is
  // otherwise missing from the cached sidebar list.
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const performRedirect = async () => {
      const { setSelectedUser, getUsers } = useChatStore.getState();
      const authUser = useAuthStore.getState().authUser;

      if (authUser?._id === userId) {
        toast("That's your own chat link");
        navigate("/", { replace: true });
        return;
      }

      await getUsers();
      const foundUser = useChatStore.getState().users?.find((u) => u._id === userId);

      if (foundUser) {
        setSelectedUser(foundUser);
      } else {
        toast.error("Could not find that user");
        navigate("/", { replace: true });
        return;
      }
      navigate("/", { replace: true });
    };

    performRedirect();
  }, [userId, navigate]);

  return (
    <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--color-base-100)' }}>
      <span className="loading loading-spinner loading-lg" style={{ color: 'var(--color-primary)' }}></span>
    </div>
  );
};

// A scanned QR link opened while logged out remembers the target so the chat
// opens right after signing in instead of dropping the user on the home page.
const PendingChatRedirect = () => {
  const { userId } = useParams();
  useEffect(() => {
    if (userId) sessionStorage.setItem(PENDING_CHAT_KEY, userId);
  }, [userId]);
  return <Navigate to='/login' replace />;
};

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, onlineUsers, socket, switchingTo,
          accountChooserOpen, closeAccountChooser, savedAccounts, switchAccount } = useAuthStore();
  const { theme } = useThemeStore()
  const { getGroups, subscribeToGroupEvents, unsubscribeFromGroupEvents, selectedGroup, unreadGroupCounts } = useGroupStore();

  // Groups whose welcome sheet has been dismissed in this session. The server
  // is the real record (welcomeSeenBy); this only stops the sheet reappearing in
  // the instant before that write is reflected locally.
  const [welcomeDismissed, setWelcomeDismissed] = useState([]);
  const { 
    subscribeToMessages, 
    unsubscribeFromMessages,
    profilePreviewUser,
    setProfilePreviewUser,
    unreadCounts,
    lightboxImage,
    lightboxSecure,
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

  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = React.useRef(location);
  locationRef.current = location;

  // Capacitor's WebView back button only knows real page loads, not React
  // Router's client-side history, so without this it falls straight through
  // to exiting the app from any non-root screen. An open chat/group doesn't
  // change the route (HomePage tracks it as in-page state with its own
  // pushState/popstate pair), so route-only routing here would exit the app
  // straight from an open chat instead of closing it first.
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      // An open sheet is the topmost thing on screen, so back must dismiss it
      // first. Without this, pressing back while creating a group exits the
      // app outright — the route is still "/" and no chat is open.
      const groupState = useGroupStore.getState();
      if (groupState.isCreateGroupModalOpen) {
        groupState.setIsCreateGroupModalOpen(false);
        return;
      }
      if (groupState.isGroupDetailsModalOpen) {
        groupState.setIsGroupDetailsModalOpen(false);
        return;
      }

      const hasActiveChat = !!(useChatStore.getState().selectedUser || useGroupStore.getState().selectedGroup);
      if (locationRef.current.pathname !== '/') {
        navigate(-1);
      } else if (hasActiveChat) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => { listenerPromise.then((h) => h.remove()); };
  }, [navigate]);

  useEffect(() => {
    if (!authUser) return;
    const pendingChatUserId = sessionStorage.getItem(PENDING_CHAT_KEY);
    if (!pendingChatUserId) return;
    sessionStorage.removeItem(PENDING_CHAT_KEY);
    navigate(`/chat-with/${pendingChatUserId}`, { replace: true });
  }, [authUser, navigate]);

  useEffect(() => {
    if (authUser && socket) {
      subscribeToMessages();
      // Ensure group state and socket listeners are initialized globally
      getGroups();
      subscribeToGroupEvents();
      return () => {
        unsubscribeFromMessages();
        unsubscribeFromGroupEvents();
      };
    }
  }, [authUser, socket, subscribeToMessages, unsubscribeFromMessages]);

  // Global keyboard shortcuts (desktop only)
  useEffect(() => {
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isMobile) return;
    const onKey = (e) => {
      // Ctrl/Cmd+K -> focus global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const el = document.querySelector('#global-search') || document.getElementById('message-input');
        el?.focus();
      }
      // Ctrl/Cmd+Enter -> send message if input focused
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const input = document.getElementById('message-input');
        if (document.activeElement === input) {
          e.preventDefault();
          input.form?.requestSubmit?.();
        }
      }
      if (e.key === '/') {
        const search = document.querySelector('#global-search');
        if (search) { e.preventDefault(); search.focus(); }
      }
      if (e.key === 'Escape') {
        // close any open modal by dispatching a click on overlay close buttons
        const modalClose = document.querySelector('[data-modal-close]');
        modalClose?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  console.log(authUser);

  // FLAG_SECURE is held only while view-once media is open, so ordinary
  // screenshots keep working everywhere else. The cleanup matters: unmounting
  // with the lightbox open would otherwise leave the flag on and silently break
  // screenshots for the rest of the session.
  useEffect(() => {
    const secure = Boolean(lightboxImage && lightboxSecure);
    setScreenSecure(secure);
    return () => {
      if (secure) setScreenSecure(false);
    };
  }, [lightboxImage, lightboxSecure]);

  // A group qualifies when it has something to show and this member is not yet
  // recorded as having seen it.
  const welcomeGroup =
    authUser &&
    selectedGroup &&
    (selectedGroup.welcomeMessage || selectedGroup.rules) &&
    !(selectedGroup.welcomeSeenBy || []).some((id) => (id?._id || id) === authUser._id) &&
    !welcomeDismissed.includes(selectedGroup._id)
      ? selectedGroup
      : null;

  // Launcher badge. Driven off the same counters the sidebar badges use, so the
  // icon and the app can never disagree, and it updates the instant a message
  // arrives or a chat is opened — the socket already keeps those numbers live, so
  // nothing polls.
  //
  // The limit worth knowing: this only tracks while the app is running. Once
  // Android kills the process nothing updates the count until next launch, which
  // is precisely what push notifications solve and why the real apps use them.
  const totalUnread =
    Object.values(unreadCounts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0) +
    Object.values(unreadGroupCounts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);

  useEffect(() => {
    if (!authUser) {
      clearBadge();
      return;
    }
    setBadgeCount(totalUnread);
  }, [totalUnread, authUser]);

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
        <Route path='/login' element={<LoginRoute authUser={authUser} />} />
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to='/' />} />
        <Route path='/settings' element={authUser ? <SettingsPage /> : <Navigate to='/login' />} />
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to='/login' />} />
        <Route path='/linked-devices' element={authUser ? <LinkedDevicesPage /> : <Navigate to='/login' />} />
        <Route path='/blocked' element={authUser ? <BlockedUsersPage /> : <Navigate to='/login' />} />
        <Route path='/about' element={<AboutPage />} />
        <Route path='/join/:code' element={authUser ? <JoinGroupPage /> : <Navigate to='/login' />} />
        <Route path='/chat-with/:userId' element={authUser ? <ChatRedirectHandler /> : <PendingChatRedirect />} />
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
            className="relative max-w-full max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* No forced aspect ratio. This started life as a profile-picture
                viewer, where square was fine, but it now opens chat photos too —
                and aspect-square letterboxed every portrait and landscape shot
                into a square instead of using the screen. */}
            <img
              src={lightboxImage}
              alt="Expanded"
              className="block max-w-full max-h-[85vh] w-auto h-auto object-contain"
            />
          </div>
        </div>
      )}
      {/* After logging out with several accounts still saved on this device,
          pick which one to continue as rather than defaulting to a login form. */}
      {accountChooserOpen && !authUser && (
        <div className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm cg-fade sm:p-4">
          <div className="w-full sm:max-w-sm bg-base-100 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden cg-sheet sm:cg-dialog">
            <div className="px-6 pt-6 pb-3 text-center">
              <h3 className="text-lg font-semibold text-base-content">Continue as</h3>
              <p className="mt-1 text-sm text-base-content/50">
                {savedAccounts.length === 1
                  ? "This account is still signed in on this device."
                  : "These accounts are still signed in on this device."}
              </p>
            </div>

            <div className="px-3 pb-2 max-h-[50dvh] overflow-y-auto">
              {savedAccounts.map((acc) => (
                <button
                  key={acc._id}
                  type="button"
                  onClick={async () => {
                    closeAccountChooser();
                    await switchAccount(acc._id);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-base-200 active:bg-base-300 transition-colors text-left"
                >
                  <img
                    src={acc.profilePic || "/avatar.png"}
                    alt=""
                    className="object-cover rounded-full size-11 flex-shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-base-content truncate">
                      {acc.fullName}
                    </span>
                    <span className="block text-xs text-base-content/45 truncate">{acc.email}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
              <button
                type="button"
                onClick={() => {
                  closeAccountChooser();
                  navigate("/login", { replace: true });
                }}
                className="w-full h-12 rounded-2xl bg-base-300/70 hover:bg-base-300 text-[15px] font-medium text-base-content active:scale-[0.98] transition-all"
              >
                Use another account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account switch transition.
          Without it the screen briefly empties — state is cleared before the
          new session's data arrives — which reads as a glitch rather than a
          deliberate switch. Showing who you're moving to makes the wait feel
          intentional and confirms the right account was picked. */}
      {switchingTo && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-base-100/95 backdrop-blur-sm cg-fade">
          <img
            src={switchingTo.profilePic || "/avatar.png"}
            alt=""
            className="object-cover rounded-full size-20 ring-4 ring-primary/25 shadow-xl cg-switch"
          />
          <div className="text-center cg-switch">
            <p className="text-[15px] font-semibold text-base-content">{switchingTo.fullName}</p>
            <p className="mt-0.5 text-xs text-base-content/45">Switching account…</p>
          </div>
          <span className="loading loading-dots loading-sm text-primary" />
        </div>
      )}

      <CallModal />
      <CreateGroupModal />
      <GroupDetailsModal />

      {/* Welcome/rules, shown once per member per group. Rendered here rather
          than inside the chat so it survives the chat remounting, and only when
          the group actually has something to show. */}
      {welcomeGroup && (
        <GroupWelcomeSheet
          group={welcomeGroup}
          onClose={() => setWelcomeDismissed((prev) => [...prev, welcomeGroup._id])}
        />
      )}
      <GroupCallModal />
      <OfflineBanner />
    </div>
  );
};

export default App