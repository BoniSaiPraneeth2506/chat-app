import React from 'react';

const AuthImagePattern = ({ title = "Welcome Back", subtitle = "Sign in to your account to continue" }) => {
  return (
    <div className="items-center justify-center hidden p-12 lg:flex bg-gradient-to-br from-black via-violet-950 to-gray-900">
      <div className="max-w-md text-center">
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-2xl h-20 w-20 ${
                i % 2 === 0 
                  ? "bg-violet-800/20 animate-pulse" 
                  : "bg-violet-900/30 animate-pulse delay-500"
              } backdrop-blur-sm border border-violet-700/15 shadow-lg`}
            />
          ))}
        </div>
        <h2 className="mb-6 text-3xl font-bold text-transparent bg-gradient-to-r from-white to-gray-300 bg-clip-text">
          {title}
        </h2>
        <p className="text-lg leading-relaxed text-gray-300">
          {subtitle}
        </p>
      </div>
    </div>
  );
};

export default AuthImagePattern;