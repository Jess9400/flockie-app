# 2026-08-17 Club guest invites (lifetime quotas)

## Canonical source

- `supabase/club-guest-invites.sql`

## Scope

- New table `club_guest_invites` (one-time, per gathering, tracks inviter + redeemer). RLS: inviter or club host read; RPC-only writes. No existing data changes.
- `_club_guest_allowance(uuid, uuid)` internal helper (revoked from all callers): lifetime allowance per member per club - 3 once they have EVER paid (tier paid or paid_until set - so a later upgrade unlocks the remaining 2), else 1.
- `create_club_guest_invite(uuid)` (authenticated): member-gated, upcoming club gatherings only, quota counted at creation.
- `redeem_club_guest_invite(uuid)` (authenticated): one-time, not-own-invite, capacity-guarded; confirms the guest via `_auto_confirm_member` (chat + location + auto-confirm model); notifies guest ('vibe_confirmed') and inviter ('club_guest_joined', inbox-only).
- App (no SQL): "Bring a guest (N left)" button on club gatherings for members; guest link lands on /invite/[id]?guest= -> "Accept your invitation" -> redeem card on the vibe page; guest param bypasses the members-only lock so the link works for signed-up outsiders.
- Access model: SECURITY DEFINER + explicit search_path; anon revoked; no anonymous surface; allowlist unchanged.

## Preconditions

- `club-socio-tier.sql` (tier/paid_until), `vibe-auto-confirm-invites.sql` (`_auto_confirm_member`), `club-gatherings-privacy.sql` - all live and probe-verified.

## Deploy

- Run `supabase/club-guest-invites.sql` in the Supabase SQL editor. Idempotent, safe to re-run.
- Runner: founder, after the app deploy. Before the SQL: the button errors on tap; nothing else affected.

## Verify

- Preflight (read-only): `select proname from pg_proc where proname in ('create_club_guest_invite','redeem_club_guest_invite','_club_guest_allowance');` → 3 rows.
- Anon probe: create/redeem RPCs → 42501.
- User path: as a free member, mint 1 guest link (button then shows none left); open it from another account → accept → confirmed into the gathering, inviter notified; a second open of the same link errors "already used".

## Rollback

- Drop the three functions and `club_guest_invites`. Redeemed guests keep their confirmed spots (ordinary interest rows).
