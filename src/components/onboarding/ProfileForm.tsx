"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PhotoCropper from "@/components/PhotoCropper";
import {
  ProfileInput,
  saveOnboardingProfile,
} from "@/lib/onboarding/profile-actions";
import { withReturnTo } from "@/lib/redirects";

const GENDERS: { value: ProfileInput["gender"]; label: string }[] = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

interface ProfileFormProps {
  defaults: {
    firstName: string;
    photoUrl: string | null;
    birthday: string;
    gender: ProfileInput["gender"] | null;
    city: string;
  };
  returnTo?: string | null;
}

export function ProfileForm({ defaults, returnTo }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [firstName, setFirstName] = useState(defaults.firstName);
  const [photoUrl, setPhotoUrl] = useState<string | null>(defaults.photoUrl);
  const [uploading, setUploading] = useState(false);
  const [birthday, setBirthday] = useState(defaults.birthday);
  const [gender, setGender] = useState<ProfileInput["gender"] | null>(
    defaults.gender
  );
  const [city, setCity] = useState(defaults.city);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const canSubmit = Boolean(
    firstName.trim() && photoUrl && birthday && gender && city.trim()
  );

  function onPhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setPendingFile(file);
    if (photoInput.current) photoInput.current.value = "";
  }

  async function uploadCropped(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again");
      const path = `${user.id}/onboarding-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      setPhotoUrl(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      setPendingFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit || submitting || !gender) return;
    setSubmitting(true);
    setError(null);

    try {
      await saveOnboardingProfile({
        firstName: firstName.trim(),
        photoUrl,
        birthday,
        gender,
        city: city.trim(),
      });
      router.push(withReturnTo("/onboarding/vibe-check", returnTo));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong. Try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-nunito">
      <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
        <div className="mb-4 text-[17px] font-extrabold text-navy">Flockie</div>
        <h1 className="mb-1 text-[25px] font-black leading-tight">A couple basics</h1>
        <p className="mb-5 text-[13px] font-semibold text-muted">Pre-filled where we could.</p>

        <div className="mb-5 flex flex-col items-center">
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            className="flex h-[78px] w-[78px] items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-flockie-blue bg-white text-[24px] font-extrabold text-flockie-blue"
            aria-label="Add a photo"
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              "+"
            )}
          </button>
          <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoSelected} />
          <div className="mt-2 text-[11.5px] font-bold text-navy">
            {uploading ? "Uploading…" : photoUrl ? "Tap to change" : "Add a photo (required)"}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-muted">
            You can add more photos later
          </div>
        </div>

        <Field label="First name" sourceTag={defaults.firstName ? "from Google" : undefined}>
          <input
            className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-bold outline-none focus:border-flockie-blue"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Your name"
            autoComplete="given-name"
          />
        </Field>

        <Field label="Birthday">
          <input
            type="date"
            className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-bold outline-none focus:border-flockie-blue"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
          />
          <p className="mt-1.5 text-[11.5px] font-semibold text-muted">
            Keeps your age accurate — only the number shows.
          </p>
        </Field>

        <Field label="Gender">
          <div className="flex flex-wrap gap-1.5">
            {GENDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGender(option.value)}
                className={`rounded-full border-2 px-3.5 py-2 text-[13px] font-bold transition-colors ${
                  gender === option.value
                    ? "border-navy bg-flockie-blue/15 text-navy"
                    : "border-ink/15 bg-white text-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Your city right now">
          <input
            className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] font-bold outline-none focus:border-flockie-blue"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Where are you?"
            autoComplete="address-level2"
          />
          <p className="mt-1.5 text-[11.5px] font-semibold text-muted">
            Powers who&apos;s nearby — update anytime.
          </p>
        </Field>
      </div>

      <div className="flex-none border-t border-ink/10 bg-white px-6 py-4">
        <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-flockie-blue/30 bg-flockie-blue/10 p-3">
          <span className="text-[19px]">🎯</span>
          <p className="text-[12px] font-semibold leading-relaxed text-navy">
            <b>Up next: your vibe check.</b> Five quick questions so we can start finding your people.
          </p>
        </div>
        {error && <p className="mb-2 text-[12px] font-semibold text-red-700">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting || uploading}
          className="w-full rounded-2xl border-2 border-ink border-b-[5px] bg-flockie-coral py-3.5 text-[15.5px] font-extrabold text-white disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Continue to your vibe check →"}
        </button>
      </div>

      {pendingFile && (
        <PhotoCropper
          file={pendingFile}
          busy={uploading}
          onCancel={() => setPendingFile(null)}
          onCropped={uploadCropped}
        />
      )}
    </div>
  );
}

function Field({
  label,
  sourceTag,
  children,
}: {
  label: string;
  sourceTag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-3.5">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-muted">
        <span>{label}</span>
        {sourceTag && (
          <span className="text-[10px] font-bold normal-case text-onboarding-green">
            ✓ {sourceTag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
