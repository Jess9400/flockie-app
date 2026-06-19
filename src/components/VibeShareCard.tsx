"use client";

import { useEffect, useRef } from "react";
import CompatShareButton from "@/components/CompatShareButton";
import { ARCHETYPES } from "@/lib/onboarding/archetypes";
import type { VibeDimension } from "@/lib/onboarding/types";

// Generates a branded vibe card on a canvas the user can share. Includes the
// personality archetype (name + description) plus travel/activity tags.
export default function VibeShareCard({
  userId,
  name,
  tags,
  archetypeKey,
  onClose,
}: {
  userId?: string;
  name: string;
  tags: string[];
  archetypeKey?: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 1080;
  const H = 1080;
  const a = archetypeKey ? ARCHETYPES[archetypeKey as VibeDimension] ?? null : null;
  const archetypeName = a?.name ?? null;
  const archetypeEmoji = a?.emoji ?? null;
  const archetypeDescription = a?.description ?? null;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    function wrap(text: string, font: string, maxWidth: number, max: number): string[] {
      if (!ctx) return [];
      ctx.font = font;
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = w;
          if (lines.length === max - 1) break;
        } else {
          line = test;
        }
      }
      if (line && lines.length < max) lines.push(line);
      return lines;
    }

    function draw(logo: HTMLImageElement | null) {
      if (!ctx) return;
      // background
      ctx.fillStyle = "#0F2A4C";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";

      // Flockie logo mark (white)
      if (logo) {
        const lw = 130;
        const lh = lw * (104 / 118);
        ctx.drawImage(logo, (W - lw) / 2, 64, lw, lh);
      }

      // wordmark
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 46px system-ui, sans-serif";
      ctx.fillText("flockie", W / 2, 250);

      // kicker
      ctx.fillStyle = "#FF6B4A";
      ctx.font = "700 36px system-ui, sans-serif";
      ctx.fillText("MY VIBE", W / 2, 318);

      let y = 430;

      if (archetypeName) {
        // emoji
        ctx.font = "110px system-ui, sans-serif";
        ctx.fillText(archetypeEmoji || "🪶", W / 2, 420);
        // archetype name
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 76px system-ui, sans-serif";
        ctx.fillText(archetypeName, W / 2, 530);
        // person name
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "600 40px system-ui, sans-serif";
        ctx.fillText(name || "A flockie", W / 2, 590);
        y = 660;
        // description (wrapped, up to 3 lines)
        if (archetypeDescription) {
          const font = "500 38px system-ui, sans-serif";
          const lines = wrap(archetypeDescription, font, W - 180, 3);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = font;
          for (const ln of lines) {
            ctx.fillText(ln, W / 2, y);
            y += 50;
          }
          y += 24;
        }
      } else {
        // Fallback: name as the headline.
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 88px system-ui, sans-serif";
        ctx.fillText(name || "A flockie", W / 2, 470);
        y = 580;
      }

      // tag pills (up to 3, short, stacked) — keep clear of the footer
      const shown = tags
        .filter(Boolean)
        .map((t) => (t.length > 24 ? t.slice(0, 23).trim() + "…" : t))
        .slice(0, 3);
      ctx.font = "700 38px system-ui, sans-serif";
      for (const t of shown) {
        if (y > H - 200) break;
        const tw = ctx.measureText(t).width;
        const padX = 40;
        const pw = Math.min(tw + padX * 2, W - 140);
        const ph = 78;
        const x = (W - pw) / 2;
        ctx.fillStyle = "#FF6B4A";
        roundRect(ctx, x, y, pw, ph, 39);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(t, W / 2, y + 52);
        y += ph + 24;
      }

      // footer — sign-up CTA so anyone who sees the card can join
      ctx.fillStyle = "#FF6B4A";
      ctx.font = "700 40px system-ui, sans-serif";
      ctx.fillText("Find your vibe → findflockie.com", W / 2, H - 78);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText("free · 60-second vibe check", W / 2, H - 36);
    }

    const img = new window.Image();
    img.onload = () => draw(img);
    img.onerror = () => draw(null);
    img.src = "/logo-mark-white.svg";
  }, [name, tags, archetypeName, archetypeEmoji, archetypeDescription]);

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
