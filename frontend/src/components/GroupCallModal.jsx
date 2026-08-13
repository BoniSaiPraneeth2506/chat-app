import { useEffect, useRef, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Users } from "lucide-react";

const GroupCallModal = () => {
  const {
    isGroupCallActive,
    activeGroupCall,
    groupLocalStream,
    groupRemoteStreams,
    leaveGroupCall,
    startOrJoinGroupCall,
  } = useGroupStore();

  const localVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && groupLocalStream) {
      localVideoRef.current.srcObject = groupLocalStream;
    }
  }, [groupLocalStream, isGroupCallActive]);

  if (!isGroupCallActive || !activeGroupCall) return null;

  const toggleMute = () => {
    if (groupLocalStream) {
      groupLocalStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (groupLocalStream) {
      groupLocalStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const remoteSocketIds = Object.keys(groupRemoteStreams);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md text-white select-none">
      <div className="relative flex flex-col items-center justify-between w-full h-full max-w-4xl p-6 sm:h-[650px] sm:rounded-2xl sm:border sm:border-zinc-800 bg-zinc-950 shadow-2xl">
        
        {/* Top Title */}
        <div className="flex items-center justify-between w-full border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h2 className="text-lg font-bold truncate">{activeGroupCall.groupName}</h2>
          </div>
          <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full font-medium">
            Active {activeGroupCall.type === "video" ? "Video" : "Voice"} Call
          </span>
        </div>

        {/* Video Streams Grid */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-4 overflow-y-auto">
          {/* Local User Stream */}
          <div className="relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 aspect-video flex items-center justify-center">
            {activeGroupCall.type === "video" && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold border border-zinc-700">
                  You
                </div>
                <span className="text-xs font-semibold">You (Local)</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[11px] font-medium text-zinc-200">
              You {isMuted ? "(Muted)" : ""}
            </div>
          </div>

          {/* Remote Streams */}
          {remoteSocketIds.map((sockId) => {
            const { stream, user } = groupRemoteStreams[sockId];
            return (
              <RemoteParticipantVideo key={sockId} stream={stream} user={user} type={activeGroupCall.type} />
            );
          })}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center gap-6 pt-3 border-t border-zinc-800 w-full justify-center">
          {!groupLocalStream ? (
            // Show join button when user hasn't granted media access / not joined yet
            <button
              onClick={() => startOrJoinGroupCall(activeGroupCall.groupId, activeGroupCall.type)}
              className="px-6 py-3 rounded-full bg-primary text-white font-semibold hover:opacity-90"
            >
              Join Call
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`p-3.5 rounded-full border transition-all ${
                  isMuted
                    ? "bg-red-600/30 border-red-600 text-red-500 hover:bg-red-600/40"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>

              {activeGroupCall.type === "video" && (
                <button
                  onClick={toggleCamera}
                  className={`p-3.5 rounded-full border transition-all ${
                    isVideoOff
                      ? "bg-red-600/30 border-red-600 text-red-500 hover:bg-red-600/40"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                  }`}
                  title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </button>
              )}

              <button
                onClick={leaveGroupCall}
                className="p-4 bg-red-600 hover:bg-red-700 active:scale-95 transition-all rounded-full flex items-center justify-center shadow-xl border border-red-500/20"
                title="Leave Call"
              >
                <PhoneOff className="size-6 text-white" />
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

// Sub-component to attach remote streams safely
const RemoteParticipantVideo = ({ stream, user, type }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 aspect-video flex items-center justify-center">
      {type === "video" ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
          <audio ref={videoRef} autoPlay />
          <img
            src={user.profilePic || "/avatar.png"}
            alt={user.fullName}
            className="w-16 h-16 rounded-full object-cover border border-zinc-700"
          />
          <span className="text-xs font-semibold">{user.fullName || "Member"}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[11px] font-medium text-zinc-200">
        {user.fullName || "Group Member"}
      </div>
    </div>
  );
};

export default GroupCallModal;
