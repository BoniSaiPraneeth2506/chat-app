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


import { useState } from "react";
import useAuthStore from "../store/useAuthStore";

import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { Capacitor } from "@capacitor/core";

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

            {/* Google's OAuth policy blocks sign-in from embedded WebViews
                (like the Android app's), so this only renders on the web. */}
            {!Capacitor.isNativePlatform() && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-700" />
                  <span className="text-xs text-gray-500">OR</span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(credentialResponse) => loginWithGoogle(credentialResponse.credential)}
                    onError={() => toast.error("Google sign-in failed")}
                    theme="filled_black"
                    width="320"
                  />
                </div>
              </>
            )}
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



