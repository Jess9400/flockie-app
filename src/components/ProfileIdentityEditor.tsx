"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import PhotoCropper from "@/components/PhotoCropper";
import { updateProfileIdentity } from "@/lib/onboarding/profile-actions";
import { createClient } from "@/lib/supabase/client";

type IdentityValues = {
  display_name?: string | null;
  home_city?: string | null;
  photos?: string[] | null;
  bio?: string | null;
};

export default function ProfileIdentityEditor({
  initial,
  onClose,
}: {
  initial: IdentityValues;
  onClose: () => void;
}) {
  const t = useTranslations("profile.identityEditor");
  const router = useRouter();
  const supabase = createClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.display_name ?? "");
  const [city, setCity] = useState(initial.home_city ?? "");
  const [line, setLine] = useState(initial.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial.photos?.[0] ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(name.trim() && city.trim() && photoUrl && !uploading && !saving);

  function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setPendingFile(file);
    if (photoInput.current) photoInput.current.value = "";
  }

  async function uploadCropped(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(t("signInError"));
      const path = `${auth.user.id}/profile-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      setPhotoUrl(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      setPendingFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("photoError"));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!canSave || !photoUrl) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfileIdentity({
        displayName: name.trim(),
        city: city.trim(),
        bio: line.trim(),
        photoUrl,
      });
      router.refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveError"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-navy/55 p-0 sm:items-center sm:justify-center sm:p-6">
      <div className="w-full max-w-lg rounded-t-[28px] bg-cream p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-fredoka text-2xl font-bold text-navy">{t("title")}</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t("subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-navy">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button type="button" onClick={() => photoInput.current?.click()} className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink/15 bg-white text-navy">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera size={24} />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-navy/65 py-1 text-[10px] font-extrabold text-white">{uploading ? t("uploading") : t("changePhoto")}</span>
          </button>
          <div>
            <p className="text-sm font-extrabold text-navy">{t("photoTitle")}</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-muted">{t("photoHelp")}</p>
          </div>
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={selectPhoto} />
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">{t("name")}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="given-name" className="w-full rounded-2xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-bold text-navy outline-none focus:border-flockie-coral" />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">{t("city")}</span>
          <CityAutocomplete value={city} onChange={setCity} className="w-full rounded-2xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-bold text-navy outline-none focus:border-flockie-coral" placeholder={t("cityPlaceholder")} />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">{t("line")}</span>
          <textarea value={line} onChange={(event) => setLine(event.target.value)} maxLength={160} rows={3} className="w-full resize-none rounded-2xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-semibold text-navy outline-none focus:border-flockie-coral" placeholder={t("linePlaceholder")} />
        </label>

        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm font-extrabold text-navy">
            {t("cancel")}
          </button>
          <button type="button" onClick={save} disabled={!canSave} className="flex-[1.4] rounded-2xl border border-ink/15 border-b-[4px] bg-flockie-coral px-4 py-3 text-sm font-extrabold text-white disabled:opacity-45">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {pendingFile && <PhotoCropper file={pendingFile} busy={uploading} onCancel={() => setPendingFile(null)} onCropped={uploadCropped} />}
    </div>
  );
}
