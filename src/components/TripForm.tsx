"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GenerateCoverButton from "@/components/GenerateCoverButton";
import { TRIP_VIBES } from "@/lib/vibe-check";
import { CONTINENTS, FLOCK_LANGUAGES, GROUP_GENDERS } from "@/lib/trips";

const TYPE_MAX = 3;
const BUDGET_LABELS = ["Backpacker", "Budget", "Mid-range", "Comfort", "Luxury"];
const PACE_LABELS = ["Very slow", "Relaxed", "Balanced", "Active", "Non-stop"];

type Trip = {
  id?: string;
  destination?: string;
  destinations?: string[];
  title?: string | null;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  group_size?: number;
  trip_type?: string[];
  budget?: number | null;
  pace?: number | null;
  visibility?: string;
  cover_photo?: string | null;
  continent?: string | null;
  language?: string | null;
  group_gender?: string | null;
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
  const [description, setDescription] = useState(initial.description ?? "");
  const [dest1, setDest1] = useState(initialDests[0] ?? "");
  const [dest2, setDest2] = useState(initialDests[1] ?? "");
  const [dest3, setDest3] = useState(initialDests[2] ?? "");
  const [start, setStart] = useState(initial.start_date ?? "");
  const [end, setEnd] = useState(initial.end_date ?? "");
  const [groupSize, setGroupSize] = useState(initial.group_size ?? 4);
  const [types, setTypes] = useState<string[]>(initial.trip_type ?? []);
  const [budget, setBudget] = useState(initial.budget ?? 3);
  const [pace, setPace] = useState(initial.pace ?? 3);
  const [cover, setCover] = useState<string | null>(initial.cover_photo ?? null);
  const [continent, setContinent] = useState(initial.continent ?? "");
  const [language, setLanguage] = useState(initial.language ?? "");
  const [groupGender, setGroupGender] = useState(initial.group_gender ?? "any");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/trip-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      setCover(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch {
      setErr("Photo upload failed.");
    } finally {
      setUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

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
    if (!cover) return setErr("Add a cover photo — upload one or generate it.");
    if (types.length === 0) {
      return setErr(isActivity ? "Pick at least one activity vibe." : "Pick at least one trip type.");
    }
    if (isFlock && !continent) return setErr("Pick the continent your Flock is in.");
    if (isFlock && !language) return setErr("Pick the group's main language.");

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
      description: description.trim() || null,
      budget,
      pace,
      cover_photo: cover,
      visibility: isFlock ? "public" : "private",
      continent: isFlock ? continent : null,
      language: isFlock ? language : null,
      group_gender: isFlock ? groupGender : "any",
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

      {!isActivity && (
        <label className="block">
          <span className="mb-1 block text-sm font-bold">
            About this {isFlock ? "Flock" : "trip"}{" "}
            <span className="font-medium text-muted">(optional)</span>
          </span>
          <textarea
            className={`${inputCls} h-24 resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            placeholder={
              isFlock
                ? "What's the plan and the vibe? Who's it for? e.g. Chill week in Bali — surf, cafés, no big parties. Easy-going people welcome."
                : "A few words about the trip and the kind of buddy you're after."
            }
          />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Start</span>
          <input type="date" className={`${inputCls} block min-w-0 appearance-none`} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">End</span>
          <input type="date" className={`${inputCls} block min-w-0 appearance-none`} value={end} onChange={(e) => setEnd(e.target.value)} />
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

      {isFlock && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Continent</span>
              <select className={inputCls} value={continent} onChange={(e) => setContinent(e.target.value)}>
                <option value="">Select…</option>
                {CONTINENTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Group language</span>
              <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">Select…</option>
                {FLOCK_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="mb-1 block text-sm font-bold">Open to</span>
            <div className="grid grid-cols-3 gap-2">
              {GROUP_GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGroupGender(g.value)}
                  className={`rounded-full border-2 border-ink py-2 text-sm font-bold ${
                    groupGender === g.value ? "bg-flockie-blue text-white" : "bg-white"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </>
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

      <div>
        <span className="mb-1 block text-sm font-bold">Cover photo</span>
        {cover ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border-2 border-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setCover(null)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
              aria-label="Remove cover"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={uploading}
              className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border-2 border-dashed border-ink/40 text-sm font-bold text-muted disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "+ Upload a cover"}
            </button>
            <GenerateCoverButton
              userId={userId}
              prompt={[isActivity ? title : "", dest1, dest2, dest3, ...types].filter(Boolean).join(", ")}
              disabled={uploading}
              onUploaded={(url) => setCover(url)}
            />
          </>
        )}
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={onCover} />
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

      <button type="submit" disabled={saving || uploading}
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
