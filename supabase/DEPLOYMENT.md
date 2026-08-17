# Production SQL deployment process

This is the required process for every Flockie SQL change. A GitHub merge only
updates the repository; it does not change the Supabase production database.

## 1. Keep the release small

- One product area per SQL release.
- Edit the canonical source named in `SQL-MAP.md`; never revive a tombstoned or
  do-not-run file.
- A release bundle is a copy for deployment, not the source of truth.
- Do not combine unrelated feature SQL, RLS changes, and data cleanup in one
  production run.

## 2. Review before merge

Every SQL PR must state:

1. the canonical source file;
2. affected tables, functions, policies, and cron jobs;
3. whether existing data is changed or only schema/code is changed;
4. the required dependency order;
5. the exact post-deploy checks; and
6. whether a manual production action is required.

Changes that create a cron job, alter RLS, drop a function, or replace a
function return type require an explicit safety review.

## 3. Run a read-only production preflight

Before running a release, first run this in the Supabase SQL editor. It only
lists the relevant live functions; it changes nothing.

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = any (array[
    'activity_feed', 'buddy_swipe', 'buddy_chat_summaries', 'can_access_chat',
    'club_gatherings', 'club_heartbeat_tick', 'club_members', 'leave_club',
    'my_club_chats', 'my_flock_chats', 'post_workspace_event', 'trip_board',
    'trip_detail'
  ])
order by p.proname, arguments;
```

Save the result with the release notes. This tells us whether production has
the expected function signatures before a script replaces anything.

## Current releases

Per-release detail now lives in dated records under `supabase/releases/`;
this list only tracks what is approved and pending or recently applied.

- 2026-08-14 `club-moderators.sql` - club moderator role; see
  `supabase/releases/2026-08-14-club-moderators.md`. Applied to production
  2026-08-14 (probe-verified).
- 2026-08-16 `club-media.sql` - private club media bucket + gallery table and
  storage policies; see `supabase/releases/2026-08-16-club-media.md`. Requires
  `club-moderators.sql`. Pending production run.
- 2026-08-16 `club-socio-tier.sql` - paid Socio membership entitlement layer
  (no money through Flockie); see `supabase/releases/2026-08-16-club-socio-tier.md`.
  Applied to production 2026-08-16 (probe-verified, second run).
- 2026-08-16 `club-store.sql` - club merchandise store (products/orders,
  rail-agnostic); see `supabase/releases/2026-08-16-club-store.md`. Requires
  `club-moderators.sql`. Pending production run.
- 2026-08-16 `club-payments.sql` - payments foundation + NowPayments
  settlement; see `supabase/releases/2026-08-16-club-payments.md`. Applied to
  production 2026-08-16 (probe-verified) and ACTIVATED (env keys live).
- 2026-08-17 RE-RUN `vibe-express-interest-autoconfirm.sql` - club members
  one-tap confirm into club gatherings (addendum in the gatherings-privacy
  release record). Pending production run.
- 2026-08-17 `club-invite-multiuse.sql` - club invite links multi-use +
  next-gathering preview (includes a data fix reactivating consumed links);
  see `supabase/releases/2026-08-17-club-invite-multiuse.md`. Pending
  production run.
- 2026-08-17 `club-democratic-entry.sql` - member voting on join requests;
  see `supabase/releases/2026-08-17-club-democratic-entry.md`. Requires
  `club-moderators.sql` + `clubs-loop.sql`. Pending production run.
- 2026-08-17 `club-guest-invites.sql` - lifetime bring-a-guest quotas (paid 3 /
  free 1); see `supabase/releases/2026-08-17-club-guest-invites.md`. Requires
  `club-gatherings-privacy.sql`. Pending production run.
- 2026-08-17 `club-gatherings-privacy.sql` - club gatherings invite-only +
  member notifications; see
  `supabase/releases/2026-08-17-club-gatherings-privacy.md`. Pending
  production run.
- 2026-08-17 RE-RUN `club-socio-tier.sql` + `club-payments.sql` - copy only:
  paid tier renamed Socio -> Member in notification texts (founder call).
  Idempotent re-runs, no schema change.

## 4. Apply only an approved release

Run the approved source or bundle once in the Supabase SQL editor, then wait
for it to finish successfully. Do not paste a second file after an error.

For the July 25 workspace release:

- `run-all.sql` contains the ten scripts listed in `SQL-MAP.md`.
- Before running it, the production preflight must show
  `club_members(uuid)`. `club-workspace.sql` in the bundle calls that function,
  but its source file, `club-chat-settings.sql`, is outside the bundle. If it
  is missing, stop: do not run the bundle until the Club dependency is planned
  and approved separately.
- `clubs-loop.sql` is intentionally excluded. It creates the
  `flockie-club-heartbeat` hourly cron and can schedule new Club Vibes and send
  notifications. It needs separate product approval.
- `club-chat-settings.sql` is also excluded. It may be run only after the
  preflight confirms that `club_messages` and the Club membership helpers are
  already live.
- `say-hi-note.sql` and `home-carousels.sql` are separate releases and need
  their own preflight because they replace widely used matching functions.

## 5. Verify immediately

After a successful run:

1. refresh the Supabase schema cache if the script does not already do so;
2. run the same read-only preflight and confirm the expected signatures;
3. test the exact UI path affected by the release with a normal user account;
4. check the browser and Supabase logs for RPC or RLS errors; and
5. record the file, commit SHA, runner, timestamp, and result in the release
   notes before any later SQL is run.

## Non-negotiable rules

- Never run `_all-pending.sql` or `match-weights.sql`.
- Never run a historical deploy bundle as a substitute for a current canonical
  source.
- Never assume a script has run because its PR merged.
- Never enable a cron-driven feature without confirming its user-facing
  behavior, notification volume, and stop/rollback path.
