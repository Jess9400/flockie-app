"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type JoinReq = {
  userId: string;
  name: string;
  age: number | null;
  photo: string | null;
  oneLiner: string | null;
  status: string;
};

export default function FlockJoinRequests({
  tripId,
  requests,
  dualApproval,
}: {
  tripId: string;
  requests: JoinReq[];
  dualApproval?: boolean;
}) {
  const supabase = createClient();
  const [items, setItems] = useState(requests);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(userId: string, approve: boolean) {
    setBusy(userId);
    const { error } = await supabase.rpc("respond_join_request", {
      p_trip: tripId,
      p_user: userId,
      p_approve: approve,
    });
    setBusy(null);
    if (!error) {
      const next = approve ? (dualApproval ? "waiting" : "accepted") : "declined";
      setItems((cur) => cur.map((r) => (r.userId === userId ? { ...r, status: next } : r)));
    }
  }

  async function remove(userId: string) {
    if (!window.confirm("Remove this member? Their spot opens up for someone else.")) return;
    setBusy(userId);
    const { error } = await supabase.rpc("remove_flock_member", { p_trip: tripId, p_user: userId });
    setBusy(null);
    if (!error) setItems((cur) => cur.filter((r) => r.userId !== userId));
  }

  const pending = items.filter((r) => r.status === "pending");
  const waiting = items.filter((r) => r.status === "waiting");
  const accepted = items.filter((r) => r.status === "accepted");

  if (items.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border-2 border-ink bg-cream p-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
        Join requests {pending.length > 0 && `· ${pending.length} pending`}
      </p>

      {pending.length > 0 && (
        <ul className="mt-2 space-y-2">
          {pending.map((r) => (
            <li key={r.userId} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white p-2">
              <Link href={`/people/${r.userId}`} className="flex min-w-0 flex-1 items-center gap-2">
                {r.photo ? (
                  <Image src={r.photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {r.name[0]}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {r.name}{r.age ? `, ${r.age}` : ""}
                  </span>
                  {r.oneLiner && <span className="block truncate text-[11px] font-medium text-muted">{r.oneLiner}</span>}
                </span>
              </Link>
              <button
                onClick={() => act(r.userId, true)}
                disabled={busy === r.userId}
                aria-label="Approve"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-flockie-blue text-white disabled:opacity-50"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => act(r.userId, false)}
                disabled={busy === r.userId}
                aria-label="Decline"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-ink disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {waiting.length > 0 && (
        <p className="mt-2 text-[11px] font-medium text-muted">
          ✓ You approved {waiting.map((w) => w.name).join(", ")} — waiting for your co-host.
        </p>
      )}

      {accepted.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-bold text-muted">Going ({accepted.length})</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {accepted.map((r) => (
              <span
                key={r.userId}
                className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-white py-1 pl-2 pr-1 text-xs font-bold"
              >
                <Link href={`/people/${r.userId}`} className="flex items-center gap-1.5">
                  {r.photo ? (
                    <Image src={r.photo} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-flockie-blue text-[10px] font-bold text-white">
                      {r.name[0]}
                    </span>
                  )}
                  {r.name}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(r.userId)}
                  disabled={busy === r.userId}
                  aria-label={`Remove ${r.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
