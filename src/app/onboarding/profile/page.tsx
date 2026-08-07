import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/onboarding/ProfileForm";
import { getOnboardingProfileDefaults } from "@/lib/onboarding/profile-actions";
import { safeRedirectPath, withReturnTo } from "@/lib/redirects";

export default async function OnboardingProfilePage(
  props: {
    searchParams: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeRedirectPath(searchParams.returnTo, "");
  const defaults = await getOnboardingProfileDefaults();
  if (defaults.vibeComplete) {
    redirect(withReturnTo("/onboarding/vibe-check/reveal", returnTo));
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <ProfileForm defaults={defaults} returnTo={returnTo} />
    </main>
  );
}
