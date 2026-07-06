import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildEmail, type NotifRecord } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

// Supabase Database Webhook target: fires on INSERT into public.notifications.
// Configure in Supabase → Database → Webhooks with an `x-webhook-secret` header
// equal to EMAIL_WEBHOOK_SECRET. Sends a Tier-1 transactional email (if the
// notification type is emailable and the user hasn't opted out).
export async function POST(req: Request) {
  // 1. Authenticate the webhook.
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse the Supabase webhook payload.
  let payload: { type?: string; record?: NotifRecord } | null = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const record = payload?.record;
  if (payload?.type !== "INSERT" || !record?.user_id || !record?.type) {
    return NextResponse.json({ ok: true, skipped: "not an insert" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn("[email] missing Supabase service env — cannot look up recipient");
    return NextResponse.json({ ok: true, skipped: "no-service-key" });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 3. Recipient prefs + email.
  const { data: prof } = await admin
    .from("profiles")
    .select("email_notifications, email_unsubscribe_token")
    .eq("id", record.user_id)
    .maybeSingle();
  if (prof?.email_notifications === false) {
    return NextResponse.json({ ok: true, skipped: "opted-out" });
  }
  // Separate (migration-safe) query — `locale` is added by user-locale.sql.
  // Kept apart so this route still works BEFORE that migration runs on prod;
  // buildEmail defaults to English when it's null/missing.
  const { data: loc } = await admin
    .from("profiles")
    .select("locale")
    .eq("id", record.user_id)
    .maybeSingle();
  const { data: u } = await admin.auth.admin.getUserById(record.user_id);
  const to = u?.user?.email;
  if (!to) return NextResponse.json({ ok: true, skipped: "no-email" });

  // 3b. Enrich the confirmed email with the details a confirmed guest needs —
  // title, day, and (they're confirmed, so) the exact location. The vibe stores
  // no timezone, so we show the DATE only and leave the exact time to the chat
  // rather than risk a wrong hour in a server-rendered (UTC) email.
  const vibeId = record.data?.vibe_id;
  if (record.type === "vibe_confirmed" && typeof vibeId === "string") {
    const { data: v } = await admin
      .from("vibes")
      .select("title, starts_at, location_name, area, city")
      .eq("id", vibeId)
      .maybeSingle();
    if (v) {
      const tag = loc?.locale === "pt" ? "pt-BR" : loc?.locale === "es" ? "es" : "en";
      const date = v.starts_at
        ? new Intl.DateTimeFormat(tag, { weekday: "long", month: "long", day: "numeric" }).format(
            new Date(v.starts_at as string)
          )
        : "";
      record.data = {
        ...record.data,
        title: v.title ?? "the Vibe",
        date,
        location: v.location_name || v.area || v.city || "shared in the chat",
      };
    }
  }

  // 4. Build (Tier-1 only) + send.
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://app.findflockie.com";
  const unsubUrl = `${site}/api/email/unsubscribe?token=${prof?.email_unsubscribe_token ?? ""}`;
  // Emails render in the RECIPIENT's persisted language. Default to English so
  // this is safe BEFORE the locale column migration is run on prod (null/missing).
  const email = buildEmail(record, unsubUrl, loc?.locale ?? "en");
  if (!email) return NextResponse.json({ ok: true, skipped: "type-not-emailable" });

  try {
    const result = await sendEmail({ to, subject: email.subject, html: email.html });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[email] send failed", e);
    return NextResponse.json({ error: "send-failed" }, { status: 502 });
  }
}
