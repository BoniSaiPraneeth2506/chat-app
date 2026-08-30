import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useChannelStore } from "../store/useChannelStore";
import { useUpdatesStore } from "../store/useUpdatesStore";
import { useIsDesktop } from "../hooks/useIsDesktop";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import ChannelFeed from "../components/ChannelFeed";
import ChannelInfo from "../components/ChannelInfo";
import SideBar from "../components/SideBar";

const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 420;

const HomePage = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { selectedGroup, setSelectedGroup } = useGroupStore();
  const isChannelFeedOpen = useChannelStore((s) => s.isChannelFeedOpen);
  const isChannelInfoOpen = useChannelStore((s) => s.isChannelInfoOpen);
  const activeTab = useUpdatesStore((s) => s.activeTab);
  const popstateClosedRef = useRef(false);

  const hasActiveChat = selectedUser || selectedGroup;

  // On desktop, an open channel is shown in the right panel (like a chat),
  // while the channel list stays in the sidebar. Only when on the Channels tab.
  const channelScreenOpen =
    activeTab === "channels" && (isChannelFeedOpen || isChannelInfoOpen);

  const isDesktop = useIsDesktop();

  // Full-screen edge-to-edge when a chat is open, or when a channel is open on
  // mobile (channel feeds are full-screen there, with the top app bar and the
  // bottom tab bar hidden).
  const isFullScreen = hasActiveChat || (!isDesktop && channelScreenOpen);

  // Resizable sidebar state — desktop only
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  const onMouseDown = useCallback(
    (e) => {
      isDraggingRef.current = true;
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    },
    [sidebarWidth]
  );

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, startWidthRef.current + delta)
      );
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Back button / history management
  useEffect(() => {
    if (hasActiveChat) {
      window.history.pushState({ chatOpen: true }, "");
      const handlePopState = () => {
        popstateClosedRef.current = true;
        setSelectedUser(null);
        setSelectedGroup(null);
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    } else {
      if (!popstateClosedRef.current && window.history.state?.chatOpen) {
        window.history.back();
      }
      popstateClosedRef.current = false;
    }
  }, [hasActiveChat, setSelectedUser, setSelectedGroup]);

  return (
    <div className="h-screen bg-base-200">
      <div
        className={`flex items-center justify-center w-full h-full px-0 lg:px-4 lg:pt-[68px]
          ${isFullScreen ? "pt-0" : "pt-16"}
        `}
      >
        <div
          className={`bg-base-100 shadow-cl w-full rounded-none lg:rounded-lg
            ${isFullScreen ? "h-screen" : "h-[calc(100vh-4rem)]"}
            lg:h-[calc(100vh-4.5rem)]
          `}
        >
          <div className="flex h-full overflow-hidden rounded-lg">

            {/* ── Sidebar ── renders ONCE; hides on mobile when chat is open */}
            <div
              className={`h-full flex-shrink-0 min-w-0 overflow-hidden ${hasActiveChat ? "hidden lg:block" : ""}`}
              style={isDesktop ? { width: sidebarWidth } : { width: "100%" }}
            >
              <SideBar />
            </div>

            {/* ── Drag handle / Divider (desktop only) ── */}
            {isDesktop && (
              <div
                onMouseDown={onMouseDown}
                className={`group relative w-[1px] flex-shrink-0 z-20 cursor-col-resize select-none transition-colors ${
                  isDragging ? "bg-primary" : "bg-base-300 hover:bg-primary/70"
                }`}
                title="Drag to resize sidebar"
              >
                {/* 12px wide invisible hit area centered on divider line */}
                <div className="absolute inset-y-0 -left-1.5 -right-1.5 w-3 cursor-col-resize z-20" />
              </div>
            )}

            {/* ── Chat area: desktop always, mobile only when chat is selected.
                   On desktop an open channel fills this panel like a chat. ── */}
            {(isDesktop || hasActiveChat) && (
              <div className="flex flex-1 h-full min-w-0 overflow-hidden">
                {isDesktop && channelScreenOpen ? (
                  isChannelInfoOpen ? <ChannelInfo /> : <ChannelFeed />
                ) : !hasActiveChat ? (
                  <NoChatSelected />
                ) : (
                  <ChatContainer />
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
