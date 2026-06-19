import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripVibeForm from "@/components/TripVibeForm";

// "Confirm my vibe" step 2 of 3: the trip vibe, then on to the activity vibe.
export default async function OnboardingTripVibePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <TripVibeForm userId={user.id} redirectAfter="/onboarding/activity-vibe" />;
}
