"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ShareVibeButton from "@/components/ShareVibeButton";

export default function HostVibeControls({
  vibeId,
  status,
}: {
  vibeId: string;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status === "cancelled") {
    return (
      <div className="rounded-full border-2 border-ink bg-cream py-3 text-center font-bold text-muted">
        You cancelled this Vibe.
      </div>
    );
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("rank_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    const r = data as {
      invited?: number;
      standby?: number;
      backfilled?: number;
      city_invited?: number;
      total_invited?: number;
    };
    const totalInvited =
      r.total_invited ?? (r.invited ?? 0) + (r.backfilled ?? 0) + (r.city_invited ?? 0);
    setMsg(`Matched! Invited ${totalInvited}, standby ${r.standby ?? 0}.`);
    router.refresh();
  }

  const tile = "flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-ink py-3 text-[11px] font-bold disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button onClick={run} disabled={busy} className={`${tile} bg-flockie-orange text-white`}>
          <Sparkles size={18} /> {busy ? "Running…" : "Run Matching"}
        </button>
        <ShareVibeButton vibeId={vibeId} tile />
        <Link href={`/vibes/${vibeId}/chat`} className={`${tile} bg-flockie-blue text-white`}>
          <MessageCircle size={18} /> Open Chat
        </Link>
      </div>
      <p className="px-2 text-center text-xs font-medium text-muted">
        If you don&rsquo;t run matching, Flockie starts automatically 48h before your deadline.
      </p>
      {msg && <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
