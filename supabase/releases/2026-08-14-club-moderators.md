# 2026-08-14 Club moderators

## Canonical source

- `supabase/club-moderators.sql`

## Scope

- `club_memberships.role` check constraint gains `'moderator'` (schema only, no data changes).
- New helper functions: `is_club_moderator(uuid)`, `is_club_manager(uuid)` (host OR moderator).
- New RPC: `set_club_member_role(uuid, uuid, text)` - host-only promote/demote between `member` and `moderator`; notifies on promotion (`club_moderator` type, inbox-only like other club types).
- Redefined with a manager gate (was host-only): `approve_club_membership`, `decline_club_membership` (supersedes `club-membership-decisions.sql`), `record_club_attendance`.
- RLS: `club_memberships` and `club_attendance` select policies extended from own-or-host to own-or-manager so moderators can see pending requests and attendance rows.
- Access model: all functions SECURITY DEFINER with explicit `search_path = public`; execute granted to `authenticated` only, revoked from `public`/`anon`. No anonymous surface; `public-rpc-allowlist.json` unchanged.

## Preconditions

- `clubs-foundation.sql` live (club tables, `is_club_host`, `is_club_member`, `notify`).
- `club-membership-decisions.sql` live (this release supersedes its `decline_club_membership`).

## Deploy

- Run `supabase/club-moderators.sql` in the Supabase SQL editor (production). Idempotent, safe to re-run.
- Runner: founder, after the app deploy (UI degrades gracefully before the SQL: the panel errors only when a role change is attempted).

## Verify

- Preflight (read-only, expect the constraint to list three roles after deploy):
  `select pg_get_constraintdef(oid) from pg_constraint where conname = 'club_memberships_role_check';`
- Anon probe: `POST /rest/v1/rpc/set_club_member_role` with the anon key must return 42501 permission denied.
- User path: as a club host, open the club page → Moderators panel → promote a member; as that member, open the club page and approve a pending membership request.

## Rollback

- `update public.club_memberships set role = 'member' where role = 'moderator';` then re-run the previous canonical definitions (`clubs-foundation.sql` functions + policies, `club-membership-decisions.sql`) and drop `set_club_member_role`, `is_club_manager`, `is_club_moderator`. The constraint can then be tightened back to two roles.
