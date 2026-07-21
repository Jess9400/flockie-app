"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/request";

export interface ProfileInput {
  firstName: string;
  photoUrl: string | null;
  birthday: string;
  gender: "woman" | "man" | "non_binary" | "prefer_not_to_say";
  city: string;
}

export interface ProfileIdentityInput {
  displayName: string;
  city: string;
  bio: string;
  photoUrl: string;
}

function ageFromBirthday(birthday: string) {
  const date = new Date(`${birthday}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid birthday");

  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < date.getUTCMonth() ||
    (today.getUTCMonth() === date.getUTCMonth() &&
      today.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function saveOnboardingProfile(input: ProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const age = ageFromBirthday(input.birthday);
  if (age < 18 || age > 120) {
    throw new Error("You must be at least 18 to use Flockie");
  }

  const photos = input.photoUrl ? [input.photoUrl] : [];
  if (!photos.length) throw new Error("Add a profile photo to continue");

  // Seed the persisted language from the UI locale cookie at profile creation
  // (the auth trigger creates the bare row with the 'en' default). Drives
  // localized transactional emails; the user can change it later in Settings.
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = (locales as readonly string[]).includes(cookieLocale ?? "")
    ? cookieLocale
    : "en";

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: input.firstName,
    birthday: input.birthday,
    age,
    gender: input.gender === "prefer_not_to_say" ? null : input.gender,
    home_city: input.city,
    photos,
    locale,
    onboarding_complete: true,
  });

  if (error) throw error;
}

export async function updateProfileIdentity(input: ProfileIdentityInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayName = input.displayName.trim();
  const homeCity = input.city.trim();

  const { data: current } = await supabase
    .from("profiles")
    .select("photos")
    .eq("id", user.id)
    .maybeSingle();
  const currentPhotos = Array.isArray(current?.photos)
    ? current.photos.filter((photo: unknown): photo is string => typeof photo === "string")
    : [];
  const ownsUploadedPhoto = input.photoUrl.includes(`/avatars/${user.id}/`);
  if (!displayName || !homeCity || !input.photoUrl || (!currentPhotos.includes(input.photoUrl) && !ownsUploadedPhoto)) {
    throw new Error("Add your name, city, and profile photo before saving");
  }
  const photos = [input.photoUrl, ...currentPhotos.filter((photo) => photo !== input.photoUrl)];

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName.slice(0, 60),
      home_city: homeCity.slice(0, 80),
      bio: input.bio.slice(0, 160) || null,
      photos,
    })
    .eq("id", user.id);

  if (error) throw error;
}

export async function getOnboardingProfileDefaults() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, birthday, gender, home_city, photos, vibe_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  const metadataName = (user.user_metadata?.full_name as string | undefined)
    ?.trim()
    .split(/\s+/)[0];

  return {
    firstName: profile?.display_name?.trim().split(/\s+/)[0] || metadataName || "",
    // Photo is uploaded manually (most people have no Google avatar) — only
    // reuse one already saved on the profile, never the Google avatar.
    photoUrl: profile?.photos?.[0] || null,
    birthday: profile?.birthday || "",
    gender: (profile?.gender || null) as ProfileInput["gender"] | null,
    city: profile?.home_city || "",
    vibeComplete: Boolean(profile?.vibe_completed_at),
  };
}
