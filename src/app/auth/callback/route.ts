import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the OAuth / email-confirmation redirect: exchanges the code for a
// session, then sends the user into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete, vibe_completed_at")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.vibe_completed_at) {
          return NextResponse.redirect(`${origin}/onboarding/profile`);
        }
        if (!profile.onboarding_complete) {
          return NextResponse.redirect(`${origin}/profile`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
