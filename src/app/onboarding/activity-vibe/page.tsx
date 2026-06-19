import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivityVibeForm from "@/components/ActivityVibeForm";

// "Confirm my vibe" step 3 of 3: the activity vibe, then back to the profile.
export default async function OnboardingActivityVibePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <ActivityVibeForm userId={user.id} redirectAfter="/profile" />;
}
