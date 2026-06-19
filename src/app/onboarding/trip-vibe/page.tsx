import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripVibeForm from "@/components/TripVibeForm";

// "Confirm my vibe" trip step. After saving, continue to the activity form only
// if it's still empty — otherwise go to the profile (and pop the share popup).
export default async function OnboardingTripVibePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prefs } = await supabase
    .from("profiles")
    .select("trip_prefs_complete, activity_prefs_complete")
    .eq("id", user.id)
    .maybeSingle();

  const next = prefs?.activity_prefs_complete ? "/profile?vibe_done=1" : "/onboarding/activity-vibe";
  if (prefs?.trip_prefs_complete) redirect(next);

  return <TripVibeForm userId={user.id} redirectAfter={next} />;
}
