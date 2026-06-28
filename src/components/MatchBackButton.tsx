"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MatchBackButton({ personId, name }: { personId: string; name: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function matchBack() {
    setBusy(true);
    setErr(false);
    const { data, error } = await supabase.rpc("buddy_swipe", {
      p_target: personId,
      p_liked: true,
      p_activity_title: null,
    });
    if (error) {
      setBusy(false);
      setErr(true);
      return;
    }
    const res = data as { matched: boolean; chat_id?: string } | null;
    if (res?.matched && res.chat_id) {
      router.push(`/buddies/${res.chat_id}`);
    } else {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-ink bg-flockie-orange/10 p-4">
      <p className="text-sm font-bold text-ink">{name} wants to do something with you 👋</p>
      <p className="mt-0.5 text-xs font-medium text-ink/70">
        Your vibes match. Match back to open a chat.
      </p>
      <button
        onClick={matchBack}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
      >
        <Heart size={16} fill="currentColor" /> {busy ? "…" : `Match back & chat`}
      </button>
      {err && (
        <p className="mt-2 text-xs font-bold text-red-700">
          Couldn&rsquo;t match back — try again.
        </p>
      )}
    </div>
  );
}
