import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import SideBar from "../components/SideBar";

const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 420;

const HomePage = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { selectedGroup, setSelectedGroup } = useGroupStore();
  const popstateClosedRef = useRef(false);

  const hasActiveChat = selectedUser || selectedGroup;

  // Track whether we're on a large screen (lg = 1024px+)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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
          ${hasActiveChat ? "pt-0" : "pt-16"}
        `}
      >
        <div
          className={`bg-base-100 shadow-cl w-full rounded-none lg:rounded-lg
            ${hasActiveChat ? "h-screen" : "h-[calc(100vh-4rem)]"}
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

            {/* ── Chat area: desktop always, mobile only when chat is selected ── */}
            {(isDesktop || hasActiveChat) && (
              <div className="flex flex-1 h-full min-w-0 overflow-hidden">
                {!hasActiveChat ? <NoChatSelected /> : <ChatContainer />}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
