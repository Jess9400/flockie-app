"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { intlLocale } from "@/lib/date-locale";
import { createClient } from "@/lib/supabase/client";
import { geocodeVibeLocation } from "@/lib/gmaps-geocode";
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
  area: string | null;
  country: string | null;
};

export type VibeClone = {
  title?: string;
  description?: string;
  category?: string;
  categories?: string[];
  activityUrl?: string;
  photos?: string[];
  country?: string;
  city?: string;
  area?: string;
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

const CATEGORY_TAG_SUGGESTIONS: Record<string, string[]> = {
  coffee: ["chill", "quiet", "social"],
  dinner: ["social", "chill", "creative"],
  nightlife: ["party", "energetic", "social"],
  hiking: ["energetic", "social", "beginner-friendly"],
  running: ["energetic", "competitive", "social"],
  cycling: ["energetic", "competitive", "social"],
  climbing: ["energetic", "competitive", "beginner-friendly"],
  surf: ["energetic", "social", "beginner-friendly"],
  yoga: ["spiritual", "chill", "beginner-friendly"],
  dance: ["energetic", "social", "creative"],
  painting: ["creative", "chill", "educational"],
  photography: ["creative", "educational", "chill"],
  music: ["creative", "social", "energetic"],
  cooking: ["creative", "social", "educational"],
  wellness: ["spiritual", "chill", "quiet"],
  coworking: ["quiet", "educational", "chill"],
};

export default function CreateVibeForm({
  userId,
  defaultCity,
  defaultActivityUrl = "",
  defaultTitle = "",
  clone,
  clubId,
}: {
  userId: string;
  defaultCity: string;
  defaultActivityUrl?: string;
  defaultTitle?: string;
  clone?: VibeClone;
  clubId?: string;
}) {
  const supabase = createClient();
  const t = useTranslations("vibes");
  const locale = useLocale();
  const tc = useTranslations("components");
  const catLabel = (c: string) =>
    t.has(`categories.${c}`) ? t(`categories.${c}`) : formatActivityLabel(c);
  const tagLabel = (tag: string) => (t.has(`eventTags.${tag}`) ? t(`eventTags.${tag}`) : tag);
  const skillLabel = (value: number | null, fallback: string) => {
    const key = value === null ? "any" : value === 1 ? "beginner" : value === 3 ? "intermediate" : value === 4 ? "advanced" : null;
    return key && t.has(`skill.${key}`) ? t(`skill.${key}`) : fallback;
  };

  const [createdId, setCreatedId] = useState<string | null>(null);
  const [title, setTitle] = useState(clone?.title ?? defaultTitle);
  const [description, setDescription] = useState(clone?.description ?? "");
  // "What are you doing?" supports multiple activities. `category` (the first
  // pick) stays the single, NOT-NULL value the matching algo + display use; the
  // full set is stored in `categories`.
  const [categories, setCategories] = useState<string[]>(
    clone?.categories?.length ? clone.categories : clone?.category ? [clone.category] : []
  );
  const category = categories[0] ?? "";
  const [customActivity, setCustomActivity] = useState("");
  const [activityUrl, setActivityUrl] = useState(clone?.activityUrl ?? defaultActivityUrl);
  const [photos, setPhotos] = useState<string[]>(clone?.photos ?? []);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [durationOption, setDurationOption] = useState<number | "custom">(120);
  const [customDurationMinutes, setCustomDurationMinutes] = useState(90);
  const [deadline, setDeadline] = useState("");
  const [country, setCountry] = useState(clone?.country ?? "");
  const [city, setCity] = useState(clone?.city ?? defaultCity ?? "");
  const [area, setArea] = useState(clone?.area ?? "");
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
      setErr(t("create.errPhotoUpload"));
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

  function seedActivity(nextCategory: string) {
    const has = categories.includes(nextCategory);
    // Toggle: tap to add (unlimited), tap again to remove.
    setCategories(has ? categories.filter((c) => c !== nextCategory) : [...categories, nextCategory]);
    // Seed vibe tags from the first activity chosen (don't clobber later edits).
    if (!has && categories.length === 0) {
      const suggested = suggestedTagsForActivity(nextCategory);
      if (suggested.length > 0) setTags(suggested.slice(0, EVENT_VIBE_TAGS_MAX));
    }
  }

  function useCustomActivity() {
    const next = normalizeActivity(customActivity);
    if (!next) return;
    seedActivity(next);
    setCustomActivity("");
  }

  function onLocationChange(value: string) {
    setLocationName(value);
    setLocationLat(null);
    setLocationLng(null);
    setResolvedLocation(null);
    setLocationMsg(null);
  }

  async function findExactLocation() {
    if (!locationName.trim()) return;
    setResolvingLocation(true);
    setLocationMsg(null);
    try {
      // Geocode in the browser with the Maps key (works with the referrer
      // restriction, unlike the server route) — same engine as Google Maps.
      // Robust to a mismatched city (address alone is tried as a fallback).
      const place = await geocodeVibeLocation(locationName, city);
      if (!place) {
        setResolvedLocation(null);
        setLocationMsg(t("create.locationMsgNoPin"));
        return;
      }
      setResolvedLocation(place);
      setLocationLat(place.lat);
      setLocationLng(place.lng);
      // The city/area come from the VENUE, not the host's profile — so a vibe in
      // another city gets the right public city automatically.
      if (place.city) setCity(place.city);
      if (place.area && !area.trim()) setArea(place.area);
      setLocationMsg(t("create.locationMsgFound"));
    } catch {
      setResolvedLocation(null);
      setLocationMsg(t("create.locationMsgFailed"));
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
    if (resolvedLocation.area) setArea(resolvedLocation.area);
    if (resolvedLocation.country) setCountry(resolvedLocation.country);
    setLocationMsg(t("create.locationMsgAdded"));
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

  function changeCustomDuration(hoursValue: string) {
    // Entered in hours (1–24); stored internally as minutes.
    const hours = Math.min(24, Math.max(1, Number(hoursValue) || 1));
    const next = Math.round(hours * 60);
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

    if (!title || !description || !category || !startsAt || !endsAt || !deadline || !city || !country) {
      return setErr(t("create.errFillRequired"));
    }
    if (!locationName.trim()) {
      return setErr(t("create.errLocationRequired"));
    }
    if (photos.length === 0) {
      return setErr(t("create.errPhotoRequired"));
    }
    if (tags.length === 0) {
      return setErr(t("create.errTagRequired"));
    }
    if (new Date(deadline) >= new Date(startsAt)) {
      return setErr(t("create.errDeadlineBeforeStart"));
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      return setErr(t("create.errEndAfterStart"));
    }
    if (!language) {
      return setErr(t("create.errPickLanguage"));
    }
    if (ageMin > ageMax) {
      return setErr(t("create.errAgeOrder"));
    }

    setSaving(true);

    // Always capture coordinates so every vibe gets an exact map pin — even if
    // the host never tapped "find exact location". Geocode from the typed
    // location + city; on any failure just save without coords (the map link
    // then falls back to the city). We keep the host's typed location_name as-is
    // (the pin comes from lat/lng now, not the text).
    let coordLat = locationLat;
    let coordLng = locationLng;
    if ((coordLat == null || coordLng == null) && locationName.trim()) {
      try {
        const place = await geocodeVibeLocation(locationName, city);
        if (place) {
          coordLat = place.lat;
          coordLng = place.lng;
        }
      } catch {
        // ignore — save the vibe without coords
      }
    }

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
        categories,
        photos,
        country,
        city,
        area: area.trim() || null,
        location_name: locationName || null,
        location_lat: coordLat,
        location_lng: coordLng,
        activity_url: activityUrl.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        signup_deadline: new Date(deadline).toISOString(),
        // The tz the host entered the time in — pairs with starts_at (a UTC
        // instant) so we can render the correct local wall-clock time everywhere.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        club_id: clubId ?? null,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error) return setErr(error.message);
    setCreatedId(data.id);
  }

  const suggestedTags = suggestedTagsForActivity(category);

  if (createdId) {
    return (
      <div className="rounded-3xl border border-ink/15 bg-white p-6 text-center shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
        <p className="text-4xl">🎉</p>
        <h2 className="mt-2 font-fredoka text-2xl font-bold text-ink">{t("create.successTitle")}</h2>
        <p className="mt-1 font-nunito text-sm font-medium text-muted">
          {t("create.successBody")}
        </p>
        <div className="mt-5 flex justify-center">
          <ShareVibeButton vibeId={createdId} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/vibes/${createdId}`}
            className="rounded-2xl border border-ink/15 bg-flockie-blue py-2.5 text-center font-fredoka text-sm font-semibold text-white"
          >
            {t("create.viewYourVibe")}
          </Link>
          <Link
            href={clubId ? `/clubs/${clubId}` : "/vibes"}
            className="rounded-2xl border border-ink/15 bg-white py-2.5 text-center font-fredoka text-sm font-semibold text-ink"
          >
            {clubId ? t("create.backToClub") : t("create.backToVibes")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8 pb-8">
      {/* Basics */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("create.sectionBasics")}</h2>
        <Field label={t("create.fieldTitle")}>
          <input
            className={inputCls}
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("create.titlePlaceholder")}
          />
        </Field>

        <Field label={t("create.fieldPhotos")}>
          <div className="flex flex-wrap justify-center gap-2">
            {photos.map((url, i) => (
              <div
                key={url}
                className="relative h-28 w-28 overflow-hidden rounded-2xl border border-ink/15"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
                  aria-label={t("create.removePhoto")}
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
            <p className="mt-1 text-sm font-semibold text-flockie-orange">{t("create.uploading")}</p>
          )}
          {photos.length < MAX_PHOTOS && (
            <GenerateCoverButton
              userId={userId}
              prompt={[title, category].filter(Boolean).join(", ")}
              disabled={uploading}
              onUploaded={(url) => setPhotos((p) => [...p, url].slice(0, MAX_PHOTOS))}
            />
          )}
        </Field>

        <Field label={t("create.fieldDescription")}>
          <textarea
            className={`${inputCls} h-28 resize-none`}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("create.descriptionPlaceholder")}
          />
        </Field>
        <Field label={t("create.fieldWhatToBring")}>
          <textarea
            className={`${inputCls} h-20 resize-none`}
            maxLength={300}
            value={whatToBring}
            onChange={(e) => setWhatToBring(e.target.value)}
            placeholder={t("create.whatToBringPlaceholder")}
          />
        </Field>
        <Field label={t("create.fieldActivity")}>
          <div className="grid grid-cols-2 gap-2">
            {VIBE_CATEGORIES.filter((c) => c !== "other").map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => seedActivity(c)}
                className={`rounded-2xl border border-ink/15 px-3 py-2 text-left text-sm font-bold ${
                  categories.includes(c) ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {catLabel(c)}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              className={inputCls}
              maxLength={32}
              value={customActivity}
              onChange={(e) => setCustomActivity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  useCustomActivity();
                }
              }}
              placeholder={t("create.customActivityPlaceholder")}
            />
            <button
              type="button"
              onClick={useCustomActivity}
              className="rounded-2xl border border-ink/15 bg-white px-4 text-sm font-bold"
            >
              {t("create.use")}
            </button>
          </div>
          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => seedActivity(c)}
                  className="flex items-center gap-1 rounded-full border border-ink/15 bg-flockie-blue px-2.5 py-1 text-xs font-bold text-white"
                >
                  {catLabel(c)} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs font-medium text-muted">
            {t("create.activityHelp")}
          </p>
        </Field>
        <Field label={t("create.fieldActivityLink")}>
          <input
            className={inputCls}
            value={activityUrl}
            onChange={(e) => setActivityUrl(e.target.value)}
            placeholder={t("create.activityLinkPlaceholder")}
          />
          <p className="mt-1 text-xs font-medium text-muted">
            {t("create.activityLinkHelp")}
          </p>
        </Field>
      </section>

      {/* When & where */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("create.sectionWhen")}</h2>
        <Field label={t("create.fieldStart")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              className={inputCls}
              value={datePart(startsAt)}
              onChange={(e) => onStartDateChange(e.target.value)}
              aria-label={t("create.startDateAria")}
            />
            <input
              type="time"
              className={inputCls}
              value={timePart(startsAt)}
              onChange={(e) => onStartTimeChange(e.target.value)}
              aria-label={t("create.startTimeAria")}
            />
          </div>
        </Field>
        <Field label={t("create.fieldDuration")}>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pickDuration(o.value)}
                className={`rounded-full border border-ink/15 px-4 py-2 text-sm font-bold ${
                  durationOption === o.value ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => pickDuration("custom")}
              className={`rounded-full border border-ink/15 px-4 py-2 text-sm font-bold ${
                durationOption === "custom" ? "bg-flockie-blue text-white" : "bg-white"
              }`}
            >
              {t("create.custom")}
            </button>
          </div>
          {durationOption === "custom" && (
            <div className="mt-2">
              <input
                type="number"
                min={1}
                max={24}
                step={0.5}
                className={inputCls}
                value={customDurationMinutes / 60}
                onChange={(e) => changeCustomDuration(e.target.value)}
                aria-label={t("create.customDurationAria")}
              />
              <p className="mt-1 text-xs font-medium text-muted">{t("create.customDurationHelp")}</p>
            </div>
          )}
          <div className="mt-3 rounded-2xl border border-ink/15 bg-cream p-3 text-sm font-bold">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {t("create.preview")}
            </p>
            <div className="mt-2 grid gap-1 text-ink/80">
              <p>
                <span className="text-muted">{t("create.starts")}</span>{" "}
                {startsAt ? prettyDateTime(startsAt, locale) : t("create.chooseDateTime")}
              </p>
              <p>
                <span className="text-muted">{t("create.ends")}</span>{" "}
                {endsAt ? prettyDateTime(endsAt, locale) : t("create.calculatedFromDuration")}
              </p>
            </div>
          </div>
        </Field>
        <Field label={t("create.fieldInterestWindow")}>
          <div className="flex flex-wrap gap-2">
            {[24, 48].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setWindow(h)}
                className={`rounded-full border border-ink/15 px-4 py-2 text-sm font-bold ${
                  interestWindow === h ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {t("create.windowIn", { hours: h })}
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
            {t("create.interestWindowHelp")}
          </p>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("create.fieldCountry")}>
            <input
              className={inputCls}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={t("create.countryPlaceholder")}
              required
            />
          </Field>
          <Field label={t("create.fieldCity")}>
            <input
              className={inputCls}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("create.cityPlaceholder")}
              required
            />
          </Field>
          <Field label={t("create.fieldArea")}>
            <input
              className={inputCls}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={t("create.areaPlaceholder")}
            />
          </Field>
        </div>
        <p className="-mt-1 text-xs font-medium text-muted">
          {t("create.approxHelp")}
        </p>
        <Field label={t("create.fieldExactLocation")}>
          <input
            className={inputCls}
            value={locationName}
            onChange={(e) => onLocationChange(e.target.value)}
            onBlur={() => {
              // Auto-pin the exact coordinates when the host finishes typing —
              // no need to tap the button. Only if not already pinned.
              if (locationLat == null && locationName.trim().length >= 3 && city.trim()) {
                findExactLocation();
              }
            }}
            placeholder={t("create.exactLocationPlaceholder")}
            required
          />
          {locationLat != null && locationLng != null ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#06D6A0]/15 px-3 py-1.5 text-xs font-extrabold text-ink">
              {t("create.exactLocationPinned")}
            </p>
          ) : (
            <button
              type="button"
              onClick={findExactLocation}
              disabled={resolvingLocation || locationName.trim().length < 3}
              className="mt-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              {resolvingLocation ? t("create.findingPin") : t("create.findExactPin")}
            </button>
          )}
          {resolvedLocation && locationLat == null && (
            <div className="mt-2 rounded-2xl border border-ink/15 bg-cream p-3">
              <p className="text-xs font-extrabold text-muted">{t("create.suggestedAddress")}</p>
              <p className="mt-1 text-sm font-bold text-ink">{resolvedLocation.label}</p>
              <button
                type="button"
                onClick={useResolvedLocation}
                className="mt-2 rounded-full border border-ink/15 bg-flockie-blue px-4 py-2 text-xs font-bold text-white"
              >
                {t("create.useThisAddress")}
              </button>
            </div>
          )}
          {locationName.trim().length > 2 && (
            <iframe
              title={t("create.locationPreviewTitle")}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                locationLat != null && locationLng != null
                  ? `${locationLat},${locationLng}`
                  : `${locationName}${city ? ", " + city : ""}`
              )}&z=15&output=embed`}
              loading="lazy"
              className="mt-2 h-44 w-full rounded-2xl border border-ink/15"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          {locationMsg && (
            <p className="mt-1 text-xs font-bold text-flockie-orange">{locationMsg}</p>
          )}
          <p className="mt-1 text-xs font-medium text-muted">
            {t("create.exactLocationHelp")}
          </p>
        </Field>
      </section>

      {/* Who's invited */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("create.sectionWho")}</h2>
        <Field label={t("create.capacity", { count: capacity })}>
          <input
            type="range"
            min={3}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full accent-flockie-orange"
          />
        </Field>
        <Field label={t("create.openTo")}>
          <div className="grid grid-cols-3 gap-2">
            {["any", "women", "men"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setGenderPref(v)}
                className={`rounded-full border border-ink/15 py-2 text-sm font-bold ${
                  genderPref === v ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {t(`genderPref.${v}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t("create.algoFill")}>
          <div className="grid grid-cols-3 gap-2">
            {[50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAlgoShare(p)}
                className={`rounded-full border border-ink/15 py-2 text-sm font-bold ${
                  algoShare === p ? "bg-flockie-blue text-white" : "bg-white"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            {algoShare === 100
              ? t("create.algoFillFull")
              : t("create.algoFillPartial", { pct: algoShare })}
          </p>
        </Field>

        <Field label={t("create.eventLanguage")}>
          <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">{t("create.selectPlaceholder")}</option>
            {FLOCK_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {tc(`languages.${l}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("create.ageRange")}>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={16}
              max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(Number(e.target.value))}
              className={inputCls}
              aria-label={t("create.ageMinAria")}
            />
            <span className="font-bold text-muted">{t("create.to")}</span>
            <input
              type="number"
              min={16}
              max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value))}
              className={inputCls}
              aria-label={t("create.ageMaxAria")}
            />
          </div>
          <p className="mt-1 text-xs font-medium text-muted">{t("create.ageHelp")}</p>
        </Field>

        <Field label={t("create.requiredSkill")}>
          <select
            className={inputCls}
            value={skill === null ? "" : skill}
            onChange={(e) => setSkill(e.target.value === "" ? null : Number(e.target.value))}
          >
            {SKILL_REQUIREMENTS.map((s) => (
              <option key={s.label} value={s.value === null ? "" : s.value}>
                {skillLabel(s.value, s.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("create.eventVibeTags", { count: tags.length, max: EVENT_VIBE_TAGS_MAX })}>
          <div className="flex flex-wrap gap-2">
            {EVENT_VIBE_TAGS.map((tag) => {
              const on = tags.includes(tag);
              const suggested = suggestedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
                    on
                      ? suggested
                        ? "border-ink bg-flockie-orange text-white"
                        : "border-ink bg-flockie-blue text-white"
                      : suggested
                        ? "border-dashed border-ink bg-cream"
                        : "border-ink bg-white"
                  }`}
                >
                  {suggested && !on ? "+ " : ""}
                  {tagLabel(tag)}
                  {suggested && on ? ` · ${t("create.suggested")}` : ""}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            {t("create.eventVibeTagsHelp")}
          </p>
        </Field>
        <Field label={t("create.dealbreakerRules")}>
          <div className="flex flex-wrap gap-2">
            {DEALBREAKER_RULES.map((r) => {
              const on = !!rules[r.key];
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRules({ ...rules, [r.key]: !on })}
                  className={`rounded-full border border-ink/15 px-3 py-1 text-xs font-bold ${
                    on ? "bg-ink text-white" : "bg-white"
                  }`}
                >
                  {t.has(`rules.${r.key}`) ? t(`rules.${r.key}`) : r.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Advanced */}
        <div className="rounded-2xl border border-ink/15 bg-white p-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-extrabold"
          >
            {t("create.advancedSettings")}
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
                {t.rich("create.diversityFloor", { b: (chunks) => <span className="font-bold">{chunks}</span> })}
              </span>
            </label>
          )}
        </div>
        <p className="text-xs font-medium text-muted">
          {t("create.pinnedComing")}
        </p>
      </section>

      {err && <p className="text-center text-sm font-bold text-flockie-orange">{err}</p>}

      <button
        type="submit"
        disabled={saving || uploading}
        className="w-full rounded-full border border-ink/15 bg-flockie-orange py-3.5 font-bold text-white shadow-[0_2px_10px_rgba(10,37,69,0.08)] disabled:opacity-50"
      >
        {saving ? t("create.creating") : clubId ? t("create.scheduleGathering") : t("create.createVibe")}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-2xl border border-ink/25 bg-white px-4 py-2.5 font-medium outline-none";

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

function prettyDateTime(value: string, locale = "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Choose date + time";
  return new Intl.DateTimeFormat(intlLocale(locale), {
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

function normalizeActivity(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function formatActivityLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function suggestedTagsForActivity(activity: string) {
  const value = activity.trim().toLowerCase();
  if (!value) return [];

  const mapped = CATEGORY_TAG_SUGGESTIONS[value];
  if (mapped) return mapped.filter((tag) => EVENT_VIBE_TAGS.includes(tag as (typeof EVENT_VIBE_TAGS)[number]));

  const inferred = new Set<string>();
  if (/(run|hike|gym|sport|tennis|padel|football|bike|cycle|climb|swim|surf|dance)/i.test(value)) {
    inferred.add("energetic");
    inferred.add("social");
    inferred.add("beginner-friendly");
  }
  if (/(paint|photo|pottery|art|craft|music|karaoke|write|book|cook|workshop)/i.test(value)) {
    inferred.add("creative");
    inferred.add("social");
  }
  if (/(learn|class|lesson|language|study|cowork|work|focus)/i.test(value)) {
    inferred.add("educational");
    inferred.add("quiet");
  }
  if (/(coffee|tea|walk|brunch|picnic|museum|book)/i.test(value)) {
    inferred.add("chill");
    inferred.add("quiet");
  }
  if (/(drink|bar|party|club|night|karaoke)/i.test(value)) {
    inferred.add("party");
    inferred.add("energetic");
    inferred.add("social");
  }

  const tags = Array.from(inferred).filter((tag) =>
    EVENT_VIBE_TAGS.includes(tag as (typeof EVENT_VIBE_TAGS)[number])
  );
  return tags.length > 0 ? tags.slice(0, 3) : ["social", "chill", "beginner-friendly"];
}
