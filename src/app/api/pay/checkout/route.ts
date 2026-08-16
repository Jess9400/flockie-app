import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 4 * 1024;

// Provider router, v1: NowPayments (crypto) is the only live rail. Asaas (BRL
// cards + recurring, platform-account questions pending) and Stripe (needs the
// legal entity) plug in here later - same internal payment record either way.
// The platform fee is deducted at the PROVIDER layer, never by this code.
export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "request too large" }, { status: 413 });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "payments are not configured yet" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { kind?: string; clubId?: string; orderId?: string; months?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* validated below */
  }
  const kind = body.kind === "order" ? "order" : "socio";
  if (!body.clubId) return NextResponse.json({ error: "missing club" }, { status: 400 });

  // Validates membership/order state and snapshots the amount server-side.
  const { data: created, error: createErr } = await supabase.rpc("create_club_payment", {
    p_kind: kind,
    p_club: body.clubId,
    p_order: body.orderId ?? null,
    p_months: kind === "socio" ? Math.min(Math.max(Math.trunc(body.months ?? 1), 1), 24) : null,
    p_provider: "nowpayments",
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
  const payment = created as { payment_id: string; amount_cents: number; currency: string };

  const origin = new URL(req.url).origin;
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: payment.amount_cents / 100,
      price_currency: payment.currency.toLowerCase(),
      order_id: payment.payment_id,
      order_description: kind === "socio" ? "Flockie club socio membership" : "Flockie club store order",
      ipn_callback_url: `${origin}/api/pay/nowpayments-ipn`,
      success_url: `${origin}/clubs/${body.clubId}${kind === "order" ? "/store" : ""}`,
      cancel_url: `${origin}/clubs/${body.clubId}${kind === "order" ? "/store" : ""}`,
    }),
  });
  const invoice = (await res.json()) as { id?: string | number; invoice_url?: string; message?: string };
  if (!res.ok || !invoice.invoice_url) {
    console.warn("[pay] NowPayments invoice failed:", res.status, invoice.message ?? "");
    return NextResponse.json({ error: "could not create the payment" }, { status: 502 });
  }

  await supabase.rpc("set_club_payment_invoice", {
    p_payment: payment.payment_id,
    p_invoice: String(invoice.id ?? ""),
  });

  return NextResponse.json({ url: invoice.invoice_url });
}
