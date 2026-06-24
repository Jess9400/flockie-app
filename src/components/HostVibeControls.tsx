"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ShareVibeButton from "@/components/ShareVibeButton";

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function HostVibeControls({
  vibeId,
  status,
  startsAt,
  endsAt,
  signupDeadline,
}: {
  vibeId: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  signupDeadline: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starts, setStarts] = useState(toLocalInput(startsAt));
  const [ends, setEnds] = useState(toLocalInput(endsAt));
  const [deadline, setDeadline] = useState(toLocalInput(signupDeadline));

  const cancelled = status === "cancelled";

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

  async function saveDates() {
    if (!starts) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("update_vibe_when", {
      p_vibe: vibeId,
      p_starts: new Date(starts).toISOString(),
      p_ends: ends ? new Date(ends).toISOString() : null,
      p_deadline: deadline ? new Date(deadline).toISOString() : null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Updated — everyone in was notified.");
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
      <button
        onClick={run}
        disabled={busy}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
      >
        {busy ? "Running…" : status === "open" ? "Run Matching Algo" : "Re-run Matching Algo"}
      </button>
      <p className="px-2 text-center text-xs font-medium text-muted">
        Ranks interested people by match % and sends invites up to capacity. Run it now if you&rsquo;re
        oversubscribed and want to lock your group in before the deadline.
      </p>

      <Link
        href={`/vibes/${vibeId}/chat`}
        className="block w-full rounded-full border-2 border-ink bg-flockie-blue py-3 text-center font-bold text-white"
      >
        Open Vibing Chat
      </Link>

      <div className="flex justify-center pt-1">
        <ShareVibeButton vibeId={vibeId} />
      </div>

      {/* Settings: edit date/time + cancel live here */}
      <button
        onClick={() => setSettingsOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-white py-3 font-bold"
      >
        <Settings size={16} /> Settings
        <ChevronDown size={16} className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
      </button>

      {settingsOpen && (
        <div className="space-y-3 rounded-2xl border-2 border-ink bg-white p-3">
          <div className="space-y-2">
            <label className="block text-sm font-bold">
              Starts
              <input
                type="datetime-local"
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-medium outline-none"
              />
            </label>
            <label className="block text-sm font-bold">
              Ends (optional)
              <input
                type="datetime-local"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-medium outline-none"
              />
            </label>
            <label className="block text-sm font-bold">
              Signup deadline
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-medium outline-none"
              />
            </label>
            <button
              onClick={saveDates}
              disabled={busy}
              className="w-full rounded-full border-2 border-ink bg-flockie-orange py-2.5 font-bold text-white shadow-[0_3px_0_0_#E0512C] disabled:opacity-50"
            >
              Save &amp; notify everyone
            </button>
          </div>

          <button
            onClick={del}
            disabled={busy}
            className="w-full rounded-full border-2 border-ink bg-white py-2.5 font-bold text-ink/70"
          >
            Delete Vibe
          </button>
        </div>
      )}

      {msg && <p className="text-center text-sm font-bold text-flockie-blue">{msg}</p>}
    </div>
  );
}
