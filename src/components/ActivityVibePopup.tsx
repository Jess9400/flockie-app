"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ActivityQuestions from "@/components/ActivityQuestions";
import { EMPTY_ACTIVITY, type ActivityAnswers } from "@/lib/vibe-check";

const MAX_PHOTOS = 3;

// Quick onboarding popup for the invite flow: name + photo + activity vibe check.
// Saves the profile, then calls onDone() so interest can be registered.
export default function ActivityVibePopup({
  userId,
  onDone,
  onClose,
}: {
  userId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [activity, setActivity] = useState<ActivityAnswers>(EMPTY_ACTIVITY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // Prefill from any existing profile data (e.g. Google name).
  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name, photos, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_dealbreakers, activity_one_liner")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.display_name ?? "");
        setPhotos(data.photos ?? []);
        setActivity({
          ...EMPTY_ACTIVITY,
          activities: data.activities ?? [],
          activity_skills: data.activity_skills ?? {},
          activity_social: data.activity_social ?? null,
          activity_intensity: data.activity_intensity ?? null,
          activity_vibe: data.activity_vibe ?? [],
          activity_dealbreakers: data.activity_dealbreakers ?? [],
          activity_one_liner: data.activity_one_liner ?? "",
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const urls: string[] = [];
      for (const file of files.slice(0, room)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/invite-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Add your first name.");
    if (photos.length === 0) return setErr("Add at least one photo.");
    if (activity.activities.length === 0) return setErr("Pick at least one activity.");
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), photos, ...activity, onboarding_complete: true })
      .eq("id", userId);
    setSaving(false);
    if (error) return setErr(error.message);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-2 border-navy bg-cream p-5 font-nunito sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-fredoka text-2xl font-bold text-navy">Quick vibe check</h2>
            <p className="mt-1 font-nunito text-sm font-medium text-navy/60">
              So the host&rsquo;s algorithm can match you. Takes a minute.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy text-navy">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-1.5 block font-nunito text-sm font-semibold text-navy">First name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              className="h-12 w-full rounded-2xl border-2 border-navy bg-white px-4 font-nunito font-medium text-navy outline-none focus:border-flockie-blue"
            />
          </label>

          <div>
            <span className="mb-1.5 block font-nunito text-sm font-semibold text-navy">Photos (up to 3)</span>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-2xl border-2 border-navy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white"
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
                  className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-navy bg-white text-2xl text-navy"
                >
                  +
                </button>
              )}
            </div>
            <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
            {uploading && <p className="mt-1 font-nunito text-sm font-semibold text-flockie-coral">Uploading…</p>}
          </div>

          <div className="border-t-2 border-navy/10 pt-4">
            <ActivityQuestions answers={activity} onChange={(patch) => setActivity((a) => ({ ...a, ...patch }))} />
          </div>

          {err && <p className="text-center font-nunito text-sm font-bold text-flockie-coral">{err}</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full rounded-full border-2 border-navy bg-flockie-coral py-3.5 font-fredoka text-base font-semibold text-white shadow-[0_4px_0_0_rgba(10,37,69,1)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & express interest"}
          </button>
        </form>
      </div>
    </div>
  );
}
