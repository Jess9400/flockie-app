# 2026-08-16 Club payments foundation + NowPayments settlement

## Canonical source

- `supabase/club-payments.sql`

## Scope

- New table `club_payments` (kind socio/order, amount snapshot, provider, provider_invoice_id, status created/confirmed/failed). No existing data changes.
- RLS: readable by the payer or the club host; NO direct writes.
- New RPCs: `create_club_payment` (authenticated - validates membership/offer/own-pending-order, snapshots amount), `set_club_payment_invoice` (authenticated, own created row), `settle_club_payment` (**granted to service_role EXCLUSIVELY**, revoked from authenticated - only the HMAC-verified webhook settles; idempotent; on confirm applies socio activation or order-paid + notifications: 'club_socio', 'club_socio_payment', 'club_order_update', 'club_order').
- App routes (no SQL): `/api/pay/checkout` (auth + provider router, NowPayments invoice creation) and `/api/pay/nowpayments-ipn` (HMAC-SHA512 sorted-key signature verification, service-role settlement). Both 503 until env vars exist.
- Access model: SECURITY DEFINER + explicit search_path throughout; anon revoked; no anonymous surface; allowlist unchanged. Platform fee is deducted at the provider layer; Flockie holds no funds (crypto proceeds accrue in the platform NowPayments account, payouts manual v1).

## Preconditions

- `club-socio-tier.sql` + `club-store.sql` live.
- Env (Vercel, for activation - SQL can run before): `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`; `SUPABASE_SERVICE_ROLE_KEY` already present for the email pipeline.

## Deploy

- Run `supabase/club-payments.sql` in the Supabase SQL editor. Idempotent, safe to re-run.
- Runner: founder. Until the env vars exist the pay buttons are hidden and the routes answer 503; manual mark-paid keeps working regardless.

## Verify

- Preflight (read-only): `select proname from pg_proc where proname in ('create_club_payment','set_club_payment_invoice','settle_club_payment');` → 3 rows.
- Anon probe: all three RPCs → 42501. AUTHENTICATED probe of `settle_club_payment` must ALSO be denied (service_role only).
- User path (after env vars): tap "Pay with crypto" on a socio card → NowPayments invoice opens; sandbox-pay → socio activates automatically and both notifications arrive.

## Rollback

- Drop the three RPCs and `club_payments`; remove the two API route files. Socio/store manual flows are unaffected.
