"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type PrivateRequest = { id: string; name: string | null; photo: string | null };

// Host-only: share a private invite link and accept/decline people who used it.
// Direct invites fill the host's reserved spots (capacity minus the algo share).
export default function HostVibePrivateRequests({
  vibeId,
  requests,
  hostSpots,
  hostFilled,
}: {
  vibeId: string;
  requests: PrivateRequest[];
  hostSpots: number;
  hostFilled: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const left = Math.max(0, hostSpots - hostFilled);

  async function copyLink() {
    const url = `${window.location.origin}/invite/${vibeId}?via=host`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join my Vibe", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function act(userId: string, accept: boolean) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(accept ? "host_accept_private" : "host_reject_private", {
      p_vibe: vibeId,
      p_user: userId,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold">Your direct spots</p>
        <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-muted">
          {hostFilled}/{hostSpots} filled
        </span>
      </div>
      <p className="mt-0.5 text-xs font-medium text-muted">
        Share your private link to invite people straight into your {hostSpots} spots — they still do a
        quick vibe check, you approve them. ({left} left)
      </p>

      <button
        type="button"
        onClick={copyLink}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-2.5 text-sm font-bold text-ink"
      >
        <Link2 size={16} /> {copied ? "Link copied!" : "Copy private invite link"}
      </button>

      {requests.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Pending requests</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream/50 p-2.5">
              <Link href={`/people/${r.id}`} className="shrink-0">
                {r.photo ? (
                  <Image src={r.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {(r.name || "F")[0]}
                  </span>
                )}
              </Link>
              <Link href={`/people/${r.id}`} className="min-w-0 flex-1 truncate text-sm font-extrabold">
                {r.name || "A flockie"}
              </Link>
              <button
                type="button"
                onClick={() => act(r.id, true)}
                disabled={busy || left <= 0}
                className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-flockie-orange px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
              >
                <Check size={14} /> Add
              </button>
              <button
                type="button"
                onClick={() => act(r.id, false)}
                disabled={busy}
                className="flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-ink/70 disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="mt-2 text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
