# 2026-08-16 Club Socio tier (paid membership entitlement layer)

## Canonical source

- `supabase/club-socio-tier.sql`

## Scope

- `clubs`: + `socio_price_cents` (null = no paid tier), `socio_currency` (default BRL), `socio_perks`. Host edits directly (existing "clubs host update" RLS).
- `club_memberships`: + `tier` ('free'/'paid', default free), `paid_until`. No data changes; every existing member stays free.
- New helper `is_club_socio(uuid)` (paid + unlapsed, managers always pass).
- New RPC `mark_club_socio(uuid, uuid, int)` - HOST-only (moderators excluded deliberately: money is the host's). months>0 extends `paid_until` (early renewals keep remaining days), months=0 resets to free. Notifies on activation ('club_socio', inbox-only type).
- New RPC `club_socio_offer(uuid)` - member-safe reader for the offer + own standing (clubs base table is host-read-only).
- `club_media`: + `paid_only` flag; member-read policy replaced - free members no longer see paid_only rows (managers and active socios do). Storage-object access is unchanged (paths are unguessable UUIDs and only leak through the now-gated table).
- Access model: SECURITY DEFINER + explicit search_path, authenticated-only execute, anon revoked. No anonymous surface; allowlist unchanged. **No money moves through Flockie** - this is entitlement bookkeeping for host-collected payments.

## Preconditions

- `club-moderators.sql` (is_club_manager) and `club-media.sql` - both live and probe-verified on prod.

## Deploy

- Run `supabase/club-socio-tier.sql` in the Supabase SQL editor. Idempotent, safe to re-run.
- Runner: founder, after the app deploy. Before the SQL: the Socio panel renders but saving/marking errors; media uploads with the toggle error. Nothing else affected.

## Verify

- Preflight (read-only): `select column_name from information_schema.columns where table_name = 'club_memberships' and column_name in ('tier','paid_until');` → two rows.
- Anon probe: `POST /rest/v1/rpc/mark_club_socio` with the anon key → 42501.
- User path: host sets a price + perks and marks a member paid (they get the notification and the club page shows "Socio until ..."); upload a "Socios only" media item and confirm a free member does not see it while the marked member does.

## Rollback

- Set every membership free (`update public.club_memberships set tier='free', paid_until=null;`), restore the previous `club media member read` policy from `club-media.sql`, and drop `mark_club_socio`, `club_socio_offer`, `is_club_socio`. Columns can stay (inert) or be dropped afterwards.
