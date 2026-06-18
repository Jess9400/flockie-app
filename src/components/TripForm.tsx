"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRIP_VIBES } from "@/lib/vibe-check";

const TYPE_MAX = 3;
const BUDGET_LABELS = ["Backpacker", "Budget", "Mid-range", "Comfort", "Luxury"];
const PACE_LABELS = ["Very slow", "Relaxed", "Balanced", "Active", "Non-stop"];

type Trip = {
  id?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  group_size?: number;
  trip_type?: string[];
  budget?: number | null;
  pace?: number | null;
};

export default function TripForm({
  userId,
  initial,
}: {
  userId: string;
  initial: Trip;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [destination, setDestination] = useState(initial.destination ?? "");
  const [start, setStart] = useState(initial.start_date ?? "");
  const [end, setEnd] = useState(initial.end_date ?? "");
  const [groupSize, setGroupSize] = useState(initial.group_size ?? 2);
  const [types, setTypes] = useState<string[]>(initial.trip_type ?? []);
  const [budget, setBudget] = useState(initial.budget ?? 3);
  const [pace, setPace] = useState(initial.pace ?? 3);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const days =
    start && end
      ? Math.max(
          0,
          Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1
        )
      : 0;

  function toggleType(t: string) {
    setTypes((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < TYPE_MAX ? [...cur, t] : cur
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!destination.trim() || !start || !end) {
      return setErr("Destination and dates are required.");
    }
    if (new Date(end) < new Date(start)) {
      return setErr("End date must be after the start date.");
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      destination: destination.trim(),
      start_date: start,
      end_date: end,
      group_size: groupSize,
      trip_type: types,
      budget,
      pace,
      status: "active",
    };
    const res = initial.id
      ? await supabase.from("trips").update(payload).eq("id", initial.id)
      : await supabase.from("trips").insert(payload);
    setSaving(false);
    if (res.error) return setErr(res.error.message);
    router.push("/match");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none";

  return (
    <form onSubmit={save} className="space-y-5 pb-8">
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Where to?</span>
        <input className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination (city / place)" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Start</span>
          <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">End</span>
          <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {days > 0 && <p className="text-sm font-semibold text-flockie-orange">{days} days</p>}

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Group size: {groupSize}</span>
        <input type="range" min={1} max={12} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} className="w-full accent-flockie-orange" />
      </label>

      <div>
        <p className="text-sm font-bold">
          Trip type <span className="font-semibold text-muted">({types.length}/{TYPE_MAX})</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRIP_VIBES.map((t) => {
            const on = types.includes(t);
            const disabled = !on && types.length >= TYPE_MAX;
            return (
              <button key={t} type="button" disabled={disabled} onClick={() => toggleType(t)}
                className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${on ? "bg-flockie-blue text-white" : disabled ? "bg-white text-muted/40 opacity-50" : "bg-white"}`}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Budget: {BUDGET_LABELS[budget - 1]}</span>
        <input type="range" min={1} max={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-flockie-orange" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Pace: {PACE_LABELS[pace - 1]}</span>
        <input type="range" min={1} max={5} value={pace} onChange={(e) => setPace(Number(e.target.value))} className="w-full accent-flockie-orange" />
      </label>

      <p className="text-xs font-medium text-muted">
        Pre-filled from your profile — tweak anything for this trip.
      </p>

      {err && <p className="text-center text-sm font-bold text-flockie-orange">{err}</p>}

      <button type="submit" disabled={saving}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50">
        {saving ? "Saving…" : initial.id ? "Update trip" : "Post trip & find buddies"}
      </button>
    </form>
  );
}
