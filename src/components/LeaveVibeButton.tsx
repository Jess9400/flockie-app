"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Small top-right action for a confirmed attendee to leave a Vibe (frees their
// spot; the algo backfills the next-best from standby).
export default function LeaveVibeButton({ vibeId }: { vibeId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (!window.confirm("Leave this Vibe? Your spot opens up for someone else.")) return;
    setBusy(true);
    await supabase.rpc("decline_vibe", { p_vibe: vibeId });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={leave}
      disabled={busy}
      className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold text-muted disabled:opacity-50"
    >
      <LogOut size={14} /> Leave
    </button>
  );
}
