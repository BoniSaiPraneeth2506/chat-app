// import { useState } from "react";
// import  useAuthStore  from "../store/useAuthStore";

// import { Link } from "react-router-dom";
// import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare } from "lucide-react";

// const LoginPage = () => {
//   const [showPassword, setShowPassword] = useState(false);
//   const [formData, setFormData] = useState({
//     email: "",
//     password: "",
//   });
//   const { login, isLoggingIn } = useAuthStore();

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     login(formData);
//   };

//   return (
//     <div className="grid items-center h-screen lg:grid-cols-1">
//       {/* Left Side - Form */}
//       <div className="flex flex-col items-center justify-center p-6 sm:p-12">
//         <div className="w-full max-w-md space-y-8">
//           {/* Logo */}
//           <div className="mb-8 text-center">
//             <div className="flex flex-col items-center gap-2 group">
//               <div
//                 className="flex items-center justify-center w-12 h-12 transition-colors rounded-xl bg-primary/10 group-hover:bg-primary/20"
//               >
//                 <MessageSquare className="w-6 h-6 text-primary" />
//               </div>
//               <h1 className="mt-2 text-2xl font-bold">Welcome Back</h1>
//               <p className="text-base-content/60">Sign in to your account</p>
//             </div>
//           </div>

//           {/* Form */}
//           <form onSubmit={handleSubmit} className="space-y-6">
//             <div className="form-control">
//               <label className="label">
//                 <span className="font-medium label-text">Email</span>
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//                   <Mail className="w-5 h-5 text-base-content/40" />
//                 </div>
//                 <input
//                   type="email"
//                   className={`input input-bordered w-full pl-10 focus:outline-none focus:ring-0 focus:border-primary`}
//                   placeholder="you@example.com"
//                   value={formData.email}
//                   onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//                 />
//               </div>
//             </div>

//             <div className="form-control">
//               <label className="label">
//                 <span className="font-medium label-text">Password</span>
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//                   <Lock className="w-5 h-5 text-base-content/40" />
//                 </div>
//                 <input
//                   type={showPassword ? "text" : "password"}
//                   className={`input input-bordered w-full pl-10 focus:outline-none focus:ring-0 focus:border-primary `}
//                   placeholder="••••••••"
//                   value={formData.password}
//                   onChange={(e) => setFormData({ ...formData, password: e.target.value })}
//                 />
//                 <button
//                   type="button"
//                   className="absolute inset-y-0 right-0 flex items-center pr-3"
//                   onClick={() => setShowPassword(!showPassword)}
//                 >
//                   {showPassword ? (
//                     <EyeOff className="w-5 h-5 text-base-content/40" />
//                   ) : (
//                     <Eye className="w-5 h-5 text-base-content/40" />
//                   )}
//                 </button>
//               </div>
//             </div>

//             <button type="submit" className="w-full btn btn-primary" disabled={isLoggingIn}>
//               {isLoggingIn ? (
//                 <>
//                   <Loader2 className="w-5 h-5 animate-spin" />
//                   Loading...
//                 </>
//               ) : (
//                 "Sign in"
//               )}
//             </button>
//           </form>

//           <div className="text-center">
//             <p className="text-base-content/60">
//               Don&apos;t have an account?{" "}
//               <Link to="/signup" className="link link-primary">
//                 Create account
//               </Link>
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };
// export default LoginPage;



// import { useState } from "react";
// import  useAuthStore  from "../store/useAuthStore";

// import { Link } from "react-router-dom";
// import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare } from "lucide-react";

// const LoginPage = () => {
//   const [showPassword, setShowPassword] = useState(false);
//   const [formData, setFormData] = useState({
//     email: "",
//     password: "",
//   });
//   const { login, isLoggingIn } = useAuthStore();

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     login(formData);
//   };

  

//   return (
//     <div className="flex items-center justify-center min-h-screen p-6 bg-gray-900">
//       <div className="w-full max-w-md">
//         {/* Header */}
//         <div className="mb-8 text-center">
//           <div className="flex flex-col items-center gap-2 group">
//             <div className="flex items-center justify-center w-12 h-12 transition-colors rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20">
//               <MessageSquare className="w-6 h-6 text-blue-500" />
//             </div>
//             <h1 className="mt-2 text-2xl font-bold text-white">Welcome Back</h1>
//             <p className="text-gray-400">Sign in to your account</p>
//           </div>
//         </div>

//         {/* Form */}
//         <div className="space-y-6">
//           {/* Email Field */}
//           <div>
//             <label className="block mb-2 text-sm font-medium text-gray-300">
//               Email
//             </label>
//             <div className="relative">
//               <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//                 <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
//                   <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
//                   <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
//                 </svg>
//               </div>
//               <input
//                 type="email"
//                 className="w-full py-3 pl-10 pr-3 text-white placeholder-gray-400 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="you@example.com"
//                 value={formData.email}
//                 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//               />
//             </div>
//           </div>

//           {/* Password Field */}
//           <div>
//             <label className="block mb-2 text-sm font-medium text-gray-300">
//               Password
//             </label>
//             <div className="relative">
//               <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//                 <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
//                   <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
//                 </svg>
//               </div>
//               <input
//                 type={showPassword ? "text" : "password"}
//                 className="w-full py-3 pl-10 pr-10 text-white placeholder-gray-400 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="••••••••"
//                 value={formData.password}
//                 onChange={(e) => setFormData({ ...formData, password: e.target.value })}
//               />
//               <button
//                 type="button"
//                 className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-300"
//                 onClick={() => setShowPassword(!showPassword)}
//               >
//                 {showPassword ? (
//                   <EyeOff className="w-5 h-5" />
//                 ) : (
//                   <Eye className="w-5 h-5" />
//                 )}
//               </button>
//             </div>
//           </div>

//           {/* Submit Button */}
//           <button
//             onClick={handleSubmit}
//             disabled={isLoggingIn}
//             className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-600/50"
//           >
//             {isLoggingIn ? (
//               <>
//                 <Loader2 className="w-5 h-5 animate-spin" />
//                 Loading...
//               </>
//             ) : (
//               "Sign in"
//             )}
//           </button>
//         </div>

//          <div className="text-center">
//             <p className="text-base-content/60">
//               Don&apos;t have an account?{" "}
//               <Link to="/signup" className="link link-primary">
//                 Create account
//               </Link>
//             </p>
//           </div>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;


import { useState, useEffect } from "react";
import useAuthStore from "../store/useAuthStore";

import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [view, setView] = useState("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [resetForm, setResetForm] = useState({
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const {
    login,
    isLoggingIn,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    isSendingReset,
    isResettingPassword,
  } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    login(formData);
  };

  // Android has no browser-redirect OAuth flow available (Google blocks it
  // from embedded WebViews); Credential Manager talks to Google natively
  // instead and hands back an ID token verifiable by the same /auth/google
  // endpoint the web GIS button already uses.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
    }
  }, []);

  const handleNativeGoogleLogin = async () => {
    try {
      // email/profile/email_verified are already part of the default ID
      // token — requesting extra `scopes` needs native Activity changes
      // we don't otherwise need, so this stays scope-less on purpose.
      const { result } = await SocialLogin.login({
        provider: "google",
        options: {},
      });
      if (result?.idToken) {
        loginWithGoogle(result.idToken);
      } else {
        toast.error("Google sign-in did not return a token");
      }
    } catch (err) {
      console.error("Native Google sign-in failed:", err);
      toast.error("Google sign-in failed");
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const result = await forgotPassword(formData.email);
    if (result) {
      setResetForm({ otp: result.devOtp || "", newPassword: "", confirmPassword: "" });
      setView("reset");
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    const ok = await resetPassword({
      email: formData.email,
      otp: resetForm.otp,
      newPassword: resetForm.newPassword,
    });
    if (ok) {
      setFormData({ ...formData, password: "" });
      setResetForm({ otp: "", newPassword: "", confirmPassword: "" });
      setView("login");
    }
  };

  const inputClass =
    "w-full py-3 pl-10 pr-3 text-white placeholder-gray-400 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const passwordInputClass =
    "w-full py-3 pl-10 pr-10 text-white placeholder-gray-400 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const primaryBtnClass =
    "flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-600/50";

  return (
    <div className="grid items-center h-screen lg:grid-cols-1">
      {/* Left Side - Form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="flex flex-col items-center gap-2 group">
              <div
                className="flex items-center justify-center w-12 h-12 transition-colors rounded-xl bg-primary/10 group-hover:bg-primary/20"
              >
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h1 className="mt-2 text-2xl font-bold">
                {view === "login" ? "Welcome Back" : view === "forgot" ? "Forgot Password" : "Reset Password"}
              </h1>
              <p className="text-base-content/60">
                {view === "login"
                  ? "Sign in to your account"
                  : view === "forgot"
                    ? "Enter your email to receive a reset code"
                    : "Enter the code and choose a new password"}
              </p>
            </div>
          </div>

          {view === "login" && (
            <>
          {/* Form */}
          <div className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                  </svg>
                </div>
                <input
                  type="email"
                  className="w-full py-3 pl-10 pr-3 text-white placeholder-gray-400 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">
                  Password
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-400 hover:text-blue-300"
                  onClick={() => setView("forgot")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full py-3 pl-10 pr-10 text-white placeholder-gray-400 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoggingIn}
              className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-600/50"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>
            <div className="flex justify-center">
              {Capacitor.isNativePlatform() ? (
                <button
                  type="button"
                  onClick={handleNativeGoogleLogin}
                  className="flex items-center justify-center gap-3 w-[320px] py-2.5 px-4 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </button>
              ) : (
                <GoogleLogin
                  onSuccess={(credentialResponse) => loginWithGoogle(credentialResponse.credential)}
                  onError={() => toast.error("Google sign-in failed")}
                  theme="outline"
                  width="320"
                />
              )}
            </div>
          </div>

          <div className="text-center">
            <p className="text-base-content/60">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="link link-primary">
                Create account
              </Link>
            </p>
          </div>
            </>
          )}

          {view === "forgot" && (
            <>
              <form className="space-y-6" onSubmit={handleForgotSubmit}>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Mail className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      required
                      className={inputClass}
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" disabled={isSendingReset} className={primaryBtnClass}>
                  {isSendingReset ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset code"
                  )}
                </button>
              </form>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-400 hover:text-blue-300"
                  onClick={() => setView("login")}
                >
                  Back to sign in
                </button>
              </div>
            </>
          )}

          {view === "reset" && (
            <>
              <form className="space-y-6" onSubmit={handleResetSubmit}>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Reset code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    className="w-full py-3 px-3 text-white placeholder-gray-400 tracking-[0.3em] text-center transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="000000"
                    value={resetForm.otp}
                    onChange={(e) => setResetForm({ ...resetForm, otp: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    New password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className={passwordInputClass}
                      placeholder="••••••••"
                      value={resetForm.newPassword}
                      onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-300"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">
                    Confirm password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className={inputClass}
                      placeholder="••••••••"
                      value={resetForm.confirmPassword}
                      onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    />
                  </div>
                  {resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword && (
                    <p className="mt-2 text-sm text-red-400">Passwords do not match</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={
                    isResettingPassword ||
                    resetForm.newPassword !== resetForm.confirmPassword ||
                    resetForm.otp.length !== 6
                  }
                  className={primaryBtnClass}
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>
              </form>
              <div className="text-center space-y-2">
                <button
                  type="button"
                  className="text-sm text-blue-400 hover:text-blue-300"
                  onClick={() => setView("forgot")}
                >
                  Resend code
                </button>
                <div>
                  <button
                    type="button"
                    className="text-sm text-base-content/60 hover:text-base-content"
                    onClick={() => setView("login")}
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;



