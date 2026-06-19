import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivityVibeForm from "@/components/ActivityVibeForm";

// "Confirm my vibe" activity step. If already filled, skip to the profile;
// otherwise save then return to the profile (and pop the share popup).
export default async function OnboardingActivityVibePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prefs } = await supabase
    .from("profiles")
    .select("activity_prefs_complete")
    .eq("id", user.id)
    .maybeSingle();
  if (prefs?.activity_prefs_complete) redirect("/profile?vibe_done=1");

  return <ActivityVibeForm userId={user.id} redirectAfter="/profile?vibe_done=1" />;
}
