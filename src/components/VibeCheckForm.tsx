"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VibeQuestions from "@/components/VibeQuestions";
import ActivityQuestions from "@/components/ActivityQuestions";
import PhotoGrid from "@/components/PhotoGrid";
import VibeShareCard from "@/components/VibeShareCard";
import ProfileProgress, { type ProgressSegment } from "@/components/ProfileProgress";
import { SectionHeader } from "@/components/profileControls";
import {
  GENDERS,
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
  onSaved?: () => void;
  redirectAfter?: string;
};

export default function VibeCheckForm({ userId, initial, onSaved, redirectAfter }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [basics, setBasics] = useState({
    display_name: initial.display_name ?? "",
    age: initial.age ?? null,
    gender: initial.gender ?? "",
    home_city: initial.home_city ?? "",
    instagram: initial.instagram ?? "",
    x_handle: initial.x_handle ?? "",
    tiktok: initial.tiktok ?? "",
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [vouchUrl, setVouchUrl] = useState("");
  const [showShare, setShowShare] = useState(false);
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

  function reorderPhotos(from: number, to: number) {
    setPhotos((p) => {
      const next = [...p];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const segments = useMemo<ProgressSegment[]>(() => {
    const basicsFilled =
      [basics.display_name, basics.age, basics.home_city].filter(Boolean).length;
    const vibeAnswered =
      [
        answers.planning,
        answers.pace,
        answers.social_energy,
        answers.budget,
        answers.nightlife,
        answers.adventurousness,
      ].filter((v) => v != null).length +
      (answers.trip_vibe.length > 0 ? 1 : 0) +
      (answers.travel_style.length > 0 ? 1 : 0) +
      (answers.one_liner.trim() ? 1 : 0);
    const activityAnswered =
      (activity.activities.length > 0 ? 1 : 0) +
      (activity.activity_social != null ? 1 : 0) +
      (activity.activity_intensity != null ? 1 : 0) +
      (activity.activity_vibe.length > 0 ? 1 : 0) +
      (activity.activity_one_liner.trim() ? 1 : 0);
    const verified = basics.instagram || basics.x_handle || basics.tiktok ? 100 : 0;

    return [
      { label: "Photos", pct: photos.length > 0 ? 100 : 0, anchor: "sec-photos" },
      { label: "Basics", pct: Math.round((basicsFilled / 3) * 100), anchor: "sec-basics" },
      { label: "Vibe", pct: Math.round((vibeAnswered / 9) * 100), anchor: "sec-vibe" },
      { label: "Activity", pct: Math.round((activityAnswered / 5) * 100), anchor: "sec-activity" },
      { label: "Verify", pct: verified, anchor: "sec-verifications" },
    ];
  }, [basics, photos, answers, activity]);

  const overall = Math.round(segments.reduce((s, x) => s + x.pct, 0) / segments.length);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (photos.length === 0) return setMsg("Add at least one profile photo.");
    if ((activity.activities ?? []).length === 0)
      return setMsg("Pick at least one activity in your activity vibe check.");
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
    setShowShare(true); // celebrate + share card before returning to the profile
  }

  async function copyVouch() {
    await navigator.clipboard.writeText(vouchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <form onSubmit={save} className="font-nunito">
      {/* Progress */}
      <div className="mb-10">
        <ProfileProgress segments={segments} overall={overall} />
      </div>

      <div className="space-y-12">
        {/* Photos */}
        <section>
          <SectionHeader
            id="sec-photos"
            title="Photos & video"
            subtitle="At least one photo. Your first photo is your primary — drag to reorder."
          />
          <div className="mt-5">
            <PhotoGrid
              photos={photos}
              onRemovePhoto={(i) => setPhotos(photos.filter((_, idx) => idx !== i))}
              onReorder={reorderPhotos}
              onAddPhoto={() => photoInput.current?.click()}
              canAddPhoto={photos.length < MAX_PHOTOS}
              videoUrl={videoUrl}
              onAddVideo={() => videoInput.current?.click()}
              onRemoveVideo={() => setVideoUrl(null)}
              uploading={uploading}
            />
          </div>
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={onVideo} />
        </section>

        {/* Basics */}
        <section>
          <SectionHeader id="sec-basics" title="About you" />
          <div className="mt-5 space-y-3">
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
            <Field label="Home city">
              <input
                className={inputCls}
                value={basics.home_city}
                onChange={(e) => setBasics({ ...basics, home_city: e.target.value })}
                placeholder="Where you're based"
              />
            </Field>
          </div>
        </section>

        {/* Vibe check */}
        <section>
          <SectionHeader
            id="sec-vibe"
            title="The vibe check"
            subtitle="Quick and honest. This is what we match on."
          />
          <p className="mt-4 max-w-[600px] font-nunito text-[15px] font-medium italic text-navy/70">
            Quick and honest — these answers train the algorithm that finds your people. The gap
            between how you see yourself and how a friend sees you is what makes matching work.
          </p>
          <div className="mt-6">
            <VibeQuestions
              answers={answers}
              onChange={(patch) => setAnswers((a) => ({ ...a, ...patch }))}
              oneLinerPrompt="Finish: “On a trip, I'm the kind of person who…”"
            />
          </div>

          {/* Friend-vouch CTA (the one section that keeps a border) */}
          {vouchUrl && (
            <div className="mt-8 rounded-3xl border-2 border-flockie-coral p-5">
              <p className="font-fredoka text-lg font-semibold text-navy">Want sharper matches?</p>
              <p className="mt-1 font-nunito text-sm font-medium text-navy/70">
                Ask a friend to fill out their version of this vibe check — about you. Friends are
                honest about things you&rsquo;re not.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  readOnly
                  value={vouchUrl}
                  className="w-full truncate rounded-full border-2 border-navy bg-cream px-4 py-2 font-nunito text-sm font-medium text-navy"
                />
                <button
                  type="button"
                  onClick={copyVouch}
                  className="shrink-0 rounded-full border-2 border-navy bg-flockie-coral px-5 font-fredoka text-sm font-semibold text-white"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Activity vibe check */}
        <section>
          <SectionHeader
            id="sec-activity"
            title="Activity vibe check"
            subtitle="Required — how we match you for local meetups & events. Pick at least one activity."
          />
          <div className="mt-6">
            <ActivityQuestions
              answers={activity}
              onChange={(patch) => setActivity((a) => ({ ...a, ...patch }))}
            />
          </div>
        </section>

        {/* Verifications / socials */}
        <section>
          <SectionHeader
            id="sec-verifications"
            title="Verifications"
            subtitle="Link your handles so matches can check you out (optional)."
          />
          <div className="mt-5 space-y-3">
            <Field label="Instagram">
              <input
                className={inputCls}
                value={basics.instagram}
                onChange={(e) => setBasics({ ...basics, instagram: e.target.value })}
                placeholder="@yourhandle"
              />
            </Field>
            <Field label="X (Twitter)">
              <input
                className={inputCls}
                value={basics.x_handle}
                onChange={(e) => setBasics({ ...basics, x_handle: e.target.value })}
                placeholder="@yourhandle"
              />
            </Field>
            <Field label="TikTok">
              <input
                className={inputCls}
                value={basics.tiktok}
                onChange={(e) => setBasics({ ...basics, tiktok: e.target.value })}
                placeholder="@yourhandle"
              />
            </Field>
          </div>
        </section>
      </div>

      {msg && <p className="mt-8 text-center font-nunito text-sm font-bold text-flockie-coral">{msg}</p>}

      <button
        type="submit"
        disabled={saving || uploading}
        className="mt-8 w-full rounded-full border-2 border-navy bg-flockie-coral py-3.5 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save vibe check"}
      </button>

      {showShare && (
        <VibeShareCard
          userId={userId}
          name={basics.display_name}
          tags={[...answers.trip_vibe, ...answers.travel_style, ...activity.activity_vibe]}
          onClose={() => {
            setShowShare(false);
            if (redirectAfter) {
              router.push(redirectAfter);
            } else {
              router.refresh();
              onSaved?.();
            }
          }}
        />
      )}
    </form>
  );
}

const inputCls =
  "h-14 w-full rounded-2xl border-2 border-navy bg-cream px-4 font-nunito text-base font-medium text-navy outline-none focus:border-flockie-blue";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-nunito text-sm font-semibold text-navy">{label}</span>
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
