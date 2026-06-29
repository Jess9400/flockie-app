import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// One-click unsubscribe from the email footer. Sets profiles.email_notifications
// = false for the row matching the (unguessable) token.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const html = (msg: string) =>
    new Response(
      `<!doctype html><html><body style="font-family:sans-serif;max-width:420px;margin:60px auto;text-align:center;color:#1a1a1a;"><h2>${msg}</h2><p style="color:#666;">You can re-enable emails anytime in your Flockie settings.</p></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } }
    );

  if (!token) return html("Invalid unsubscribe link.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return html("Something went wrong — please try again later.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin
    .from("profiles")
    .update({ email_notifications: false })
    .eq("email_unsubscribe_token", token);

  if (error) return html("Something went wrong — please try again later.");
  return html("You've been unsubscribed from Flockie emails.");
}
