import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff } from "lucide-react";

const CallModal = () => {
  const {
    callState,
    callType,
    callPartner,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall
  } = useChatStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => console.log("Local play error:", err));
    }
  }, [localStream, callState]);

  // Bind remote stream to video/audio element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => console.log("Remote play error:", err));
    }
  }, [remoteStream, callState]);

  // Call duration timer
  useEffect(() => {
    let timer;
    if (callState === "connected") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Audio ringtone playback
  const ringtoneRef = useRef(null);

  useEffect(() => {
    if (callState === "incoming") {
      ringtoneRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/1359/1359-84.wav");
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch((err) => console.log("Audio play error:", err));
    } else if (callState === "ringing") {
      ringtoneRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav");
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch((err) => console.log("Audio play error:", err));
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [callState]);

  if (!callState) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md text-white select-none">
      <div className="relative flex flex-col items-center justify-between w-full h-full max-w-lg p-8 sm:h-[600px] sm:rounded-2xl sm:border sm:border-zinc-800 bg-zinc-950 shadow-2xl">
        
        {/* Top details */}
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="relative">
            <img
              src={callPartner?.profilePic || "/avatar.png"}
              alt={callPartner?.fullName}
              className="w-24 h-24 object-cover rounded-full border-4 border-primary/20 shadow-lg"
            />
            {callState === "connected" && (
              <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-wide mt-2">{callPartner?.fullName}</h2>
          <p className="text-zinc-400 text-sm font-medium uppercase tracking-widest">
            {callState === "ringing" && "Ringing..."}
            {callState === "incoming" && `Incoming ${callType} Call`}
            {callState === "connected" && `On Call (${formatTime(callDuration)})`}
          </p>
        </div>

        {/* Hidden Remote Stream Audio Element for Phone Calls */}
        {callState === "connected" && callType === "phone" && (
          <audio
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="hidden"
          />
        )}

        {/* Video Streams Container (Connected Video Call) */}
        {callState === "connected" && callType === "video" && (
          <div className="absolute inset-0 z-10 w-full h-full overflow-hidden sm:rounded-2xl bg-zinc-900">
            {/* Remote Fullscreen Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Picture-in-Picture Video */}
            <div className="absolute top-4 right-4 w-28 h-40 border-2 border-white/20 rounded-xl overflow-hidden shadow-xl bg-zinc-950">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="relative z-20 flex flex-col items-center gap-6 w-full mb-8">
          
          {/* Incoming Call Accept/Reject buttons */}
          {callState === "incoming" ? (
            <div className="flex items-center gap-8 animate-bounce">
              <button
                onClick={rejectCall}
                className="p-4 bg-red-600 hover:bg-red-700 active:scale-95 transition-all rounded-full flex items-center justify-center shadow-lg"
                title="Decline Call"
              >
                <PhoneOff className="size-6 text-white" />
              </button>
              <button
                onClick={acceptCall}
                className="p-4 bg-green-600 hover:bg-green-700 active:scale-95 transition-all rounded-full flex items-center justify-center shadow-lg"
                title="Accept Call"
              >
                <Phone className="size-6 text-white" />
              </button>
            </div>
          ) : (
            /* Active Call Control Row */
            <div className="flex items-center gap-6">
              {/* Mic Toggle */}
              {callState === "connected" && (
                <button
                  onClick={toggleMute}
                  className={`p-3.5 rounded-full border transition-all ${
                    isMuted
                      ? "bg-red-600/30 border-red-600 text-red-500 hover:bg-red-600/40"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>
              )}

              {/* Camera Toggle */}
              {callState === "connected" && callType === "video" && (
                <button
                  onClick={toggleCamera}
                  className={`p-3.5 rounded-full border transition-all ${
                    isVideoOff
                      ? "bg-red-600/30 border-red-600 text-red-500 hover:bg-red-600/40"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </button>
              )}

              {/* End Call Button */}
              <button
                onClick={endCall}
                className="p-4 bg-red-600 hover:bg-red-700 active:scale-95 transition-all rounded-full flex items-center justify-center shadow-xl border border-red-500/20"
                title="End Call"
              >
                <PhoneOff className="size-6 text-white" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CallModal;
