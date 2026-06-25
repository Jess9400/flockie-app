"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ShortlistCandidate = {
  id: string;
  name: string | null;
  photo: string | null;
  score: number | null;
};

// Pre-invite host review: the algo's ranked shortlist. Host may reject up to the
// cap (25% of capacity); each rejection promotes the next-best. "Send invites"
// commits the list. If the host does nothing, it auto-sends after the window.
export default function HostVibeShortlist({
  vibeId,
  candidates,
  rejectCap,
  rejectsUsed,
}: {
  vibeId: string;
  candidates: ShortlistCandidate[];
  rejectCap: number;
  rejectsUsed: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const left = Math.max(0, rejectCap - rejectsUsed);

  async function reject(userId: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("host_reject_shortlisted", { p_vibe: vibeId, p_user: userId });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  async function sendInvites() {
    if (!window.confirm("Send invites to this list now? Invited people can no longer be rejected here.")) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("host_commit_matching", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold">Review your matched list</p>
        <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-muted">
          {left} remove{left === 1 ? "" : "s"} left
        </span>
      </div>
      <p className="mt-0.5 text-xs font-medium text-muted">
        The algorithm ranked these by match. Remove up to {rejectCap}, then send — or it auto-sends soon.
        Removed people aren&rsquo;t notified.
      </p>

      <div className="mt-3 space-y-2">
        {candidates.length === 0 ? (
          <p className="rounded-xl bg-cream p-3 text-center text-sm font-bold text-muted">
            No one to review yet.
          </p>
        ) : (
          candidates.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream/50 p-2.5">
              <Link href={`/people/${c.id}`} className="shrink-0">
                {c.photo ? (
                  <Image src={c.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {(c.name || "F")[0]}
                  </span>
                )}
              </Link>
              <Link href={`/people/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{c.name || "A flockie"}</p>
                {c.score != null && (
                  <p className="text-xs font-bold text-flockie-orange">{Math.round(c.score)}% match</p>
                )}
              </Link>
              <button
                type="button"
                onClick={() => reject(c.id)}
                disabled={busy || left <= 0}
                className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-bold text-ink/70 disabled:opacity-40"
              >
                <X size={14} /> Remove
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={sendInvites}
        disabled={busy || candidates.length === 0}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-flockie-orange py-3 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
      >
        <Send size={16} /> Send invites now
      </button>

      {msg && <p className="mt-2 text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
