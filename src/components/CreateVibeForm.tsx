"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  VIBE_CATEGORIES,
  EVENT_VIBE_TAGS,
  EVENT_VIBE_TAGS_MAX,
  DEALBREAKER_RULES,
  SKILL_REQUIREMENTS,
} from "@/lib/vibes";

const MAX_PHOTOS = 5;

export default function CreateVibeForm({
  userId,
  defaultCity,
}: {
  userId: string;
  defaultCity: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [city, setCity] = useState(defaultCity ?? "");
  const [locationName, setLocationName] = useState("");
  const [capacity, setCapacity] = useState(10);
  const [skill, setSkill] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [rules, setRules] = useState<Record<string, boolean>>({});
  const [diversity, setDiversity] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const urls: string[] = [];
      for (const file of files.slice(0, room)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/vibe-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true });
        if (error) throw error;
        urls.push(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch {
      setErr("Photo upload failed.");
    } finally {
      setUploading(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  function toggleTag(t: string) {
    setTags((cur) =>
      cur.includes(t)
        ? cur.filter((x) => x !== t)
        : cur.length < EVENT_VIBE_TAGS_MAX
          ? [...cur, t]
          : cur
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title || !description || !category || !startsAt || !deadline || !city) {
      return setErr("Please fill in all required fields.");
    }
    if (new Date(deadline) >= new Date(startsAt)) {
      return setErr("Signup deadline must be before the start time.");
    }

    setSaving(true);
    // Make sure a profile row exists (FK target) before creating the vibe.
    await supabase
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });

    const { data, error } = await supabase
      .from("vibes")
      .insert({
        host_id: userId,
        title,
        description,
        category,
        photos,
        city,
        location_name: locationName || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        signup_deadline: new Date(deadline).toISOString(),
        capacity,
        event_vibe_tags: tags,
        required_skill_level: skill,
        dealbreaker_rules: rules,
        diversity_floor_enabled: diversity,
        status: "open",
      })
      .select("id")
      .single();
    setSaving(false);

    if (error) return setErr(error.message);
    router.push(`/vibes/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8 pb-8">
      {/* Basics */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Basics</h2>
        <Field label="Title">
          <input
            className={inputCls}
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunset surf + tacos"
          />
        </Field>
        <Field label="Description">
          <textarea
            className={`${inputCls} h-28 resize-none`}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the plan, the vibe, who it's for…"
          />
        </Field>
        <Field label="Category">
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select…</option>
            {VIBE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cover photos (up to 5)">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-2xl border-2 border-ink"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-ink/40 text-2xl text-muted"
              >
                +
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
          {uploading && (
            <p className="mt-1 text-sm font-semibold text-flockie-orange">Uploading…</p>
          )}
        </Field>
      </section>

      {/* When & where */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">When &amp; where</h2>
        <Field label="Starts">
          <input
            type="datetime-local"
            className={inputCls}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </Field>
        <Field label="Ends (optional)">
          <input
            type="datetime-local"
            className={inputCls}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>
        <Field label="Signup deadline (when matching runs)">
          <input
            type="datetime-local"
            className={inputCls}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
        <Field label="City">
          <input
            className={inputCls}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Lisbon"
          />
        </Field>
        <Field label="Specific location (optional)">
          <input
            className={inputCls}
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Café Lisboa, Bairro Alto"
          />
        </Field>
      </section>

      {/* Who's invited */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Who&rsquo;s invited</h2>
        <Field label={`Capacity: ${capacity}`}>
          <input
            type="range"
            min={2}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full accent-flockie-orange"
          />
        </Field>
        <Field label="Required skill level">
          <select
            className={inputCls}
            value={skill === null ? "" : skill}
            onChange={(e) => setSkill(e.target.value === "" ? null : Number(e.target.value))}
          >
            {SKILL_REQUIREMENTS.map((s) => (
              <option key={s.label} value={s.value === null ? "" : s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Event vibe tags (max ${EVENT_VIBE_TAGS_MAX})`}>
          <div className="flex flex-wrap gap-2">
            {EVENT_VIBE_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
                    on ? "bg-flockie-blue text-white" : "bg-white"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Dealbreaker rules">
          <div className="flex flex-wrap gap-2">
            {DEALBREAKER_RULES.map((r) => {
              const on = !!rules[r.key];
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRules({ ...rules, [r.key]: !on })}
                  className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
                    on ? "bg-ink text-white" : "bg-white"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Advanced */}
        <div className="rounded-2xl border-2 border-ink bg-white p-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-extrabold"
          >
            Advanced settings
            <span className="text-xl leading-none">{showAdvanced ? "−" : "+"}</span>
          </button>
          {showAdvanced && (
            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={diversity}
                onChange={(e) => setDiversity(e.target.checked)}
                className="mt-1 h-5 w-5 accent-flockie-orange"
              />
              <span className="text-sm font-medium text-ink/80">
                <span className="font-bold">Diversity floor</span> — reserves a
                few spots for outliers so the room isn&rsquo;t an echo chamber.
              </span>
            </label>
          )}
        </div>
        <p className="text-xs font-medium text-muted">
          Host&rsquo;s pinned picks (bypass the algorithm) coming next.
        </p>
      </section>

      {err && <p className="text-center text-sm font-bold text-flockie-orange">{err}</p>}

      <button
        type="submit"
        disabled={saving || uploading}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create Vibe"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
