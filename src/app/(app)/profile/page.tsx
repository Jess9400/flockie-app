import { createClient } from "@/lib/supabase/server";
import ProfileEditor from "@/components/ProfileEditor";
import type { Profile } from "@/lib/vibe-check";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { compat?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, home_city, instagram, x_handle, tiktok, photos, video_url, planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_dealbreakers, activity_one_liner, notifications_enabled, vouch_token, onboarding_complete"
    )
    .eq("id", user!.id)
    .single();

  const complete = profile?.onboarding_complete ?? false;

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pb-28 pt-6 font-nunito sm:pb-12">
      <ProfileEditor
        userId={user!.id}
        profile={(profile ?? {}) as Partial<Profile>}
        complete={complete}
        redirectAfter={searchParams.compat ? `/compat/${searchParams.compat}` : undefined}
      />
    </main>
  );
}
