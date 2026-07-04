"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoCropper from "@/components/PhotoCropper";
import VibeShareCard from "@/components/VibeShareCard";
import CityAutocomplete from "@/components/CityAutocomplete";
import { SectionHeader } from "@/components/profileControls";
import { GENDER_OPTIONS, topVibeTags, type Profile } from "@/lib/vibe-check";

const MAX_PHOTOS = 5;

type Props = {
  userId: string;
  initial: Partial<Profile>;
  onSaved?: () => void;
  redirectAfter?: string;
};

// Profile basics editor. Travel preferences and the activity vibe live in their
// own wizard forms (TripVibeForm / ActivityVibeForm); the personality vibe is
// the signup onboarding quiz. This stays focused on who you are + your photos.
export default function VibeCheckForm({ userId, initial, onSaved, redirectAfter }: Props) {
  const t = useTranslations("profile");
  const router = useRouter();
  const supabase = createClient();

  const [basics, setBasics] = useState({
    display_name: initial.display_name ?? "",
    age: initial.age ?? null,
    gender: initial.gender ?? "",
    home_city: initial.home_city ?? "",
    bio: initial.bio ?? "",
    instagram: initial.instagram ?? "",
    x_handle: initial.x_handle ?? "",
    tiktok: initial.tiktok ?? "",
  });
  const [photos, setPhotos] = useState<string[]>(initial.photos ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(initial.video_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  async function uploadFile(bucket: "avatars" | "videos", file: File) {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && photos.length < MAX_PHOTOS) setPendingFile(file);
    if (photoInput.current) photoInput.current.value = "";
  }

  async function uploadCroppedPhoto(blob: Blob) {
    setUploading(true);
    setMsg(null);
    try {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, cacheControl: "3600", contentType: "image/jpeg" });
      if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      setPhotos((p) => [...p, url]);
      setPendingFile(null);
    } catch {
      setMsg(t("form.photoUploadFailed"));
    } finally {
      setUploading(false);
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
      setMsg(t("form.videoUploadFailed"));
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (photos.length === 0) return setMsg(t("form.needPhoto"));
    setSaving(true);
    setMsg(null);
    const { bio, ...rest } = basics;
    const { error } = await supabase
      .from("profiles")
      .update({
        ...rest,
        gender: basics.gender || null,
        photos,
        video_url: videoUrl,
        onboarding_complete: true,
      })
      .eq("id", userId);
    if (error) {
      setSaving(false);
      return setMsg(error.message);
    }
    // Separate, migration-safe write (bio column may not exist yet).
    await supabase.from("profiles").update({ bio: bio || null }).eq("id", userId);
    setSaving(false);
    setMsg(t("form.saved"));
    setShowShare(true);
  }

  return (
    <form onSubmit={save} className="font-nunito">
      <div className="space-y-12">
        {/* Photos */}
        <section>
          <SectionHeader
            id="sec-photos"
            title={t("form.photosTitle")}
            subtitle={t("form.photosSubtitle")}
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
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoSelected} />
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={onVideo} />
        </section>

        {/* Basics */}
        <section>
          <SectionHeader id="sec-basics" title={t("form.aboutTitle")} />
          <div className="mt-5 space-y-3">
            <Field label={t("form.name")}>
              <input
                className={inputCls}
                value={basics.display_name}
                onChange={(e) => setBasics({ ...basics, display_name: e.target.value })}
                placeholder={t("form.namePlaceholder")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("form.age")}>
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
              <Field label={t("form.gender")}>
                <select
                  className={inputCls}
                  value={basics.gender}
                  onChange={(e) => setBasics({ ...basics, gender: e.target.value })}
                >
                  <option value="">{t("form.genderSelect")}</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`genders.${o.value}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("form.homeCity")}>
              <CityAutocomplete
                className={inputCls}
                value={basics.home_city}
                onChange={(v) => setBasics({ ...basics, home_city: v })}
                placeholder={t("form.cityPlaceholder")}
              />
            </Field>
            <Field label={t("form.bioLabel")}>
              <textarea
                rows={4}
                maxLength={300}
                className="w-full rounded-2xl border-2 border-navy bg-cream px-4 py-3 font-nunito text-base font-medium text-navy outline-none focus:border-flockie-blue"
                value={basics.bio}
                onChange={(e) => setBasics({ ...basics, bio: e.target.value })}
                placeholder={t("form.bioPlaceholder")}
              />
              <p className="mt-1 text-right font-nunito text-xs font-semibold text-navy/50">
                {basics.bio.length}/300
              </p>
            </Field>
          </div>
        </section>

        {/* Verifications / socials */}
        <section>
          <SectionHeader
            id="sec-verifications"
            title={t("form.verificationsTitle")}
            subtitle={t("form.verificationsSubtitle")}
          />
          <div className="mt-5 space-y-3">
            <Field label={t("form.instagram")}>
              <input
                className={inputCls}
                value={basics.instagram}
                onChange={(e) => setBasics({ ...basics, instagram: e.target.value })}
                placeholder={t("form.handlePlaceholder")}
              />
            </Field>
            <Field label={t("form.xTwitter")}>
              <input
                className={inputCls}
                value={basics.x_handle}
                onChange={(e) => setBasics({ ...basics, x_handle: e.target.value })}
                placeholder={t("form.handlePlaceholder")}
              />
            </Field>
            <Field label={t("form.tiktok")}>
              <input
                className={inputCls}
                value={basics.tiktok}
                onChange={(e) => setBasics({ ...basics, tiktok: e.target.value })}
                placeholder={t("form.handlePlaceholder")}
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
        {saving ? t("form.saving") : t("form.save")}
      </button>

      {pendingFile && (
        <PhotoCropper
          file={pendingFile}
          busy={uploading}
          onCancel={() => setPendingFile(null)}
          onCropped={uploadCroppedPhoto}
        />
      )}

      {showShare && (
        <VibeShareCard
          userId={userId}
          name={basics.display_name}
          tags={topVibeTags(initial)}
          archetypeKey={(initial as { archetype?: string | null }).archetype}
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
