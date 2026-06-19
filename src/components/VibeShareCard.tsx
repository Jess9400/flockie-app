"use client";

import { useEffect, useRef } from "react";
import CompatShareButton from "@/components/CompatShareButton";

// Generates a branded "my travel vibe" image on a canvas the user can share.
export default function VibeShareCard({
  userId,
  name,
  tags,
  onClose,
}: {
  userId?: string;
  name: string;
  tags: string[];
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 1080;
  const H = 1080;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    function draw(logo: HTMLImageElement | null) {
      if (!ctx) return;
      // background
      ctx.fillStyle = "#0F2A4C";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";

      // Flockie logo mark (white)
      if (logo) {
        const lw = 150;
        const lh = lw * (104 / 118);
        ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh);
      }

      // wordmark
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 52px system-ui, sans-serif";
      ctx.fillText("flockie", W / 2, 290);

      // kicker
      ctx.fillStyle = "#FF6B4A";
      ctx.font = "700 40px system-ui, sans-serif";
      ctx.fillText("MY TRAVEL VIBE", W / 2, 400);

      // name
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 88px system-ui, sans-serif";
      ctx.fillText(name || "A flockie", W / 2, 500);

      // tag pills (up to 3, short, stacked) — keep clear of the footer
      const shown = tags
        .filter(Boolean)
        .map((t) => (t.length > 22 ? t.slice(0, 21).trim() + "…" : t))
        .slice(0, 3);
      ctx.font = "700 40px system-ui, sans-serif";
      let y = 610;
      for (const t of shown) {
        const tw = ctx.measureText(t).width;
        const padX = 44;
        const pw = Math.min(tw + padX * 2, W - 120);
        const ph = 84;
        const x = (W - pw) / 2;
        ctx.fillStyle = "#FF6B4A";
        roundRect(ctx, x, y, pw, ph, 42);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(t, W / 2, y + 56);
        y += ph + 28;
      }

      // footer
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "600 36px system-ui, sans-serif";
      ctx.fillText("find your flock · findflockie.com", W / 2, H - 70);
    }

    const img = new window.Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = "/logo-mark-white.svg";
  }, [name, tags]);

  async function share() {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "flockie-vibe.png", { type: "image/png" });
      const data = {
        files: [file],
        title: "My travel vibe",
        text: "Found my travel vibe on Flockie — find yours: https://findflockie.com",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share(data);
          return;
        } catch {
          /* cancelled — fall through to download */
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "flockie-vibe.png";
      a.click();
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-5 font-nunito">
      <div className="w-full max-w-sm rounded-3xl border-2 border-navy bg-cream p-5 text-center">
        <p className="font-fredoka text-xl font-bold text-navy">Your vibe is set 🎉</p>
        <p className="mt-1 font-nunito text-sm font-medium text-navy/60">
          Share it and pull your friends in.
        </p>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="mx-auto mt-4 w-full max-w-[260px] rounded-2xl border-2 border-navy"
        />
        <button
          type="button"
          onClick={share}
          className="mt-4 w-full rounded-full border-2 border-navy bg-flockie-coral py-3 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)]"
        >
          Share my vibe
        </button>
        {userId && (
          <div className="mt-2 flex justify-center">
            <CompatShareButton userId={userId} variant="ghost" />
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full py-2 font-nunito text-sm font-bold text-navy/60"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
