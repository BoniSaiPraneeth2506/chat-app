import { useRef, useState, useEffect, useCallback } from "react";
import { X, RotateCcw, ZoomIn, ZoomOut, Check } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const CROP_SIZE = 512;

/**
 * Full-screen modal that lets the user pan and zoom an image inside a circular
 * frame, then returns the cropped square as a base64 data-URL.
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

  // Transform state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Drag state (refs to avoid re-render on every move)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // ── Load image and compute initial fit ──
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      // Fit the image so the shortest dimension covers the crop circle
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const scale = CROP_SIZE / minDim;
      setImgSize({ w: img.naturalWidth * scale, h: img.naturalHeight * scale });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    img.src = src;
  }, [src]);

  // ── Draw whenever transform changes ──
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    const size = CROP_SIZE;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Draw image centered, then apply pan + zoom
    const drawW = imgSize.w * zoom;
    const drawH = imgSize.h * zoom;
    const x = (size - drawW) / 2 + offset.x;
    const y = (size - drawH) / 2 + offset.y;
    ctx.drawImage(img, x, y, drawW, drawH);
  }, [ready, zoom, offset, imgSize]);

  // ── Pointer (mouse + touch) drag handlers ──
  const onPointerDown = useCallback((e) => {
    if (e.button && e.button !== 0) return; // ignore right-click
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
    const maxPanX = Math.max(0, (drawW - CROP_SIZE) / 2);
    const maxPanY = Math.max(0, (drawH - CROP_SIZE) / 2);
    setOffset((o) => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, o.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, o.y)),
    }));
  }, [zoom, imgSize, ready]);

  // ── Crop & return ──
  const handleCrop = () => {
    const out = document.createElement("canvas");
    out.width = CROP_SIZE;
    out.height = CROP_SIZE;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvasRef.current, 0, 0);
    onCrop(out.toDataURL("image/jpeg", 0.92));
  };

  const resetTransform = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
        <button type="button" onClick={onCancel} className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-white/80">Move and scale</span>
        <div className="w-9" />
      </div>

      {/* Crop area */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative flex items-center justify-center select-none touch-none"
        style={{ width: CROP_SIZE, height: CROP_SIZE }}
      >
        {/* The canvas draws inside the circle */}
        <canvas
          ref={canvasRef}
          className="rounded-full"
          style={{ width: CROP_SIZE, height: CROP_SIZE }}
        />
        {/* Circle border overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none ring-2 ring-white/40"
        />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-24 left-0 right-0 flex items-center justify-center gap-3 z-10">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.3))}
          className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <input
          type="range"
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          value={zoom * 100}
          onChange={(e) => { setZoom(Number(e.target.value) / 100); }}
          className="w-44 accent-white"
        />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.3))}
          className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={resetTransform}
          className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Confirm */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center z-10">
        <button
          type="button"
          onClick={handleCrop}
          disabled={!ready}
          className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-primary-content font-semibold shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-40"
        >
          <Check className="w-5 h-5" />
          Set profile photo
        </button>
      </div>
    </div>
  );
}
