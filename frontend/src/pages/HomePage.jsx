import  {useChatStore}  from "../store/useChatStore";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import SideBar from "../components/SideBar";



const HomePage = () => {
  const { selectedUser } = useChatStore();

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
