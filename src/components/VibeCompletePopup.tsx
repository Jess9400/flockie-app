"use client";

import { useEffect, useState } from "react";
import RevealActions from "@/components/onboarding/RevealActions";

// Shown once on the profile after all 3 forms are complete: celebrate + the two
// share actions (Share your vibe / Check if your friend would match your vibe).
export default function VibeCompletePopup({
  userId,
  name,
  tags,
  archetypeKey,
  allComplete,
  force,
}: {
  userId: string;
  name: string;
  tags: string[];
  archetypeKey?: string | null;
  allComplete: boolean;
  force?: boolean; // ?vibe_done=1 — show right after finishing the last form
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!allComplete || typeof window === "undefined") return;
    // Celebrate exactly once, ever. `force` (?vibe_done=1) must NOT bypass this
    // guard — otherwise the popup re-fires on every profile edit/refresh that
    // keeps the query param in the URL.
    if (localStorage.getItem("flockie_vibe_celebrated")) return;
    localStorage.setItem("flockie_vibe_celebrated", "1");
    setShow(true);
  }, [allComplete, force]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 font-nunito sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border-2 border-navy bg-cream p-5 text-center shadow-[0_6px_0_0_rgba(10,37,69,1)]">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 font-fredoka text-xl font-bold text-navy">Your vibe is complete!</p>
        <p className="mt-1 font-nunito text-sm font-medium text-navy/60">
          All three forms done. Now pull your people in.
        </p>
        <div className="mt-4">
          <RevealActions userId={userId} name={name} tags={tags} archetypeKey={archetypeKey} />
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="mt-3 w-full py-2 font-nunito text-sm font-bold text-navy/50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
