import  {useChatStore}  from "../store/useChatStore";


import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import SideBar from "../components/SideBar";



const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center px-[7px] pt-[68px]">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-4.5rem)]">
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