import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import VibeCheckForm from "@/components/VibeCheckForm";
import type { Profile } from "@/lib/vibe-check";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, relationship_status, home_city, instagram, x_handle, tiktok, photos, video_url, planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_dealbreakers, activity_one_liner, vouch_token, onboarding_complete"
    )
    .eq("id", user!.id)
    .single();

  const { count: vouchCount } = await supabase
    .from("vouches")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", user!.id);

  const complete = profile?.onboarding_complete ?? false;

  return (
    <main className="px-5 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Your vibe check</h1>
          <p className="text-sm font-medium text-muted">{user?.email}</p>
        </div>
        <SignOutButton />
      </div>

      {(vouchCount ?? 0) > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-flockie-blue px-4 py-2.5 text-sm font-bold text-white">
          🕊️ {vouchCount} friend{(vouchCount ?? 0) > 1 ? "s" : ""} vouched for you
        </div>
      )}

      {!complete && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-white p-3 text-sm font-semibold shadow-[0_3px_0_0_rgba(26,26,26,1)]">
          Fill this out so we can match you with the right people. Friend vouch is
          optional but it&rsquo;s the strongest signal on your profile.
        </div>
      )}

      <div className="mt-6">
        <VibeCheckForm
          userId={user!.id}
          initial={(profile ?? {}) as Partial<Profile>}
        />
      </div>
    </main>
  );
}
