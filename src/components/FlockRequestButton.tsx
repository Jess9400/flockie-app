"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FlockRequestButton({
  tripId,
  requested,
  compact = false,
}: {
  tripId: string;
  requested: boolean;
  compact?: boolean;
}) {
  const supabase = createClient();
  const [done, setDone] = useState(requested);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function request() {
    setBusy(true);
    setErr(false);
    const { error } = await supabase.rpc("request_join_trip", { p_trip: tripId });
    setBusy(false);
    if (error) return setErr(true);
    setDone(true);
  }

  const sizing = compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";

  if (done) {
    return (
      <span className={`rounded-full border-2 border-ink bg-cream font-bold text-muted ${sizing}`}>
        Requested
      </span>
    );
  }

  return (
    <button
      onClick={request}
      disabled={busy}
      title={err ? "Couldn't send your request — tap to try again" : undefined}
      className={`rounded-full border-2 border-ink bg-flockie-orange font-bold text-white shadow-[0_3px_0_0_#E0512C] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_0_#E0512C] disabled:opacity-50 ${sizing}`}
    >
      {err ? "Try again" : "Request to join"}
    </button>
  );
}
