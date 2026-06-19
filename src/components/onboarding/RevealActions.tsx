"use client";

import { useState } from "react";
import { Share2, Sparkles } from "lucide-react";
import VibeShareCard from "@/components/VibeShareCard";

// Reveal-screen actions: post the vibe card, or invite a friend. Same wiring as
// the rest of the app (Web Share + clipboard fallback / canvas vibe card),
// with the screenshot copy.
export default function RevealActions({
  userId,
  name,
  tags,
  archetypeKey,
}: {
  userId: string;
  name: string;
  tags: string[];
  archetypeKey?: string | null;
}) {
  const [showCard, setShowCard] = useState(false);
  const [copied, setCopied] = useState(false);

  // Share a "how compatible are we?" link — the friend takes the vibe check.
  async function checkMatch() {
    const url = `https://app.findflockie.com/compat/${userId}`;
    const text = "See how compatible we'd be — take the 60-sec vibe check:";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "How compatible are we?", text, url });
        return;
      } catch {
        // cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setShowCard(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink border-b-[5px] bg-navy py-3.5 text-[14.5px] font-extrabold text-white"
      >
        <Share2 size={17} /> Share your vibe
      </button>
      <button
        type="button"
        onClick={checkMatch}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral py-3.5 text-[14.5px] font-extrabold text-white"
      >
        <Sparkles size={17} /> {copied ? "Link copied!" : "Check if your friend would match your vibe"}
      </button>

      {showCard && (
        <VibeShareCard
          userId={userId}
          name={name}
          tags={tags}
          archetypeKey={archetypeKey}
          onClose={() => setShowCard(false)}
        />
      )}
    </div>
  );
}
