"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export default function ShareVibeButton({ vibeId, tile }: { vibeId: string; tile?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/invite/${vibeId}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my Vibe on Flockie", url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  // Compact tile for the side-by-side host action row.
  if (tile) {
    return (
      <button
        type="button"
        onClick={share}
        className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-ink bg-white py-3 text-[11px] font-bold text-ink"
      >
        <Share2 size={18} /> {copied ? "Copied!" : "Invite"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink"
    >
      <Share2 size={15} /> {copied ? "Link copied!" : "Invite / Share"}
    </button>
  );
}
