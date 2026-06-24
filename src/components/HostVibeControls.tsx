"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { InterestStatus } from "@/lib/vibes";

type HostCandidate = {
  userId: string;
  status: InterestStatus;
  matchScore: number | null;
  invitationExpiresAt: string | null;
  name: string | null;
  photo: string | null;
  oneLiner: string | null;
};

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function HostVibeControls({
  vibeId,
  status,
  startsAt,
  endsAt,
  signupDeadline,
  candidates,
}: {
  vibeId: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  signupDeadline: string;
  candidates: HostCandidate[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [starts, setStarts] = useState(toLocalInput(startsAt));
  const [ends, setEnds] = useState(toLocalInput(endsAt));
  const [deadline, setDeadline] = useState(toLocalInput(signupDeadline));

  const cancelled = status === "cancelled";

  async function run() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("rank_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    const r = data as { invited: number; standby: number };
    setMsg(`Matched! Invited ${r.invited}, standby ${r.standby}.`);
    router.refresh();
  }

  async function saveDates() {
    if (!starts) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("update_vibe_when", {
      p_vibe: vibeId,
      p_starts: new Date(starts).toISOString(),
      p_ends: ends ? new Date(ends).toISOString() : null,
      p_deadline: deadline ? new Date(deadline).toISOString() : null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Updated — everyone in was notified.");
    setEditing(false);
    router.refresh();
  }

  async function handleCandidate(userId: string, action: "approve" | "deny") {
    setBusy(true);
    setMsg(null);
    const rpc =
      action === "approve" ? "host_invite_interest" : "host_decline_interest";
    const { error } = await supabase.rpc(rpc, {
      p_vibe: vibeId,
      p_user: userId,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(action === "approve" ? "Invite sent." : "Interest denied.");
    router.refresh();
  }

  async function del() {
    if (!confirm("Cancel this Vibe? Attendees are notified and the chat becomes inactive.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_vibe", { p_vibe: vibeId });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push("/vibes");
    router.refresh();
  }

  if (cancelled) {
    return (
      <div className="rounded-full border-2 border-ink bg-cream py-3 text-center font-bold text-muted">
        You cancelled this Vibe.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-full border-2 border-ink bg-white py-2.5 text-center text-sm font-bold">
        You&rsquo;re the host
      </div>
      <button onClick={run} disabled={busy}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50">
        {busy ? "Running…" : status === "open" ? "Run matching now" : "Re-match (send more invites)"}
      </button>
      <Link href={`/vibes/${vibeId}/chat`}
        className="block w-full rounded-full border-2 border-ink bg-flockie-blue py-3 text-center font-bold text-white">
        Open Vibing Chat
      </Link>

      <div className="rounded-2xl border-2 border-ink bg-white p-3">
        <p className="text-sm font-extrabold">Interested people</p>
        <p className="mt-0.5 text-xs font-semibold text-muted">
          Approve to send a 24h invite, or deny if they aren&rsquo;t the right fit.
        </p>
        {candidates.length === 0 ? (
          <p className="mt-3 rounded-xl bg-cream p-3 text-center text-sm font-bold text-muted">
            No pending people yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.userId}
                className="rounded-2xl border border-ink/10 bg-cream/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-flockie-blue text-sm font-extrabold text-white">
                    {candidate.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={candidate.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (candidate.name || "F")[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {candidate.name || "A flockie"}
                    </p>
                    <p className="truncate text-xs font-semibold text-muted">
                      {candidate.oneLiner || candidate.status}
                      {candidate.matchScore != null
                        ? ` · ${Math.round(candidate.matchScore)}% match`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-muted">
                    {candidate.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCandidate(candidate.userId, "approve")}
                    disabled={busy || candidate.status === "invited"}
                    className="rounded-full border-2 border-ink bg-flockie-orange py-2 text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {candidate.status === "invited" ? "Invited" : "Approve & invite"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCandidate(candidate.userId, "deny")}
                    disabled={busy}
                    className="rounded-full border-2 border-ink bg-white py-2 text-sm font-extrabold text-ink/70 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => setEditing((v) => !v)}
        className="w-full rounded-full border-2 border-ink bg-white py-3 font-bold">
        {editing ? "Close" : "Edit date / time"}
      </button>

      {editing && (
        <div className="space-y-2 rounded-2xl border-2 border-ink bg-white p-3">
          <label className="block text-sm font-bold">Starts
            <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-medium outline-none" />
          </label>
          <label className="block text-sm font-bold">Ends (optional)
            <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-medium outline-none" />
          </label>
          <label className="block text-sm font-bold">Signup deadline
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-medium outline-none" />
          </label>
          <button onClick={saveDates} disabled={busy}
            className="w-full rounded-full border-2 border-ink bg-flockie-orange py-2.5 font-bold text-white shadow-[0_3px_0_0_#E0512C] disabled:opacity-50">
            Save & notify everyone
          </button>
        </div>
      )}

      <button onClick={del} disabled={busy}
        className="w-full rounded-full border-2 border-ink bg-white py-3 font-bold text-ink/70">
        Delete Vibe
      </button>

      {msg && <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
