# 2026-08-16 Club store (merchandise, rail-agnostic v1)

## Canonical source

- `supabase/club-store.sql`

## Scope

- New tables: `club_products` (title, description, photo, price_cents + per-product currency, active) and `club_orders` (price snapshot, status pending/paid/delivered/cancelled). No existing data changes.
- RLS: members read active products (host reads all, host full write); orders readable by buyer or club managers; NO direct order writes - RPCs only.
- New RPCs: `place_club_order` (member-gated, snapshots price, notifies host - 'club_order' inbox type), `set_club_order_status` (HOST-only paid/delivered/cancelled, notifies buyer - 'club_order_update'), `cancel_my_club_order` (buyer, pending only).
- Access model: SECURITY DEFINER + explicit search_path, authenticated-only, anon revoked. No anonymous surface; allowlist unchanged. **No money through Flockie** - orders are intents; the host confirms payment collected outside (PSP checkout replaces the manual confirm later).

## Preconditions

- `clubs-foundation.sql` + `club-moderators.sql` (is_club_manager) live - probe-verified.

## Deploy

- Run `supabase/club-store.sql` in the Supabase SQL editor. Idempotent, safe to re-run.
- Runner: founder, after the app deploy. Before the SQL: the Store page renders but every action errors; nothing else affected.

## Verify

- Preflight (read-only): `select count(*) from information_schema.tables where table_name in ('club_products','club_orders');` → 2.
- Anon probe: `POST /rest/v1/rpc/place_club_order` with the anon key → 42501.
- User path: host adds a product; a member orders it (host gets the notification); host marks paid then delivered (buyer gets both notifications); buyer cancels a second pending order.

## Rollback

- `drop function` the three RPCs and `drop table public.club_orders, public.club_products;` (orders cascade from products/clubs; nothing else references them).
