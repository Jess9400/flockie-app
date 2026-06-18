import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

// Profile — shows vibe-check completion state. The full vibe-check editor
// (video, 5 photos, hobbies, MBTI, etc.) is the next build step.
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarding_complete")
    .eq("id", user!.id)
    .single();

  const complete = profile?.onboarding_complete ?? false;

  return (
    <main className="px-5 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Profile</h1>
        <SignOutButton />
      </div>
      <p className="mt-1 text-sm font-medium text-muted">{user?.email}</p>

      {!complete && (
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_0_rgba(26,26,26,1)]">
          <h2 className="text-lg font-extrabold">Finish your vibe check</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Add your photos, video, and a few personality questions so we can
            match you with the right people.
          </p>
          <button className="mt-4 w-full rounded-full border-2 border-ink bg-flockie-orange py-2.5 font-bold text-white shadow-[0_4px_0_0_#E0512C]">
            Start vibe check
          </button>
        </div>
      )}

      <div className="mt-6 flex h-[40vh] items-center justify-center rounded-3xl border-2 border-dashed border-ink/30 text-center text-muted">
        <p className="px-8 font-medium">
          Vibe-check profile editor: video, 5 photos, hobbies, activities,
          places visited, MBTI, season, night owl, planner vs go-with-flow,
          age, gender, relationship status (next build step).
        </p>
      </div>
    </main>
  );
}
