import { WifiOff } from "lucide-react";
import useAuthStore from "../store/useAuthStore";

// A small floating status pill, not a layout banner — it must never push or
// overlap the existing fixed header/chat-header/message-input, so it only
// ever affects its own fixed position, nothing else on the page.
const OfflineBanner = () => {
  const { isOffline, authUser } = useAuthStore();
  if (!isOffline || !authUser) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div className="flex items-center gap-2 bg-zinc-900/90 text-white text-xs font-medium py-1.5 px-3 rounded-full shadow-lg select-none">
        <WifiOff size={13} className="flex-shrink-0" />
        <span>Offline — showing your last synced chats</span>
      </div>
    </div>
  );
};

export default OfflineBanner;
