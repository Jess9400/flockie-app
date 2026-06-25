import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActivityVibeForm from "@/components/ActivityVibeForm";
import { safeRedirectPath } from "@/lib/redirects";

// "Confirm my vibe" activity step. In the short Vibe-invite path (quick=1) we
// return to the Vibe afterwards; otherwise back to the profile.
export default async function OnboardingActivityVibePage({
  searchParams,
}: {
  searchParams: { returnTo?: string; quick?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const returnTo = safeRedirectPath(searchParams.returnTo, "");
  const after = searchParams.quick === "1" && returnTo ? returnTo : "/profile?vibe_done=1";

  const { data: prefs } = await supabase
    .from("profiles")
    .select("activity_prefs_complete")
    .eq("id", user.id)
    .maybeSingle();
  if (prefs?.activity_prefs_complete) redirect(after);

  return <ActivityVibeForm userId={user.id} redirectAfter={after} />;
}
