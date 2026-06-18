"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VibeQuestions from "@/components/VibeQuestions";
import ActivityQuestions from "@/components/ActivityQuestions";
import {
  GENDERS,
  RELATIONSHIP_STATUS,
  EMPTY_ANSWERS,
  EMPTY_ACTIVITY,
  type Profile,
  type VibeAnswers,
  type ActivityAnswers,
} from "@/lib/vibe-check";

const MAX_PHOTOS = 5;

type Props = {
  userId: string;
  initial: Partial<Profile>;
};

export default function VibeCheckForm({ userId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [basics, setBasics] = useState({
    display_name: initial.display_name ?? "",
    age: initial.age ?? null,
    gender: initial.gender ?? "",
    relationship_status: initial.relationship_status ?? "",
    home_city: initial.home_city ?? "",
  });
  const [photos, setPhotos] = useState<string[]>(initial.photos ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(initial.video_url ?? null);
  const [answers, setAnswers] = useState<VibeAnswers>({
    ...EMPTY_ANSWERS,
    planning: initial.planning ?? null,
    pace: initial.pace ?? null,
    social_energy: initial.social_energy ?? null,
    budget: initial.budget ?? null,
    nightlife: initial.nightlife ?? null,
    adventurousness: initial.adventurousness ?? null,
    trip_vibe: initial.trip_vibe ?? [],
    travel_style: initial.travel_style ?? [],
    dealbreakers: initial.dealbreakers ?? [],
    one_liner: initial.one_liner ?? "",
  });

  const [activity, setActivity] = useState<ActivityAnswers>({
    ...EMPTY_ACTIVITY,
    activities: initial.activities ?? [],
    activity_skills: initial.activity_skills ?? {},
    activity_social: initial.activity_social ?? null,
    activity_intensity: initial.activity_intensity ?? null,
    activity_vibe: initial.activity_vibe ?? [],
    activity_dealbreakers: initial.activity_dealbreakers ?? [],
    activity_one_liner: initial.activity_one_liner ?? "",
  });
  const [showActivity, setShowActivity] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [vouchUrl, setVouchUrl] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial.vouch_token) {
      setVouchUrl(`${window.location.origin}/vouch/${initial.vouch_token}`);
    }
  }, [initial.vouch_token]);

  async function uploadFile(bucket: "avatars" | "videos", file: File) {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setMsg(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const urls: string[] = [];
      for (const file of files.slice(0, room)) urls.push(await uploadFile("avatars", file));
      setPhotos((p) => [...p, ...urls]);
    } catch {
      setMsg("Photo upload failed.");
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
      setVideoUrl(await uploadFile("videos", file));
    } catch {
      setMsg("Video upload failed.");
    } finally {
      setUploading(false);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...basics,
        photos,
        video_url: videoUrl,
        ...answers,
        ...activity,
        onboarding_complete: true,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) return setMsg(error.message);
    setMsg("Saved! Your vibe check is live.");
    router.refresh();
  }

  async function copyVouch() {
    await navigator.clipboard.writeText(vouchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <form onSubmit={save} className="space-y-8 pb-8">
      {/* Media */}
      <section>
        <h2 className="text-lg font-extrabold">Photos &amp; video</h2>
        <p className="text-sm font-medium text-muted">
          Up to 5 photos and a short intro video.
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
                onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
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
        <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
        <div className="mt-3">
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold"
          >
            {videoUrl ? "Replace intro video" : "Add intro video"}
          </button>
          {videoUrl && (
            <span className="ml-2 text-sm font-semibold text-flockie-blue">video added ✓</span>
          )}
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={onVideo} />
        </div>
        {uploading && (
          <p className="mt-2 text-sm font-semibold text-flockie-orange">Uploading…</p>
        )}
      </section>

      {/* Basics */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">About you</h2>
        <Field label="Name">
          <input
            className={inputCls}
            value={basics.display_name}
            onChange={(e) => setBasics({ ...basics, display_name: e.target.value })}
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
              value={basics.age ?? ""}
              onChange={(e) =>
                setBasics({ ...basics, age: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="Gender">
            <Select
              value={basics.gender}
              onChange={(v) => setBasics({ ...basics, gender: v })}
              options={GENDERS}
            />
          </Field>
        </div>
        <Field label="Relationship status">
          <Select
            value={basics.relationship_status}
            onChange={(v) => setBasics({ ...basics, relationship_status: v })}
            options={RELATIONSHIP_STATUS}
          />
        </Field>
        <Field label="Home city">
          <input
            className={inputCls}
            value={basics.home_city}
            onChange={(e) => setBasics({ ...basics, home_city: e.target.value })}
            placeholder="Where you're based"
          />
        </Field>
      </section>

      {/* The 10 questions */}
      <section>
        <h2 className="text-lg font-extrabold">The vibe check</h2>
        <p className="text-sm font-medium text-muted">
          Quick and honest. This is what we match on.
        </p>
        <div className="mt-4">
          <VibeQuestions
            answers={answers}
            onChange={(patch) => setAnswers((a) => ({ ...a, ...patch }))}
            oneLinerPrompt="Finish: “On a trip, I'm the kind of person who…”"
          />
        </div>
      </section>

      {/* Activity vibe check (optional, for local events) */}
      <section className="rounded-3xl border-2 border-ink bg-white p-4">
        <button
          type="button"
          onClick={() => setShowActivity((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="text-lg font-extrabold">
            Activity vibe check (optional)
          </span>
          <span className="text-2xl leading-none">{showActivity ? "−" : "+"}</span>
        </button>
        <p className="mt-1 text-left text-sm font-medium text-muted">
          For local meetups &amp; events: what you do, your level, and how you
          like it.
        </p>
        {showActivity && (
          <div className="mt-4">
            <ActivityQuestions
              answers={activity}
              onChange={(patch) => setActivity((a) => ({ ...a, ...patch }))}
            />
          </div>
        )}
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

      {/* Optional friend vouch */}
      {vouchUrl && (
        <section className="rounded-3xl border-2 border-ink bg-white p-4">
          <h2 className="text-lg font-extrabold">Get a friend to vouch (optional)</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Send this link to a friend. They answer the same questions about you.
            It's the unfakeable social proof that makes your profile stand out.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={vouchUrl}
              className="w-full truncate rounded-2xl border-2 border-ink bg-cream px-3 py-2 text-sm font-medium"
            />
            <button
              type="button"
              onClick={copyVouch}
              className="shrink-0 rounded-2xl border-2 border-ink bg-flockie-blue px-4 text-sm font-bold text-white"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>
      )}
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
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
