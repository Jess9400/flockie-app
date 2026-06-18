"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FlockRequestButton({
  tripId,
  requested,
}: {
  tripId: string;
  requested: boolean;
}) {
  const supabase = createClient();
  const [done, setDone] = useState(requested);
  const [busy, setBusy] = useState(false);

  async function request() {
    setBusy(true);
    const { error } = await supabase.rpc("request_join_trip", { p_trip: tripId });
    setBusy(false);
    if (!error) setDone(true);
  }

  if (done) {
    return (
      <span className="rounded-full border-2 border-ink bg-cream px-4 py-2 text-sm font-bold text-muted">
        Requested
      </span>
    );
  }

  return (
    <button
      onClick={request}
      disabled={busy}
      className="rounded-full border-2 border-ink bg-flockie-orange px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_#E0512C] disabled:opacity-50"
    >
      Request to join
    </button>
  );
}
