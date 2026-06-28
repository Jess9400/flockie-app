"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { captureAndStoreLocation } from "@/lib/location";

export default function LocationToggle({
  userId,
  initial,
}: {
  userId: string;
  initial: boolean;
}) {
  const supabase = createClient();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    setErr(false);
    const { error } = await supabase
      .from("profiles")
      .update({ location_tracking_enabled: next })
      .eq("id", userId);
    if (error) {
      setOn(!next);
      setErr(true);
      setBusy(false);
      return;
    }

    // Turning on → grab location now (one native permission ask), store it, and
    // update the city. Best-effort: the preference is already saved.
    if (next) {
      try {
        await captureAndStoreLocation();
      } catch {
        /* ignore — permission denial / no geolocation shouldn't undo the toggle */
      }
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border-2 border-ink bg-white p-4 font-nunito">
      <div className="flex items-center justify-between">
        <div className="pr-3">
          <p className="text-sm font-extrabold text-navy">Keep my location current</p>
          <p className="text-xs font-medium text-navy/60">
            Let Flockie find Vibes, trips and people near you — and update your city
            automatically when you travel, so you never set it by hand.
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
      {err && (
        <p className="mt-2 text-xs font-bold text-red-700">
          Couldn&rsquo;t save — check your connection and try again.
        </p>
      )}
    </div>
  );
}
