"use client";

import { useState } from "react";

export function InviteFriendButton({ city }: { city: string | null }) {
  const [copied, setCopied] = useState(false);
  const url = "https://findflockie.com";
  const text = city
    ? `Join me on Flockie and find your people in ${city}.`
    : "Join me on Flockie and find your people.";

  async function invite() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Flockie", text, url });
        return;
      } catch {}
    }

    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={invite}
      className="rounded-xl border-2 border-ink border-b-[5px] bg-flockie-coral px-4 py-2.5 text-[13px] font-extrabold text-white"
    >
      {copied ? "Invite link copied!" : "Invite a friend"}
    </button>
  );
}
