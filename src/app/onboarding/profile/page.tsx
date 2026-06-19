import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/onboarding/ProfileForm";
import { getOnboardingProfileDefaults } from "@/lib/onboarding/profile-actions";

export default async function OnboardingProfilePage() {
  const defaults = await getOnboardingProfileDefaults();
  if (defaults.vibeComplete) redirect("/onboarding/vibe-check/reveal");

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <ProfileForm defaults={defaults} />
    </main>
  );
}
