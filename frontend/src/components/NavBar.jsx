import { useState } from "react";
import { Link } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { LogOut, MessageSquare, Settings, User } from "lucide-react";

const Navbar = () => {
  const { logOut, authUser } = useAuthStore();
  const { selectedUser } = useChatStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    logOut();
  };

  return (
    <>
      <header
        className={`fixed top-0 z-40 w-full bg-base-100 backdrop-blur-lg bg-base-100/80
          ${selectedUser ? "hidden lg:block" : "block"}
        `}
      >
        <div className="container h-16 px-4 mx-auto">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
                <div className="flex items-center justify-center rounded-lg size-9 bg-primary/10">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-lg font-bold">Chatty</h1>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={"/settings"}
                className={`
                btn btn-sm gap-2 transition-colors
                
                `}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>

              {authUser && (
                <>
                  <Link to={"/profile"} className={`btn btn-sm gap-2`}>
                    <User className="size-5" />
                    <span className="hidden sm:inline">Profile</span>
                  </Link>

                  <button className="flex items-center gap-2 hover:text-red-500 transition-colors" onClick={handleLogoutClick}>
                    <LogOut className="size-5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Themed Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-base-100 border border-base-300 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-left mx-4">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <LogOut className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-base-content">Confirm Logout</h3>
            </div>
            <p className="text-sm text-base-content/75 mb-6">
              Are you sure you want to log out of your session? You will need to sign in again to access your messages.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)} 
                className="px-4 py-2 rounded-lg bg-base-200 hover:bg-base-300 text-base-content text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogoutConfirm} 
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Yes, Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Navbar;