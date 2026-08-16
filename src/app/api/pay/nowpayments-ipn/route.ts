import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 64 * 1024;

// NowPayments signs the IPN body with HMAC-SHA512 over the JSON with its keys
// sorted alphabetically, using the account's IPN secret.
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort());
  const expected = createHmac("sha512", secret).update(sorted).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// NowPayments IPN: settles our internal payment record after signature
// verification. Settlement runs as service_role (settle_club_payment is
// granted to service_role exclusively) and is idempotent - NowPayments
// retries and sends multiple status updates per payment.
export async function POST(req: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get("x-nowpayments-sig"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    payment_status?: string;
    order_id?: string;
    payment_id?: string | number;
  };
  if (!payload.order_id) return NextResponse.json({ ok: true });

  // finished = fully paid. failed/refunded/expired = terminal non-payment.
  // Everything else (waiting/confirming/partially_paid) is in-flight - ack and
  // wait for the next IPN.
  const status = payload.payment_status ?? "";
  const outcome =
    status === "finished" ? "confirmed" : ["failed", "refunded", "expired"].includes(status) ? "failed" : null;
  if (!outcome) return NextResponse.json({ ok: true });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.rpc("settle_club_payment", {
    p_payment: payload.order_id,
    p_outcome: outcome,
    p_provider_ref: payload.payment_id != null ? String(payload.payment_id) : null,
  });
  if (error) {
    console.warn("[pay] settle failed:", error.message);
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
