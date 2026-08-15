import { Link } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { MessageSquare, Settings, User, Laptop } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";

const Navbar = () => {
  const { authUser } = useAuthStore();
  const { selectedUser } = useChatStore();
  const { selectedGroup } = useGroupStore();

  return (
    <header
      className={`fixed top-0 z-40 w-full bg-base-100 backdrop-blur-lg bg-base-100/80
        ${selectedUser || selectedGroup ? "hidden lg:block" : "block"}
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

          {authUser && (
            <div className="dropdown dropdown-bottom dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="flex items-center justify-center rounded-full overflow-hidden size-9 border border-base-300 hover:opacity-80 transition-opacity cursor-pointer"
                title={authUser.fullName}
              >
                {authUser.profilePic ? (
                  <img src={authUser.profilePic} alt={authUser.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-primary/10 text-primary">
                    <User size={18} />
                  </div>
                )}
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-2xl w-52 text-sm text-base-content mt-1 space-y-1"
              >
                <li>
                  <Link to="/profile" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <User size={16} />
                    Profile
                  </Link>
                </li>
                <li>
                  <Link to="/settings" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <Settings size={16} />
                    Settings
                  </Link>
                </li>
                <li>
                  <Link to="/linked-devices" onClick={() => document.activeElement.blur()} className="flex items-center gap-2 rounded-xl">
                    <Laptop size={16} />
                    Linked Devices
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default Navbar;
