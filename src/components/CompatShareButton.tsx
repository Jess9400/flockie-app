"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

// Shares a "how compatible are we?" link → friend takes the vibe check to find out.
export default function CompatShareButton({
  userId,
  variant = "primary",
}: {
  userId: string;
  variant?: "primary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  const url = `https://app.findflockie.com/compat/${userId}`;
  const text = "See how compatible we'd be as travel buddies — take the 60-sec vibe check:";

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "How compatible are we?", text, url });
        return;
      } catch {
        // cancelled / unsupported — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const cls =
    variant === "primary"
      ? "bg-flockie-blue text-white"
      : "bg-white text-navy";

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center justify-center gap-2 rounded-full border-2 border-navy px-5 py-2.5 font-fredoka text-sm font-semibold ${cls}`}
    >
      <Sparkles size={16} /> {copied ? "Link copied!" : "See your match % with a friend"}
    </button>
  );
}
