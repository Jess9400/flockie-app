import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/onboarding/ProfileForm";
import { getOnboardingProfileDefaults } from "@/lib/onboarding/profile-actions";
import { createClient } from "@/lib/supabase/server";
import { isInvitedDestination, safeRedirectPath, withReturnTo } from "@/lib/redirects";

const INVITE_TOKEN = /^\/clubs\/invite\/([0-9a-fA-F-]{36})/;

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

  // On a club invitation the city field is hidden, so seed it from the club
  // they are joining - a local club is in their city by definition, and it
  // keeps them out of the "no home city" hole that hides people from
  // discovery.
  const invited = isInvitedDestination(returnTo);
  let city = defaults.city;
  const token = invited ? returnTo.match(INVITE_TOKEN)?.[1] : null;
  if (token && !city) {
    const supabase = await createClient();
    const { data } = await supabase
      .rpc("club_founder_invite_detail", { p_token: token })
      .maybeSingle();
    city = (data as { city?: string } | null)?.city ?? "";
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <ProfileForm defaults={{ ...defaults, city }} returnTo={returnTo} invited={invited} />
    </main>
  );
}
