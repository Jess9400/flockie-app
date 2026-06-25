"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ShareVibeButton from "@/components/ShareVibeButton";
import GenerateCoverButton from "@/components/GenerateCoverButton";
import {
  VIBE_CATEGORIES,
  EVENT_VIBE_TAGS,
  EVENT_VIBE_TAGS_MAX,
  DEALBREAKER_RULES,
  SKILL_REQUIREMENTS,
} from "@/lib/vibes";
import { FLOCK_LANGUAGES } from "@/lib/trips";

const MAX_PHOTOS = 5;
const DURATION_OPTIONS = [
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
] as const;

type ResolvedLocation = {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
};

export type VibeClone = {
  title?: string;
  description?: string;
  category?: string;
  activityUrl?: string;
  photos?: string[];
  city?: string;
  locationName?: string;
  capacity?: number;
  genderPref?: string;
  algoShare?: number;
  whatToBring?: string;
  language?: string;
  ageMin?: number;
  ageMax?: number;
  skill?: number | null;
  tags?: string[];
  rules?: Record<string, boolean>;
  diversity?: boolean;
};

export default function CreateVibeForm({
  userId,
  defaultCity,
  defaultActivityUrl = "",
  defaultTitle = "",
  clone,
}: {
  userId: string;
  defaultCity: string;
  defaultActivityUrl?: string;
  defaultTitle?: string;
  clone?: VibeClone;
}) {
  const supabase = createClient();

  const [createdId, setCreatedId] = useState<string | null>(null);
  const [title, setTitle] = useState(clone?.title ?? defaultTitle);
  const [description, setDescription] = useState(clone?.description ?? "");
  const [category, setCategory] = useState(clone?.category ?? "");
  const [activityUrl, setActivityUrl] = useState(clone?.activityUrl ?? defaultActivityUrl);
  const [photos, setPhotos] = useState<string[]>(clone?.photos ?? []);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [durationOption, setDurationOption] = useState<number | "custom">(120);
  const [customDurationMinutes, setCustomDurationMinutes] = useState(90);
  const [deadline, setDeadline] = useState("");
  const [city, setCity] = useState(clone?.city ?? defaultCity ?? "");
  const [locationName, setLocationName] = useState(clone?.locationName ?? "");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(clone?.capacity ?? 10);
  const [genderPref, setGenderPref] = useState(clone?.genderPref ?? "any");
  const [algoShare, setAlgoShare] = useState(clone?.algoShare ?? 100);
  const [interestWindow, setInterestWindow] = useState<number | null>(null);
  const [whatToBring, setWhatToBring] = useState(clone?.whatToBring ?? "");
  const [language, setLanguage] = useState(clone?.language ?? "");
  const [ageMin, setAgeMin] = useState(clone?.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState(clone?.ageMax ?? 99);
  const [skill, setSkill] = useState<number | null>(clone?.skill ?? null);
  const [tags, setTags] = useState<string[]>(clone?.tags ?? []);
  const [rules, setRules] = useState<Record<string, boolean>>(clone?.rules ?? {});
  const [diversity, setDiversity] = useState(clone?.diversity ?? false);
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

  function onLocationChange(value: string) {
    setLocationName(value);
    setLocationLat(null);
    setLocationLng(null);
    setResolvedLocation(null);
    setLocationMsg(null);
  }

  async function findExactLocation() {
    const query = [locationName.trim(), city.trim()].filter(Boolean).join(", ");
    if (!query) return;
    setResolvingLocation(true);
    setLocationMsg(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setResolvedLocation(null);
        setLocationMsg("Couldn’t find a clear pin. Try adding a street, area, or venue name.");
        return;
      }
      setResolvedLocation(data as ResolvedLocation);
      setLocationLat(data.lat);
      setLocationLng(data.lng);
      setLocationMsg("Found a likely exact pin. Use it if the address looks right.");
    } catch {
      setResolvedLocation(null);
      setLocationMsg("Map lookup failed. You can still type the location manually.");
    } finally {
      setResolvingLocation(false);
    }
  }

  function useResolvedLocation() {
    if (!resolvedLocation) return;
    setLocationName(resolvedLocation.label);
    setLocationLat(resolvedLocation.lat);
    setLocationLng(resolvedLocation.lng);
    if (resolvedLocation.city) setCity(resolvedLocation.city);
    setLocationMsg("Exact address added to the location line.");
  }

  function activeDurationMinutes(option = durationOption, custom = customDurationMinutes) {
    return option === "custom" ? custom : option;
  }

  function applyEndTime(nextStartsAt: string, nextDurationMinutes = activeDurationMinutes()) {
    if (!nextStartsAt || nextDurationMinutes <= 0) return;
    const start = new Date(nextStartsAt);
    if (Number.isNaN(start.getTime())) return;
    setEndsAt(toLocalDateTimeInput(new Date(start.getTime() + nextDurationMinutes * 60 * 1000)));
  }

  function onStartDateChange(value: string) {
    const nextStartsAt = value ? `${value}T${timePart(startsAt) || "18:00"}` : "";
    setStartsAt(nextStartsAt);
    applyEndTime(nextStartsAt);
  }

  function onStartTimeChange(value: string) {
    const currentDate = datePart(startsAt) || datePart(toLocalDateTimeInput(new Date()));
    const nextStartsAt = value ? `${currentDate}T${value}` : "";
    setStartsAt(nextStartsAt);
    applyEndTime(nextStartsAt);
  }

  function pickDuration(value: number | "custom") {
    setDurationOption(value);
    applyEndTime(startsAt, activeDurationMinutes(value));
  }

  function changeCustomDuration(value: string) {
    const next = Math.max(15, Number(value || 15));
    setCustomDurationMinutes(next);
    if (durationOption === "custom") applyEndTime(startsAt, next);
  }

  function setWindow(hours: number) {
    setInterestWindow(hours);
    const d = new Date(Date.now() + hours * 3600 * 1000);
    setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title || !description || !category || !startsAt || !endsAt || !deadline || !city) {
      return setErr("Please fill in all required fields.");
    }
    if (!locationName.trim()) {
      return setErr("A location is required — it's sent to attendees and pinned in the chat.");
    }
    if (photos.length === 0) {
      return setErr("Add at least one cover photo — upload one or generate it.");
    }
    if (tags.length === 0) {
      return setErr("Pick at least one event vibe tag — it powers the matching.");
    }
    if (new Date(deadline) >= new Date(startsAt)) {
      return setErr("Signup deadline must be before the start time.");
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      return setErr("End time must be after the start time.");
    }
    if (!language) {
      return setErr("Pick the event's main language.");
    }
    if (ageMin > ageMax) {
      return setErr("Minimum age can't be greater than the maximum age.");
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
        location_lat: locationLat,
        location_lng: locationLng,
        activity_url: activityUrl.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        signup_deadline: new Date(deadline).toISOString(),
        capacity,
        gender_pref: genderPref,
        algo_share: algoShare,
        interest_window_hours: interestWindow,
        what_to_bring: whatToBring.trim() || null,
        language,
        age_min: ageMin,
        age_max: ageMax,
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
    setCreatedId(data.id);
  }

  if (createdId) {
    return (
      <div className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-[0_6px_0_0_rgba(10,37,69,1)]">
        <p className="text-4xl">🎉</p>
        <h2 className="mt-2 font-fredoka text-2xl font-bold text-ink">Your Vibe is live!</h2>
        <p className="mt-1 font-nunito text-sm font-medium text-muted">
          Share it to invite people. They tap &ldquo;I&rsquo;m interested&rdquo; and the
          algorithm builds the room from the most compatible.
        </p>
        <div className="mt-5 flex justify-center">
          <ShareVibeButton vibeId={createdId} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={`/vibes/${createdId}`}
            className="rounded-full border-2 border-ink bg-flockie-blue py-2.5 font-fredoka text-sm font-semibold text-white"
          >
            View your Vibe
          </Link>
          <Link
            href="/vibes"
            className="rounded-full border-2 border-ink bg-white py-2.5 font-fredoka text-sm font-semibold text-ink"
          >
            Back to Vibes
          </Link>
        </div>
      </div>
    );
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

        <Field label="Cover photos (required · up to 5)">
          <div className="flex flex-wrap justify-center gap-2">
            {photos.map((url, i) => (
              <div
                key={url}
                className="relative h-28 w-28 overflow-hidden rounded-2xl border-2 border-ink"
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
                className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-ink/40 text-2xl text-muted"
              >
                +
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
          {uploading && (
            <p className="mt-1 text-sm font-semibold text-flockie-orange">Uploading…</p>
          )}
          {photos.length < MAX_PHOTOS && (
            <GenerateCoverButton
              userId={userId}
              prompt={[title, category, city ? `in ${city}` : ""].filter(Boolean).join(", ")}
              disabled={uploading}
              onUploaded={(url) => setPhotos((p) => [...p, url].slice(0, MAX_PHOTOS))}
            />
          )}
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
        <Field label="What to bring / cost split (optional)">
          <textarea
            className={`${inputCls} h-20 resize-none`}
            maxLength={300}
            value={whatToBring}
            onChange={(e) => setWhatToBring(e.target.value)}
            placeholder="e.g. Bring a towel & $10 for the boards — we split the taco bill."
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
        <Field label="Activity link (optional)">
          <input
            className={inputCls}
            value={activityUrl}
            onChange={(e) => setActivityUrl(e.target.value)}
            placeholder="Paste a GetYourGuide (or any) activity link"
          />
          <p className="mt-1 text-xs font-medium text-muted">
            Everyone who gets in receives this link, on the Vibe and in the chat.
          </p>
        </Field>
      </section>

      {/* When & where */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">When &amp; where</h2>
        <Field label="Start date & time">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              className={inputCls}
              value={datePart(startsAt)}
              onChange={(e) => onStartDateChange(e.target.value)}
              aria-label="Start date"
            />
            <input
              type="time"
              className={inputCls}
              value={timePart(startsAt)}
              onChange={(e) => onStartTimeChange(e.target.value)}
              aria-label="Start time"
            />
          </div>
        </Field>
        <Field label="How long is it?">
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pickDuration(o.value)}
                className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold ${
                  durationOption === o.value ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => pickDuration("custom")}
              className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold ${
                durationOption === "custom" ? "bg-flockie-blue text-white" : "bg-white"
              }`}
            >
              Custom
            </button>
          </div>
          {durationOption === "custom" && (
            <input
              type="number"
              min={15}
              step={15}
              className={`${inputCls} mt-2`}
              value={customDurationMinutes}
              onChange={(e) => changeCustomDuration(e.target.value)}
              aria-label="Custom duration in minutes"
            />
          )}
          <div className="mt-3 rounded-2xl border-2 border-ink bg-cream p-3 text-sm font-bold">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              Preview
            </p>
            <div className="mt-2 grid gap-1 text-ink/80">
              <p>
                <span className="text-muted">Starts:</span>{" "}
                {startsAt ? prettyDateTime(startsAt) : "Choose date + time"}
              </p>
              <p>
                <span className="text-muted">Ends:</span>{" "}
                {endsAt ? prettyDateTime(endsAt) : "Calculated from duration"}
              </p>
            </div>
          </div>
        </Field>
        <Field label="Interest window — when matching runs">
          <div className="flex flex-wrap gap-2">
            {[
              { h: 24, l: "In 24h" },
              { h: 48, l: "In 48h" },
            ].map((o) => (
              <button
                key={o.h}
                type="button"
                onClick={() => setWindow(o.h)}
                className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold ${
                  interestWindow === o.h ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            className={`${inputCls} mt-2`}
            value={deadline}
            onChange={(e) => {
              setInterestWindow(null);
              setDeadline(e.target.value);
            }}
          />
          <p className="mt-1 text-xs font-medium text-muted">
            Interest stays open until this time, then the algorithm ranks everyone and builds your list.
          </p>
        </Field>
        <Field label="City">
          <input
            className={inputCls}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Lisbon"
          />
        </Field>
        <Field label="Location (sent to attendees + pinned in chat)">
          <input
            className={inputCls}
            value={locationName}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Venue name, street, or Google Maps address"
            required
          />
          <button
            type="button"
            onClick={findExactLocation}
            disabled={resolvingLocation || locationName.trim().length < 3}
            className="mt-2 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {resolvingLocation ? "Finding pin…" : "Find exact pin"}
          </button>
          {resolvedLocation && (
            <div className="mt-2 rounded-2xl border-2 border-ink bg-cream p-3">
              <p className="text-xs font-extrabold text-muted">Suggested exact address</p>
              <p className="mt-1 text-sm font-bold text-ink">{resolvedLocation.label}</p>
              <button
                type="button"
                onClick={useResolvedLocation}
                className="mt-2 rounded-full border-2 border-ink bg-flockie-blue px-4 py-2 text-xs font-bold text-white"
              >
                Use this address
              </button>
            </div>
          )}
          {locationName.trim().length > 2 && (
            <iframe
              title="Location preview"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                resolvedLocation?.lat != null && resolvedLocation?.lng != null
                  ? `${resolvedLocation.lat},${resolvedLocation.lng}`
                  : `${locationName}${city ? ", " + city : ""}`
              )}&z=15&output=embed`}
              loading="lazy"
              className="mt-2 h-44 w-full rounded-2xl border-2 border-ink"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          {locationMsg && (
            <p className="mt-1 text-xs font-bold text-flockie-orange">{locationMsg}</p>
          )}
          <p className="mt-1 text-xs font-medium text-muted">
            Check the pin is right. If the suggested address is correct, add it to the line so attendees see the exact place.
          </p>
        </Field>
      </section>

      {/* Who's invited */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Who&rsquo;s invited</h2>
        <Field label={`Capacity: ${capacity}`}>
          <input
            type="range"
            min={3}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full accent-flockie-orange"
          />
        </Field>
        <Field label="Open to">
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "any", l: "Everyone" },
              { v: "women", l: "Women only" },
              { v: "men", l: "Men only" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setGenderPref(o.v)}
                className={`rounded-full border-2 border-ink py-2 text-sm font-bold ${
                  genderPref === o.v ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </Field>

        <Field label="How much should the algorithm fill?">
          <div className="grid grid-cols-3 gap-2">
            {[50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAlgoShare(p)}
                className={`rounded-full border-2 border-ink py-2 text-sm font-bold ${
                  algoShare === p ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            {algoShare === 100
              ? "The algorithm fills the whole room."
              : `The algorithm fills ${algoShare}% — the rest are yours to invite via your private link.`}
          </p>
        </Field>

        <Field label="Event language">
          <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Select…</option>
            {FLOCK_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Age range">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={16}
              max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(Number(e.target.value))}
              className={inputCls}
              aria-label="Minimum age"
            />
            <span className="font-bold text-muted">to</span>
            <input
              type="number"
              min={16}
              max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value))}
              className={inputCls}
              aria-label="Maximum age"
            />
          </div>
          <p className="mt-1 text-xs font-medium text-muted">Leave 18–99 for any age.</p>
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
        <Field label={`Event vibe tags (pick at least 1 · max ${EVENT_VIBE_TAGS_MAX})`}>
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
        <Field label="Dealbreaker rules (optional)">
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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalDateTimeInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function datePart(value: string) {
  return value.slice(0, 10);
}

function timePart(value: string) {
  return value.slice(11, 16);
}

function prettyDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Choose date + time";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
