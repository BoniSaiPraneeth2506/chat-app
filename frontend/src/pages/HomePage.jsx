import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import SideBar from "../components/SideBar";

const HomePage = () => {
  const { selectedUser, setSelectedUser } = useChatStore();

  useEffect(() => {
    if (selectedUser) {
      // Push state to history so back button/gesture closes chat instead of navigating away
      window.history.pushState({ chatOpen: true }, "");

      const handlePopState = (event) => {
        setSelectedUser(null);
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        // If chat was closed via UI action (not popstate), pop the history state to keep it in sync
        if (window.history.state?.chatOpen) {
          window.history.back();
        }
      };
    }
  }, [selectedUser, setSelectedUser]);

  return (
    <div className="h-screen bg-base-200">
      <div className={`flex items-center justify-center w-full h-full px-0 lg:px-[7px] lg:pt-[68px]
        ${selectedUser ? "pt-0" : "pt-16"}
      `}>
        <div className={`bg-base-100 shadow-cl w-full rounded-none lg:rounded-lg max-w-none lg:max-w-6xl transition-all
          ${selectedUser ? "h-screen" : "h-[calc(100vh-4rem)]"}
          lg:h-[calc(100vh-4.5rem)]
        `}>
          <div className="flex h-full overflow-hidden rounded-lg">
            <SideBar/>
            {!selectedUser ? <NoChatSelected/> : <ChatContainer/>}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
