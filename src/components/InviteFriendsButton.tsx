"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export default function InviteFriendsButton({
  inviterId,
  inviterName,
  city,
  label,
}: {
  inviterId: string;
  inviterName?: string;
  city?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = `https://app.findflockie.com/join/${inviterId}`;
  const firstName = inviterName?.split(" ")[0];
  const text = city
    ? `${firstName ? `${firstName} invited you` : "You're invited"} to Flockie — join me and find people for trips and activities in ${city}!`
    : `${firstName ? `${firstName} invited you` : "You're invited"} to Flockie — find people to travel and do things with!`;

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
