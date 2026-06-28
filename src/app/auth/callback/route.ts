import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath, withReturnTo } from "@/lib/redirects";

// Handles the OAuth / email-confirmation redirect: exchanges the code for a
// session, then sends the user into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/home");
  const referral = searchParams.get("ref");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (referral) {
          await supabase.rpc("claim_referral", { p_inviter: referral });
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete, vibe_completed_at, activity_prefs_complete, terms_accepted_at")
          .eq("id", user.id)
          .maybeSingle();

        // Persist terms consent on first login. The /login screen is the clickwrap
        // ("By continuing you agree to Flockie's Terms and Privacy Policy"), so an
        // authenticated user has consented. Guarded on the null column so the stored
        // timestamp stays the FIRST acceptance even if accept_terms() re-stamps.
        if (profile && !profile.terms_accepted_at) {
          await supabase.rpc("accept_terms");
        }

        // Lower friction for Vibe invites: a user who's done the activity form
        // (Tier 1) is let straight in; brand-new users heading to a Vibe get the
        // short path (profile basics → activity form → the Vibe), skipping the
        // personality vibe-check (they're nudged to finish it after they're in).
        const quickDone = !!profile?.activity_prefs_complete;
        const isVibeInvite = next.startsWith("/vibes/") || next.startsWith("/invite/");

        if (!profile?.vibe_completed_at && !quickDone) {
          const dest = isVibeInvite ? "/onboarding/profile?quick=1" : "/onboarding/profile";
          return NextResponse.redirect(`${origin}${withReturnTo(dest, next)}`);
        }
        if (!profile.onboarding_complete && !quickDone) {
          return NextResponse.redirect(`${origin}${withReturnTo("/profile", next)}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
