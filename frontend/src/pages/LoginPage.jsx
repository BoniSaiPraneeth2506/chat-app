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


import { useState } from "react";
import useAuthStore from "../store/useAuthStore";

import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare } from "lucide-react";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const { login, isLoggingIn } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="grid items-center h-screen lg:grid-cols-1 mb-2">
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
              <h1 className="mt-2 text-2xl font-bold">Welcome Back</h1>
              <p className="text-base-content/60">Sign in to your account</p>
            </div>
          </div>

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
              <label className="block mb-2 text-sm font-medium text-gray-300">
                Password
              </label>
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
          </div>

          <div className="text-center">
            <p className="text-base-content/60">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="link link-primary">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

