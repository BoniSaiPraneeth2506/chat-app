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
import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import useAuthStore from './store/useAuthStore'
import { Loader } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { useThemeStore } from './store/useThemeStore'
import { THEME_COLORS } from './constants'

const App = () => {
  const { authUser, checkAuth, isCheckingAuth ,onlineUsers} = useAuthStore();
  const { theme } = useThemeStore()
  
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
      </Routes>
      <Toaster />
    </div>
  )
}

export default App