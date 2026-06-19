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
  destinations?: string[];
  title?: string | null;
  start_date?: string;
  end_date?: string;
  group_size?: number;
  trip_type?: string[];
  budget?: number | null;
  pace?: number | null;
  visibility?: string;
};

// kind: "trip" = 1:1 buddy trip · "activity" = 1:1 activity · "flock" = group trip
export default function TripForm({
  userId,
  initial,
  kind = "trip",
}: {
  userId: string;
  initial: Trip;
  kind?: "trip" | "activity" | "flock";
}) {
  const router = useRouter();
  const supabase = createClient();
  const isActivity = kind === "activity";
  const isFlock = kind === "flock";

  const initialDests = initial.destinations ?? (initial.destination ? [initial.destination] : []);
  const [title, setTitle] = useState(initial.title ?? "");
  const [dest1, setDest1] = useState(initialDests[0] ?? "");
  const [dest2, setDest2] = useState(initialDests[1] ?? "");
  const [dest3, setDest3] = useState(initialDests[2] ?? "");
  const [start, setStart] = useState(initial.start_date ?? "");
  const [end, setEnd] = useState(initial.end_date ?? "");
  const [groupSize, setGroupSize] = useState(initial.group_size ?? 4);
  const [types, setTypes] = useState<string[]>(initial.trip_type ?? []);
  const [budget, setBudget] = useState(initial.budget ?? 3);
  const [pace, setPace] = useState(initial.pace ?? 3);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const days =
    start && end ? Math.max(0, Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1) : 0;

  function toggleType(t: string) {
    setTypes((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < TYPE_MAX ? [...cur, t] : cur
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const destinations = isActivity
      ? [dest1].map((d) => d.trim()).filter(Boolean)
      : [dest1, dest2, dest3].map((d) => d.trim()).filter(Boolean);
    if (isActivity && !title.trim()) return setErr("Give your activity a name.");
    if (destinations.length === 0 || !start || !end) {
      return setErr(`${isActivity ? "City" : "At least one destination"} and dates are required.`);
    }
    if (new Date(end) < new Date(start)) return setErr("End date must be after the start date.");

    setSaving(true);
    const payload = {
      user_id: userId,
      kind: isFlock ? "trip" : kind, // a Flock is a public group trip
      title: isActivity ? title.trim() : null,
      destination: destinations[0],
      destinations,
      start_date: start,
      end_date: end,
      group_size: isFlock ? groupSize : 2, // buddy/activity = 1:1
      trip_type: types,
      budget,
      pace,
      visibility: isFlock ? "public" : "private",
      status: "active",
    };
    const res = initial.id
      ? await supabase.from("trips").update(payload).eq("id", initial.id)
      : await supabase.from("trips").insert(payload);
    setSaving(false);
    if (res.error) return setErr(res.error.message);
    router.push(isFlock ? "/flocks" : `/match?mode=${kind}`);
    router.refresh();
  }

  const inputCls = "w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none";

  return (
    <form onSubmit={save} className="space-y-5 pb-8">
      {isActivity && (
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Activity</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunrise surf, padel game, gallery hop" />
        </label>
      )}

      {isActivity ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold">City</span>
          <input className={inputCls} value={dest1} onChange={(e) => setDest1(e.target.value)} placeholder="Where you are" />
        </label>
      ) : (
        <div>
          <span className="mb-1 block text-sm font-bold">Where to? (up to 3)</span>
          <div className="space-y-2">
            <input className={inputCls} value={dest1} onChange={(e) => setDest1(e.target.value)} placeholder="Destination 1 (required)" />
            <input className={inputCls} value={dest2} onChange={(e) => setDest2(e.target.value)} placeholder="Destination 2 (optional)" />
            <input className={inputCls} value={dest3} onChange={(e) => setDest3(e.target.value)} placeholder="Destination 3 (optional)" />
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            {isFlock
              ? "Travelers who match any of these can request to join."
              : "You’ll match with travelers heading to any of these."}
          </p>
        </div>
      )}

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

      {isActivity ? (
        <p className="rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-medium text-ink/70">
          Activities are <span className="font-bold text-ink">1:1</span> — you&rsquo;ll
          match with one person at a time. For bigger groups, create a Vibe.
        </p>
      ) : isFlock ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Group size: {groupSize}</span>
          <input type="range" min={3} max={12} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} className="w-full accent-flockie-orange" />
          <p className="mt-1 text-xs font-medium text-muted">
            Anyone can request to join your Flock — you approve who&rsquo;s in.
          </p>
        </label>
      ) : (
        <p className="rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-medium text-ink/70">
          You&rsquo;re looking for <span className="font-bold text-ink">1 travel buddy</span> —
          you both swipe, mutual likes connect. Want a group? Create a Flock.
        </p>
      )}

      <div>
        <p className="text-sm font-bold">
          {isActivity ? "Activity vibe" : "Trip type"}{" "}
          <span className="font-semibold text-muted">({types.length}/{TYPE_MAX})</span>
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

      <p className="text-xs font-medium text-muted">Pre-filled from your profile — tweak anything.</p>
      {err && <p className="text-center text-sm font-bold text-flockie-orange">{err}</p>}

      <button type="submit" disabled={saving}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50">
        {saving
          ? "Saving…"
          : initial.id
            ? "Update"
            : isActivity
              ? "Post activity & find buddies"
              : isFlock
                ? "Create Flock"
                : "Post trip & find a buddy"}
      </button>
    </form>
  );
}
