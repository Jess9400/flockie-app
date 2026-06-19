"use client";

import { useEffect, useRef, useState } from "react";

// Lightweight, dependency-free square cropper: drag to reposition, slider to
// zoom, outputs a 1080×1080 JPEG blob. Used before uploading profile photos.
const S = 300; // on-screen square
const OUT = 1080; // exported square

export default function PhotoCropper({
  file,
  onCancel,
  onCropped,
  busy,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  busy?: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new window.Image();
    im.onload = () => {
      const base = S / Math.min(im.naturalWidth, im.naturalHeight);
      const dispW = im.naturalWidth * base;
      const dispH = im.naturalHeight * base;
      setOff({ x: (S - dispW) / 2, y: (S - dispH) / 2 });
      setImg(im);
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = img ? S / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const dispW = img ? img.naturalWidth * scale : S;
  const dispH = img ? img.naturalHeight * scale : S;

  function clamp(o: { x: number; y: number }) {
    return {
      x: Math.min(0, Math.max(S - dispW, o.x)),
      y: Math.min(0, Math.max(S - dispH, o.y)),
    };
  }
  const pos = clamp(off);

  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setOff(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }));
  }
  function onUp() {
    dragRef.current = null;
  }

  function confirm() {
    if (!img) return;
    const c = clamp(off);
    const sx = (0 - c.x) / scale;
    const sy = (0 - c.y) / scale;
    const sSize = S / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    canvas.toBlob((blob) => blob && onCropped(blob), "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/60 p-5 font-nunito">
      <div className="w-full max-w-sm rounded-3xl border-2 border-navy bg-cream p-5 text-center">
        <p className="font-fredoka text-lg font-bold text-navy">Reposition your photo</p>
        <p className="mt-1 text-sm font-medium text-navy/60">Drag to move, slide to zoom.</p>

        <div
          className="relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-2xl border-2 border-navy bg-navy"
          style={{ width: S, height: S }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: pos.x, top: pos.y, width: dispW, height: dispH, maxWidth: "none" }}
            />
          )}
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-4 w-full accent-flockie-coral"
        />

        <button
          type="button"
          onClick={confirm}
          disabled={busy || !img}
          className="mt-4 w-full rounded-full border-2 border-navy bg-flockie-coral py-3 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Use photo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-2 w-full py-2 text-sm font-bold text-navy/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
