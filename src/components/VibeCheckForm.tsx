"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  GENDERS,
  RELATIONSHIP_STATUS,
  SEASONS,
  PLANNING_STYLE,
  MBTI_TYPES,
  HOBBIES,
  ACTIVITIES,
  type VibeCheck,
} from "@/lib/vibe-check";

type Props = {
  userId: string;
  initial: Partial<VibeCheck>;
};

const MAX_PHOTOS = 5;

export default function VibeCheckForm({ userId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<Partial<VibeCheck>>({
    display_name: "",
    bio: "",
    photos: [],
    hobbies: [],
    favorite_activities: [],
    places_visited: [],
    ...initial,
  });
  const [placeInput, setPlaceInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  function set<K extends keyof VibeCheck>(key: K, value: VibeCheck[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleChip(key: "hobbies" | "favorite_activities", value: string) {
    const list = (form[key] as string[]) ?? [];
    set(
      key,
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value]
    );
  }

  async function uploadFile(bucket: "avatars" | "videos", file: File) {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setMsg(null);
    try {
      const current = form.photos ?? [];
      const room = MAX_PHOTOS - current.length;
      const urls: string[] = [];
      for (const file of files.slice(0, room)) {
        urls.push(await uploadFile("avatars", file));
      }
      set("photos", [...current, ...urls]);
    } catch {
      setMsg("Photo upload failed. Try again.");
    } finally {
      setUploading(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      set("video_url", await uploadFile("videos", file));
    } catch {
      setMsg("Video upload failed. Try again.");
    } finally {
      setUploading(false);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  function addPlace() {
    const v = placeInput.trim();
    if (!v) return;
    const list = form.places_visited ?? [];
    if (!list.includes(v)) set("places_visited", [...list, v]);
    setPlaceInput("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, onboarding_complete: true })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Saved! Your vibe check is live.");
    router.refresh();
  }

  const photos = form.photos ?? [];

  return (
    <form onSubmit={save} className="space-y-8 pb-8">
      {/* Media */}
      <section>
        <h2 className="text-lg font-extrabold">Photos &amp; video</h2>
        <p className="text-sm font-medium text-muted">
          Add up to 5 photos and a short intro video.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded-2xl border-2 border-ink"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  set(
                    "photos",
                    photos.filter((_, idx) => idx !== i)
                  )
                }
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
                aria-label="Remove photo"
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
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPhotos}
        />

        <div className="mt-3">
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold"
          >
            {form.video_url ? "Replace intro video" : "Add intro video"}
          </button>
          {form.video_url && (
            <span className="ml-2 text-sm font-semibold text-flockie-blue">
              video added ✓
            </span>
          )}
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            hidden
            onChange={onVideo}
          />
        </div>
        {uploading && (
          <p className="mt-2 text-sm font-semibold text-flockie-orange">
            Uploading…
          </p>
        )}
      </section>

      {/* About */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">About you</h2>
        <Field label="Name">
          <input
            className={inputCls}
            value={form.display_name ?? ""}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder="Your first name"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input
              type="number"
              min={18}
              max={120}
              className={inputCls}
              value={form.age ?? ""}
              onChange={(e) =>
                set("age", e.target.value ? Number(e.target.value) : null)
              }
            />
          </Field>
          <Field label="Gender">
            <Select
              value={form.gender ?? ""}
              onChange={(v) => set("gender", v)}
              options={GENDERS}
            />
          </Field>
        </div>
        <Field label="Relationship status">
          <Select
            value={form.relationship_status ?? ""}
            onChange={(v) => set("relationship_status", v)}
            options={RELATIONSHIP_STATUS}
          />
        </Field>
        <Field label="Home city">
          <input
            className={inputCls}
            value={form.home_city ?? ""}
            onChange={(e) => set("home_city", e.target.value)}
            placeholder="Where you're based"
          />
        </Field>
        <Field label="Short bio">
          <textarea
            className={`${inputCls} h-24 resize-none`}
            maxLength={200}
            value={form.bio ?? ""}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="A line or two about you"
          />
        </Field>
      </section>

      {/* Vibe */}
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold">Your vibe</h2>

        <Field label="Hobbies">
          <Chips
            options={HOBBIES}
            selected={form.hobbies ?? []}
            onToggle={(v) => toggleChip("hobbies", v)}
          />
        </Field>

        <Field label="Favorite activities">
          <Chips
            options={ACTIVITIES}
            selected={form.favorite_activities ?? []}
            onToggle={(v) => toggleChip("favorite_activities", v)}
          />
        </Field>

        <Field label="Places you've been">
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={placeInput}
              onChange={(e) => setPlaceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPlace();
                }
              }}
              placeholder="Add a place, press Enter"
            />
            <button
              type="button"
              onClick={addPlace}
              className="shrink-0 rounded-2xl border-2 border-ink bg-white px-4 font-bold"
            >
              Add
            </button>
          </div>
          {(form.places_visited ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(form.places_visited ?? []).map((p) => (
                <span
                  key={p}
                  className="flex items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "places_visited",
                        (form.places_visited ?? []).filter((x) => x !== p)
                      )
                    }
                    aria-label={`Remove ${p}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Planning style">
            <Select
              value={form.planning_style ?? ""}
              onChange={(v) => set("planning_style", v)}
              options={PLANNING_STYLE}
            />
          </Field>
          <Field label="Favorite season">
            <Select
              value={form.preferred_season ?? ""}
              onChange={(v) => set("preferred_season", v)}
              options={SEASONS}
            />
          </Field>
        </div>

        <Field label="MBTI (optional)">
          <Select
            value={form.mbti ?? ""}
            onChange={(v) => set("mbti", v)}
            options={MBTI_TYPES}
          />
        </Field>

        <YesNo
          label="Are you an outdoor person?"
          value={form.outdoor_person ?? null}
          onChange={(v) => set("outdoor_person", v)}
        />
        <YesNo
          label="Night owl?"
          value={form.night_owl ?? null}
          onChange={(v) => set("night_owl", v)}
        />
      </section>

      {msg && (
        <p className="text-center text-sm font-bold text-flockie-orange">{msg}</p>
      )}

      <button
        type="submit"
        disabled={saving || uploading}
        className="w-full rounded-full border-2 border-ink bg-flockie-orange py-3.5 font-bold text-white shadow-[0_4px_0_0_#E0512C] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save vibe check"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- helpers */

const inputCls =
  "w-full rounded-2xl border-2 border-ink bg-white px-4 py-2.5 font-medium outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      className={inputCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-bold transition-colors ${
              on ? "bg-flockie-blue text-white" : "bg-white text-ink"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex gap-2">
        {[
          { l: "Yes", v: true },
          { l: "No", v: false },
        ].map((opt) => (
          <button
            key={opt.l}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`rounded-full border-2 border-ink px-4 py-1 text-sm font-bold ${
              value === opt.v ? "bg-flockie-orange text-white" : "bg-white"
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  );
}
