import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { inviterId: string } }
) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirect = `/join/${params.inviterId}/accept`;
    return NextResponse.redirect(
      `${origin}/login?ref=${encodeURIComponent(params.inviterId)}&redirect=${encodeURIComponent(redirect)}`
    );
  }

  await supabase.rpc("claim_referral", { p_inviter: params.inviterId });
  return NextResponse.redirect(`${origin}/home?referred=1`);
}
