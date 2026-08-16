import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, ScanLine, CameraOff, Loader2 } from "lucide-react";
import { parseChatLink } from "../lib/utils";

// Scans another user's profile QR with the device camera.
//
// Decoding is done in JS (jsQR) over frames painted to an offscreen canvas
// rather than with the browser's `BarcodeDetector`: that API is missing on
// desktop Chrome/Windows and inconsistent across Android WebViews, so it
// would work on some of our two targets and not others.
//
// The camera itself is plain `getUserMedia`, which the app already uses for
// calls — the Android manifest declares CAMERA and MainActivity requests it
// at launch, so no extra native work is needed here.
const QrScannerModal = ({ open, onClose, onResult }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const handledRef = useRef(false);

  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setStatus("starting");
    setErrorText("");

    let cancelled = false;

    const stop = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      // Releasing every track matters more here than on the web: an Android
      // WebView that keeps the camera open blocks a later video call from
      // acquiring it.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const fail = (message) => {
      if (cancelled) return;
      setErrorText(message);
      setStatus("error");
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Browsers only expose the camera on a secure origin. The Android app
        // is served over https://localhost so it always qualifies; a plain
        // http:// dev server on a LAN IP does not.
        return fail("Camera access needs a secure (https) connection.");
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true"); // iOS/WebView: don't go fullscreen
        await video.play();

        if (cancelled) return;
        setStatus("scanning");
        frameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("QR scanner camera error:", err);
        fail(
          err?.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access and try again."
            : "Could not start the camera on this device."
        );
      }
    };

    let skip = 0;
    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      // Decoding every frame at full sensor resolution stutters badly on
      // mid-range phones; every 3rd frame at a capped width is plenty fast
      // for a code the user is holding still in front of the lens.
      if (skip++ % 3 !== 0) return;

      const maxWidth = 480;
      const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
      const width = Math.floor((video.videoWidth || 0) * scale);
      const height = Math.floor((video.videoHeight || 0) * scale);
      if (!width || !height) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const code = jsQR(imageData.data, width, height, { inversionAttempts: "dontInvert" });
      if (!code?.data || handledRef.current) return;

      const userId = parseChatLink(code.data);
      if (!userId) {
        setErrorText("That QR code isn't a Chatty profile.");
        return;
      }

      handledRef.current = true;
      navigator.vibrate?.(60);
      stop();
      onResult(userId);
    };

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <button
        onClick={onClose}
        data-modal-close
        className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-full text-white/90 hover:text-white transition-all shadow-md z-10"
        aria-label="Close scanner"
      >
        <X size={20} />
      </button>

      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <div className="text-center space-y-1">
          <h3 className="text-white font-semibold text-base flex items-center justify-center gap-2">
            <ScanLine size={18} />
            Scan a Profile QR
          </h3>
          <p className="text-white/60 text-xs">
            Point your camera at someone&apos;s Chatty QR code to open a chat with them.
          </p>
        </div>

        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {status === "scanning" && (
            <>
              {/* Viewfinder framing corners */}
              <div className="absolute inset-8 pointer-events-none">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
              <div className="absolute inset-x-8 top-1/2 h-0.5 bg-primary/80 animate-pulse pointer-events-none" />
            </>
          )}

          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
              <Loader2 size={26} className="animate-spin" />
              <span className="text-xs">Starting camera…</span>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 px-6 text-center">
              <CameraOff size={26} />
              <span className="text-xs leading-relaxed">{errorText}</span>
            </div>
          )}
        </div>

        {status === "scanning" && errorText && (
          <p className="text-amber-400 text-xs text-center">{errorText}</p>
        )}
      </div>
    </div>
  );
};

export default QrScannerModal;
