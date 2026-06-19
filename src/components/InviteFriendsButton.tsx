"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export default function InviteFriendsButton({ city, label }: { city?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const url = "https://findflockie.com";
  const text = city
    ? `I'm on Flockie looking for travel buddies${city ? ` in ${city}` : ""} — join me and let's unlock matching here!`
    : "I'm on Flockie — find people to travel and do things with. Join me!";

  async function invite() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join me on Flockie", text, url });
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

  return (
    <button
      type="button"
      onClick={invite}
      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]"
    >
      <Share2 size={16} /> {copied ? "Copied!" : label ?? "Invite friends to unlock"}
    </button>
  );
}
