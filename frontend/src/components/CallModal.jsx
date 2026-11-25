import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useCallQuality } from "../hooks/useCallQuality";
import { useNicknames, displayNameOf } from "../lib/contacts";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Minus, Maximize2, MonitorUp, MonitorX } from "lucide-react";
import { Capacitor } from "@capacitor/core";

const CallModal = () => {
  const nicknames = useNicknames();
  const {
    callState,
    callType,
    callPartner,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    isCallMinimized,
    toggleCallMinimize,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    isMuted,
    toggleLocalMute,
    declineCallWithMessage,
    toggleCallMode
  } = useChatStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const documentPipWindowRef = useRef(null);
  const documentPipVideoRef = useRef(null);
  const pipRequestRef = useRef(false);
  const pipDismissedRef = useRef(false);
  const callActiveRef = useRef(false);
  // getDisplayMedia isn't implemented in Android's WebView, so the control is
  // hidden on the app rather than shown and failing on tap.
  const canShareScreen =
    !Capacitor.isNativePlatform() && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const [callDuration, setCallDuration] = useState(0);
  const isVideoCallActive = callState === "connected" && callType === "video" && !!remoteStream;
  const { level: callQualityLevel, loss: callQualityLoss, latency: callQualityLatency } = useCallQuality(remoteStream);
  callActiveRef.current = isVideoCallActive;

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => console.log("Local play error:", err));
    }
  }, [localStream, callState, callType]);

  // Bind remote stream to video/audio element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => console.log("Remote play error:", err));
    }
  }, [remoteStream, callState, callType]);

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

  const closePictureInPicture = useCallback(() => {
    pipDismissedRef.current = true;
    const pipWindow = documentPipWindowRef.current;
    documentPipWindowRef.current = null;
    documentPipVideoRef.current = null;

    if (pipWindow && !pipWindow.closed) {
      try {
        pipWindow.close();
      } catch {
        pipDismissedRef.current = true;
      }
    }

    if (typeof document !== "undefined" && document.pictureInPictureElement) {
      try {
        document.exitPictureInPicture?.();
      } catch {
        pipDismissedRef.current = true;
      }
    }
  }, []);

  const openPictureInPicture = useCallback(async () => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (pipRequestRef.current || documentPipWindowRef.current || document.pictureInPictureElement) return;
    if (!callActiveRef.current || !remoteStream) return;

    pipDismissedRef.current = false;
    pipRequestRef.current = true;

    try {
      let handled = false;

      if (
        window.isSecureContext &&
        window.documentPictureInPicture &&
        typeof window.documentPictureInPicture.requestWindow === "function"
      ) {
        let pipWindow = null;
        try {
          pipWindow = await window.documentPictureInPicture.requestWindow({ width: 360, height: 480 });
        } catch {
          pipWindow = null;
        }

        if (pipWindow) {
          if (pipDismissedRef.current || !callActiveRef.current || !remoteStream) {
            try {
              pipWindow.close();
            } catch {
              pipDismissedRef.current = true;
            }
            return;
          }

          documentPipWindowRef.current = pipWindow;
          const pipDocument = pipWindow.document;
          pipDocument.body.style.margin = "0";
          pipDocument.body.style.background = "black";
          pipDocument.body.style.overflow = "hidden";

          Array.from(document.styleSheets).forEach((styleSheet) => {
            try {
              const style = pipDocument.createElement("style");
              style.textContent = Array.from(styleSheet.cssRules)
                .map((rule) => rule.cssText)
                .join("");
              pipDocument.head.appendChild(style);
            } catch {
              const link = pipDocument.createElement("link");
              link.rel = "stylesheet";
              link.href = styleSheet.href || "";
              if (link.href) pipDocument.head.appendChild(link);
            }
          });

          const sourceVideo = remoteVideoRef.current;
          const pipVideo = sourceVideo ? sourceVideo.cloneNode(false) : pipDocument.createElement("video");
          pipVideo.srcObject = remoteStream;
          pipVideo.autoplay = true;
          pipVideo.playsInline = true;
          pipVideo.controls = true;
          pipVideo.style.width = "100%";
          pipVideo.style.height = "100%";
          pipVideo.style.objectFit = "cover";
          pipVideo.style.display = "block";
          documentPipVideoRef.current = pipVideo;
          pipDocument.body.appendChild(pipVideo);
          pipVideo.play().catch(() => {});
          pipWindow.addEventListener("pagehide", () => {
            if (documentPipWindowRef.current === pipWindow) {
              documentPipWindowRef.current = null;
              documentPipVideoRef.current = null;
            }
          });
          handled = true;
        }
      }

      if (!handled && document.pictureInPictureEnabled !== false) {
        const video = remoteVideoRef.current;
        if (video && typeof video.requestPictureInPicture === "function" && video.readyState >= 1) {
          try {
            await video.requestPictureInPicture();
            if (pipDismissedRef.current) closePictureInPicture();
          } catch {
            handled = false;
          }
        }
      }
    } finally {
      pipRequestRef.current = false;
    }
  }, [closePictureInPicture, remoteStream]);

  useEffect(() => {
    if (!isVideoCallActive) {
      closePictureInPicture();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) openPictureInPicture();
    };
    const handleBlur = () => {
      openPictureInPicture();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [closePictureInPicture, isVideoCallActive, openPictureInPicture]);

  useEffect(() => () => closePictureInPicture(), [closePictureInPicture]);

  // Audio ringtone playback using Web Audio API (highly reliable, no network delays or broken links)
  useEffect(() => {
    let intervalId = null;
    let audioCtx = null;

    const playTone = (freq, duration, type = "sine", delay = 0, gainVal = 0.2) => {
      if (!audioCtx) return;
      
      setTimeout(() => {
        if (!audioCtx || audioCtx.state === "closed") return;
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        // Quick ramp up and exponential decay for clean chime sound
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gainVal, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + duration);
      }, delay);
    };

    const startRingtone = () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        const triggerIncomingPattern = () => {
          // Beautiful high-quality electronic dual-chime chord (440Hz + 880Hz)
          playTone(440, 1.2, "sine", 0, 0.25);
          playTone(880, 1.2, "sine", 0, 0.15);
          
          // Second ring pulse after 300ms
          playTone(440, 1.2, "sine", 300, 0.25);
          playTone(880, 1.2, "sine", 300, 0.15);
        };

        const triggerOutgoingPattern = () => {
          // Outgoing ringback tone: 400Hz + 450Hz sine wave
          playTone(400, 1.5, "sine", 0, 0.15);
          playTone(450, 1.5, "sine", 0, 0.15);
        };

        if (callState === "incoming") {
          triggerIncomingPattern();
          intervalId = setInterval(triggerIncomingPattern, 3000);
        } else if (callState === "ringing") {
          triggerOutgoingPattern();
          intervalId = setInterval(triggerOutgoingPattern, 4000);
        }
      } catch (err) {
        console.error("Failed to initialize ringtone player:", err);
      }
    };

    if (callState === "incoming" || callState === "ringing") {
      startRingtone();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
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
    toggleLocalMute();
  };

  const qualityTitle = `${callQualityLevel.charAt(0).toUpperCase()}${callQualityLevel.slice(1)} • ${callQualityLatency} ms • ${callQualityLoss.toFixed(1)}% loss`;
  const qualityBars = callQualityLevel === "good" ? 3 : callQualityLevel === "fair" ? 2 : 1;

  if (isCallMinimized) {
    return (
      <div 
        onClick={() => {
          closePictureInPicture();
          toggleCallMinimize();
        }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900/95 border border-zinc-700 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 cursor-pointer hover:bg-zinc-800 transition-all select-none animate-in slide-in-from-top duration-200"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span className="text-xs font-semibold tracking-wide">
          {displayNameOf(callPartner, nicknames)} • {callState === "connected" ? formatTime(callDuration) : "Ringing..."}
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCallMinimize();
            }}
            className="p-1 hover:bg-zinc-700 rounded-full transition-colors text-zinc-300"
            title="Expand Call"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            className="p-1.5 bg-red-600 hover:bg-red-700 rounded-full transition-colors text-white"
            title="End Call"
          >
            <PhoneOff size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md text-white select-none"
    >
      <div className="relative flex flex-col items-center justify-between w-full h-full max-w-lg p-8 sm:h-[600px] sm:rounded-2xl sm:border sm:border-zinc-800 bg-zinc-950 shadow-2xl">
        
        {/* Top Header minimize action */}
        <button
          onClick={() => {
            toggleCallMinimize();
            openPictureInPicture();
          }}
          className="absolute top-4 right-4 z-30 p-2 hover:bg-zinc-800/80 rounded-full text-zinc-400 hover:text-white transition-colors"
          title="Minimize call"
        >
          <Minus size={20} />
        </button>

        {callState === "connected" && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 text-zinc-300" title={qualityTitle}>
            <div className="flex items-end gap-0.5">
              {[0, 1, 2].map((bar) => (
                <span
                  key={bar}
                  className={`w-1 rounded-full bg-current ${bar < qualityBars ? "opacity-90" : "opacity-25"} ${
                    bar === 0 ? "h-1.5" : bar === 1 ? "h-2.5" : "h-3.5"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-medium capitalize">{callQualityLevel}</span>
          </div>
        )}

        {/* Top details */}
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="relative">
            <img
              src={callPartner?.profilePic || "/avatar.png"}
              alt={displayNameOf(callPartner, nicknames)}
              className="w-24 h-24 object-cover rounded-full border-4 border-primary/20 shadow-lg"
            />
            {callState === "connected" && (
              <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-wide mt-2">{displayNameOf(callPartner, nicknames)}</h2>
          <p className="text-zinc-400 text-sm font-medium uppercase tracking-widest">
            {callState === "ringing" && "Ringing..."}
            {callState === "incoming" && `Incoming ${callType} Call`}
            {callState === "connected" && `On Call (${formatTime(callDuration)})`}
          </p>
        </div>

        {/* Remote Stream Audio Element for Phone/Voice Calls.
            An <audio> element, not a zero-size <video>: Android WebViews don't
            reliably play audio from a 0x0 <video>, which is why remote voice
            went silent on voice calls while the visible call video still
            produced sound. */}
        {callState === "connected" && (callType === "phone" || callType === "voice" || callType === "audio") && (
          <audio
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-0 h-0 opacity-0 pointer-events-none absolute"
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
            <div className="flex flex-col items-center gap-4">
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
              <div className="flex flex-wrap items-center justify-center gap-2">
                {["In a meeting", "Can't talk, text me", "Call you in 10m"].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => declineCallWithMessage(reason)}
                    className="px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                    title={`Decline with: ${reason}`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
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
              {callState === "connected" && (
                <button
                  onClick={() => toggleCallMode()}
                  title={callType === "video" ? "Turn camera off" : "Turn camera on"}
                  className={`p-3.5 rounded-full border transition-all ${
                    callType === "video"
                      ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      : "bg-red-600/30 border-red-600 text-red-500 hover:bg-red-600/40"
                  }`}
                >
                  {callType === "video" ? <Video className="size-5" /> : <VideoOff className="size-5" />}
                </button>
              )}

              {/* Screen share — video calls only: replaceTrack needs an
                  existing video sender, and a voice call has none. */}
              {callState === "connected" && callType === "video" && canShareScreen && (
                <button
                  onClick={() => (isScreenSharing ? stopScreenShare() : startScreenShare())}
                  title={isScreenSharing ? "Stop sharing your screen" : "Share your screen"}
                  className={`p-3.5 rounded-full border transition-all ${
                    isScreenSharing
                      ? "bg-primary/25 border-primary text-primary hover:bg-primary/35"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {isScreenSharing ? <MonitorX className="size-5" /> : <MonitorUp className="size-5" />}
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
