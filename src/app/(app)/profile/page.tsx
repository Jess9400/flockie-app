import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import VibeCheckForm from "@/components/VibeCheckForm";
import type { VibeCheck } from "@/lib/vibe-check";

// Profile / vibe-check editor.
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, relationship_status, bio, video_url, photos, hobbies, favorite_activities, places_visited, outdoor_person, night_owl, planning_style, preferred_season, mbti, home_city, onboarding_complete"
    )
    .eq("id", user!.id)
    .single();

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

      {!complete && (
        <div className="mt-4 rounded-2xl border-2 border-ink bg-white p-3 text-sm font-semibold shadow-[0_3px_0_0_rgba(26,26,26,1)]">
          Fill this out so we can match you with the right people. Friends can
          vouch for you later.
        </div>
      )}

      <div className="mt-6">
        <VibeCheckForm
          userId={user!.id}
          initial={(profile ?? {}) as Partial<VibeCheck>}
        />
      </div>
    </main>
  );
}
