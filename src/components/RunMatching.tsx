"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RunMatching({
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

  async function run() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("rank_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    const r = data as { invited: number; standby: number };
    setMsg(`Matched! Invited ${r.invited}, standby ${r.standby}.`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="rounded-full border-2 border-ink bg-white py-2.5 text-center text-sm font-bold">
        You&rsquo;re the host
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
      >
        {busy ? "Running…" : status === "open" ? "Run matching now" : "Re-run matching"}
      </button>
      <Link
        href={`/vibes/${vibeId}/chat`}
        className="block w-full rounded-full border-2 border-ink bg-flockie-blue py-3 text-center font-bold text-white"
      >
        Open Vibing Chat
      </Link>
      {msg && (
        <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>
      )}
    </div>
  );
}
