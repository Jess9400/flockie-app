import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfileView from "@/components/ProfileView";
import ProfileSocials from "@/components/ProfileSocials";
import type { Profile } from "@/lib/vibe-check";

export default async function PersonPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, relationship_status, home_city, instagram, x_handle, tiktok, photos, video_url, planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_one_liner, onboarding_complete"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) notFound();

  return (
    <main className="px-5 pb-10 pt-6">
      <Link href="/match" className="mb-3 flex w-fit items-center gap-1 text-sm font-bold text-muted">
        <ChevronLeft size={16} /> Back
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">
            {profile.display_name || "Flockie"}
            {profile.age ? `, ${profile.age}` : ""}
          </h1>
          {profile.home_city && (
            <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-muted">
              <MapPin size={14} /> {profile.home_city}
            </p>
          )}
        </div>
        <ProfileSocials
          instagram={profile.instagram}
          x_handle={profile.x_handle}
          tiktok={profile.tiktok}
        />
      </div>

      <div className="mt-5">
        <ProfileView profile={profile as Partial<Profile>} />
      </div>
    </main>
  );
}
