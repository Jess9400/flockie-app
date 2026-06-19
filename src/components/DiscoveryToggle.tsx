"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DiscoveryToggle({
  userId,
  initial,
}: {
  userId: string;
  initial: boolean;
}) {
  const supabase = createClient();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    await supabase.from("profiles").update({ open_to_discovery: next }).eq("id", userId);
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-ink bg-white p-4 font-nunito">
      <div className="pr-3">
        <p className="text-sm font-extrabold text-navy">Open to discovery</p>
        <p className="text-xs font-medium text-navy/60">
          Let people in your city find you for an activity — even if you haven&rsquo;t
          posted one. If someone likes your vibe, you&rsquo;ll get a heads-up to match back.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${
          on ? "bg-flockie-orange" : "bg-cream"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
