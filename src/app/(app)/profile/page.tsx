import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import ProfileEditor from "@/components/ProfileEditor";
import { type EventsData } from "@/components/ProfileEvents";
import type { Profile } from "@/lib/vibe-check";
import { safeRedirectPath } from "@/lib/redirects";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { compat?: string; returnTo?: string };
}) {
  const returnTo =
    safeRedirectPath(searchParams.returnTo, "") ||
    (searchParams.compat ? `/compat/${searchParams.compat}` : undefined);
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, age, gender, home_city, instagram, x_handle, tiktok, photos, video_url, planning, pace, social_energy, budget, nightlife, adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, activities, activity_skills, activity_social, activity_intensity, activity_vibe, activity_dealbreakers, activity_one_liner, notifications_enabled, vouch_token, onboarding_complete, trip_prefs_complete, activity_prefs_complete, archetype, vibe_completed_at, vibe_scores, vibe_goal, vibe_persona"
    )
    .eq("id", user!.id)
    .single();

  const complete = profile?.onboarding_complete ?? false;

  // Bio — separate, migration-safe (column may not exist yet).
  const { data: bioRow } = await supabase
    .from("profiles")
    .select("bio")
    .eq("id", user!.id)
    .maybeSingle();
  const { data: socialPrivacy } = await supabase
    .from("profiles")
    .select("social_visibility")
    .eq("id", user!.id)
    .maybeSingle();

  // The story uses completed Vibes only. The RPC keeps future plans private.
  const [{ data: eventsData }, { data: takesData }] = await Promise.all([
    supabase.rpc("public_profile_events", { p_user: user!.id }),
    supabase.from("vibe_takes").select("vibe_id, body, updated_at").eq("user_id", user!.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 font-nunito sm:px-6 sm:pb-12">
      <ProfileEditor
        userId={user!.id}
        profile={
          {
            ...(profile ?? {}),
            bio: bioRow?.bio ?? null,
            social_visibility: socialPrivacy?.social_visibility ?? "connections",
          } as Partial<Profile>
        }
        complete={complete}
        redirectAfter={returnTo}
        events={(eventsData ?? {}) as EventsData}
        takes={takesData ?? []}
      />
    </main>
  );
}
