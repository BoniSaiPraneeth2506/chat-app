import { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Crop, RotateCw, Pencil, Type, Droplet, Undo2, Check, Loader,
} from "lucide-react";
import { haptic } from "../lib/haptics";

// Edit a photo before it is sent: crop, rotate, draw, add text, blur a region.
//
// Written directly against canvas rather than pulling in an editor library —
// the whole surface is five tools, and a library would add far more weight to a
// bundle that already warns about its size.
//
// Two constraints shaped the design:
//
//   * Edits are destructive, applied straight onto a working canvas. Keeping a
//     live layer model would be tidier but means recompositing every frame while
//     a finger is dragging, which is where a mid-range phone starts dropping
//     frames. Undo is handled by snapshotting instead.
//   * Snapshots are JPEG data URLs, not ImageData. ImageData for a 1600x1200
//     photo is ~7.7 MB, so even a short history would run a phone out of memory.
//
// Pointer events are used throughout, so a mouse and a finger take the same
// path — the app has to work in a desktop browser and in the Android WebView.

// Large enough that a sent photo still looks sharp, small enough that a canvas
// of it plus a few snapshots is safe on a mid-range phone.
const MAX_DIMENSION = 1600;
const MAX_HISTORY = 6;

const COLORS = ["#ffffff", "#000000", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
const TOOLS = [
  { id: "crop", icon: Crop, label: "Crop" },
  { id: "draw", icon: Pencil, label: "Draw" },
  { id: "text", icon: Type, label: "Text" },
  { id: "blur", icon: Droplet, label: "Blur" },
];

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const ImageEditorModal = ({ src, onCancel, onSave }) => {
  const canvasRef = useRef(null);          // the working bitmap
  const overlayRef = useRef(null);         // crop/blur rectangle, drawn separately
  const wrapRef = useRef(null);
  const dragRef = useRef(null);

  const [tool, setTool] = useState("draw");
  const [color, setColor] = useState("#ffffff");
  const [brush, setBrush] = useState(6);
  const [history, setHistory] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rect, setRect] = useState(null);  // crop/blur selection, in canvas pixels
  const [textDraft, setTextDraft] = useState(null); // { x, y, value }
  // Bumped whenever the canvas is resized (rotate, crop, undo). The overlay
  // sizes itself from the canvas, so without this it keeps the old dimensions
  // and the selection lands in the wrong place.
  const [geom, setGeom] = useState(0);

  // ── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const img = await loadImage(src);
      if (cancelled) return;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = canvasRef.current;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      setGeom((g) => g + 1);
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  /** Snapshot before every destructive change, so Undo has somewhere to go. */
  const pushHistory = useCallback(() => {
    const snapshot = canvasRef.current.toDataURL("image/jpeg", 0.92);
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), snapshot]);
  }, []);

  const undo = async () => {
    if (!history.length) return;
    haptic("tap");
    const last = history[history.length - 1];
    const img = await loadImage(last);
    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    setHistory((h) => h.slice(0, -1));
    setGeom((g) => g + 1);
    setRect(null);
    setTextDraft(null);
  };

  // ── Coordinate mapping ───────────────────────────────────────────────────
  // The canvas is displayed scaled to fit, so every pointer position has to be
  // converted from CSS pixels into canvas pixels or strokes land in the wrong
  // place on any screen that isn't 1:1.
  const toCanvas = (e) => {
    const canvas = canvasRef.current;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * canvas.width,
      y: ((e.clientY - box.top) / box.height) * canvas.height,
    };
  };

  // ── Overlay (crop / blur rectangle) ──────────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas || !isReady) return;
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!rect) return;

    // Dim everything outside the selection so the chosen area reads clearly.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, overlay.width / 400);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }, [rect, isReady, geom]);

  // ── Pointer handling ─────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (!isReady || isSaving) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toCanvas(e);

    if (tool === "draw") {
      pushHistory();
      const ctx = canvasRef.current.getContext("2d");
      ctx.strokeStyle = color;
      ctx.lineWidth = brush * (canvasRef.current.width / 400);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      dragRef.current = { kind: "draw" };
      return;
    }

    if (tool === "text") {
      setTextDraft({ x: p.x, y: p.y, value: "" });
      return;
    }

    // crop and blur share the same rectangle gesture
    dragRef.current = { kind: "rect", origin: p };
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toCanvas(e);

    if (drag.kind === "draw") {
      const ctx = canvasRef.current.getContext("2d");
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }

    const o = drag.origin;
    setRect({
      x: Math.min(o.x, p.x),
      y: Math.min(o.y, p.y),
      w: Math.abs(p.x - o.x),
      h: Math.abs(p.y - o.y),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  // ── Tool actions ─────────────────────────────────────────────────────────
  const rotate = () => {
    haptic("tap");
    pushHistory();
    const canvas = canvasRef.current;
    const w = canvas.width, h = canvas.height;
    const buffer = document.createElement("canvas");
    buffer.width = h;
    buffer.height = w;
    const bctx = buffer.getContext("2d");
    bctx.translate(h / 2, w / 2);
    bctx.rotate(Math.PI / 2);
    bctx.drawImage(canvas, -w / 2, -h / 2);
    canvas.width = h;
    canvas.height = w;
    canvas.getContext("2d").drawImage(buffer, 0, 0);
    setGeom((g) => g + 1);
    setRect(null);
  };

  const applyCrop = () => {
    if (!rect || rect.w < 8 || rect.h < 8) return;
    haptic("success");
    pushHistory();
    const canvas = canvasRef.current;
    const buffer = document.createElement("canvas");
    buffer.width = Math.round(rect.w);
    buffer.height = Math.round(rect.h);
    buffer.getContext("2d").drawImage(
      canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, buffer.width, buffer.height
    );
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    canvas.getContext("2d").drawImage(buffer, 0, 0);
    setGeom((g) => g + 1);
    setRect(null);
  };

  const applyBlur = () => {
    if (!rect || rect.w < 8 || rect.h < 8) return;
    haptic("success");
    pushHistory();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // The blurred pixels are taken from an untouched copy, then clipped to the
    // selection. Blurring the canvas in place would drag the surrounding image
    // into the edges of the region.
    const source = document.createElement("canvas");
    source.width = canvas.width;
    source.height = canvas.height;
    source.getContext("2d").drawImage(canvas, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.filter = `blur(${Math.max(6, Math.min(rect.w, rect.h) / 6)}px)`;
    ctx.drawImage(source, 0, 0);
    ctx.restore();
    ctx.filter = "none";
    setRect(null);
  };

  const commitText = () => {
    const draft = textDraft;
    if (!draft?.value.trim()) {
      setTextDraft(null);
      return;
    }
    haptic("success");
    pushHistory();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const size = Math.max(18, canvas.width / 16);
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    // A dark outline keeps light text readable over a light photo.
    ctx.lineWidth = size / 8;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText(draft.value, draft.x, draft.y);
    ctx.fillStyle = color;
    ctx.fillText(draft.value, draft.x, draft.y);
    setTextDraft(null);
  };

  const save = () => {
    setIsSaving(true);
    haptic("success");
    // JPEG rather than PNG: a photo re-encoded as PNG can be several times
    // larger, and this goes on to be base64'd into a request body.
    const out = canvasRef.current.toDataURL("image/jpeg", 0.9);
    onSave(out);
  };

  const activeTool = TOOLS.find((t) => t.id === tool);
  const needsApply = (tool === "crop" || tool === "blur") && rect && rect.w > 8 && rect.h > 8;

  return (
    <div className="fixed inset-0 z-[240] flex flex-col bg-black/95 backdrop-blur-sm cg-fade">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full text-white/80 hover:bg-white/10 transition-colors"
          aria-label="Discard edits"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length}
            className="p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30 transition-colors"
            aria-label="Undo"
          >
            <Undo2 size={19} />
          </button>
          <button
            type="button"
            onClick={rotate}
            className="p-2 rounded-full text-white/80 hover:bg-white/10 transition-colors"
            aria-label="Rotate"
          >
            <RotateCw size={19} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="relative flex items-center justify-center flex-1 min-h-0 px-3">
        <div className="relative max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            className="max-w-full object-contain rounded-lg touch-none"
            style={{ maxHeight: "100%" }}
          />
          <canvas
            ref={overlayRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute inset-0 w-full h-full rounded-lg touch-none cursor-crosshair"
          />
          {!isReady && (
            <div className="absolute inset-0 grid place-items-center">
              <Loader className="animate-spin text-white/70" size={26} />
            </div>
          )}
        </div>
      </div>

      {/* Text entry, shown only while placing a caption */}
      {textDraft && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/10">
            <input
              autoFocus
              value={textDraft.value}
              onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && commitText()}
              placeholder="Type, then press Add"
              className="flex-1 h-10 px-3 text-[15px] text-white bg-transparent outline-none placeholder:text-white/40"
            />
            <button
              type="button"
              onClick={commitText}
              className="px-4 h-10 rounded-xl bg-white text-black text-[14px] font-semibold active:scale-95 transition-transform"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Colour + brush, only for the tools that use them */}
      {(tool === "draw" || tool === "text") && !textDraft && (
        <div className="flex items-center gap-3 px-4 pb-2 shrink-0 cg-scroll-x overflow-x-auto">
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                className={`rounded-full size-7 shrink-0 transition-transform ${
                  color === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {tool === "draw" && (
            <input
              type="range"
              min="2"
              max="20"
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
              className="w-24 shrink-0 accent-white"
              aria-label="Brush size"
            />
          )}
        </div>
      )}

      {/* Tools */}
      <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/10">
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => { haptic("tap"); setTool(id); setRect(null); setTextDraft(null); }}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                tool === id ? "bg-white text-black" : "text-white/75 hover:bg-white/10"
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-2">
          {needsApply ? (
            <button
              type="button"
              onClick={tool === "crop" ? applyCrop : applyBlur}
              className="flex-1 h-12 rounded-2xl bg-white text-black text-[15px] font-semibold active:scale-[0.98] transition-transform"
            >
              Apply {activeTool.label.toLowerCase()}
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={!isReady || isSaving}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-content text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {isSaving ? <Loader size={17} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? "Saving" : "Done"}
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-white/35">
          {tool === "crop" && "Drag to choose the area to keep"}
          {tool === "draw" && "Drag to draw"}
          {tool === "text" && "Tap where the text should go"}
          {tool === "blur" && "Drag over a face or anything to hide"}
        </p>
      </div>
    </div>
  );
};

export default ImageEditorModal;
