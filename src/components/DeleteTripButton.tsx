"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Owner-only delete for a trip / activity / flock (My Trips). Confirms, calls
// the delete_trip RPC, then refreshes the list.
export default function DeleteTripButton({ tripId, label = "this" }: { tripId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setBusy(true);
    const { error } = await createClient().rpc("delete_trip", { p_trip: tripId });
    if (error) {
      setBusy(false);
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      aria-label="Delete"
      className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-flockie-coral disabled:opacity-50"
    >
      <Trash2 size={14} /> {busy ? "…" : "Delete"}
    </button>
  );
}
