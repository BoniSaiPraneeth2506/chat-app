import { useRef, useState, useEffect, useCallback } from "react";
import { X, RotateCcw, ZoomIn, ZoomOut, Check } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const OUTPUT_SIZE = 512;

/**
 * Full-screen crop modal. The visible circle adapts to the viewport so it
 * never overflows on mobile, while the canvas always renders at OUTPUT_SIZE
 * for a high-quality export.
 *
 * Props:
 *   src        – data-URL or URL of the image to crop
 *   onCrop     – callback(croppedBase64)
 *   onCancel   – close without cropping
 */
export default function AvatarCropModal({ src, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [cropPx, setCropPx] = useState(OUTPUT_SIZE);

  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // ── Measure viewport and pick a crop circle that fits ──
  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Leave room for header (~52px), controls row (~56px), button (~60px), and padding
      const avail = Math.min(vw - 32, vh - 220);
      setCropPx(Math.max(200, Math.min(OUTPUT_SIZE, avail)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // ── Load image and compute initial fit ──
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const scale = OUTPUT_SIZE / minDim;
      setImgSize({ w: img.naturalWidth * scale, h: img.naturalHeight * scale });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    img.src = src;
  }, [src]);

  // ── Draw to canvas (always at OUTPUT_SIZE) ──
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const drawW = imgSize.w * zoom;
    const drawH = imgSize.h * zoom;
    const x = (OUTPUT_SIZE - drawW) / 2 + offset.x;
    const y = (OUTPUT_SIZE - drawH) / 2 + offset.y;
    ctx.drawImage(img, x, y, drawW, drawH);
  }, [ready, zoom, offset, imgSize]);

  // ── Pointer drag ──
  const onPointerDown = useCallback((e) => {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
    containerRef.current?.setPointerCapture(e.pointerId);
  }, [offset]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const onPointerUp = useCallback((e) => {
    dragRef.current.active = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  // ── Scroll / pinch to zoom ──
  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.002)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Clamp offset so the image always covers the circle ──
  useEffect(() => {
    if (!ready) return;
    const drawW = imgSize.w * zoom;
    const drawH = imgSize.h * zoom;
    const maxPanX = Math.max(0, (drawW - OUTPUT_SIZE) / 2);
    const maxPanY = Math.max(0, (drawH - OUTPUT_SIZE) / 2);
    setOffset((o) => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, o.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, o.y)),
    }));
  }, [zoom, imgSize, ready]);

  // ── Crop & return ──
  const handleCrop = () => {
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvasRef.current, 0, 0);
    onCrop(out.toDataURL("image/jpeg", 0.92));
  };

  const resetTransform = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-white/80">Move and scale</span>
        <div className="w-9" />
      </div>

      {/* Center: crop circle */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative select-none touch-none"
          style={{ width: cropPx, height: cropPx }}
        >
          <canvas
            ref={canvasRef}
            className="rounded-full"
            style={{ width: cropPx, height: cropPx }}
          />
          {/* Dark mask outside circle */}
          <div className="absolute inset-0 rounded-full pointer-events-none ring-2 ring-white/40" />
        </div>
      </div>

      {/* Bottom controls — never overlaps the circle */}
      <div className="shrink-0 flex flex-col items-center gap-4 pb-8 pt-2 px-4">
        {/* Zoom row */}
        <div className="flex items-center justify-center gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z - 0.3))}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            value={zoom * 100}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="flex-1 accent-white h-1"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.3))}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={resetTransform}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Confirm button */}
        <button
          type="button"
          onClick={handleCrop}
          disabled={!ready}
          className="w-full max-w-xs h-12 rounded-full bg-primary text-primary-content font-semibold text-sm shadow-lg shadow-primary/30 active:scale-[0.97] transition-all disabled:opacity-40"
        >
          Set profile photo
        </button>
      </div>
    </div>
  );
}
