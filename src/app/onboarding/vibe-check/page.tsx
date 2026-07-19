import { redirect } from "next/navigation";
import { VibeOnboardingForm } from "@/components/onboarding/VibeOnboardingForm";
import { safeRedirectPath, withReturnTo } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

export default async function VibeCheckPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const returnTo = safeRedirectPath(searchParams.returnTo, "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("vibe_persona, vibe_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.vibe_persona && profile.vibe_completed_at) {
    redirect(withReturnTo("/onboarding/vibe-check/reveal", returnTo));
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md overflow-hidden">
      <VibeOnboardingForm returnTo={returnTo} />
    </main>
  );
}
