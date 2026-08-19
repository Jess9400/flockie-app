# 2026-08-20 Club cards show the scheduled gathering

## Canonical source

- `supabase/club-directory-gatherings.sql` (supersedes the `club_directory`
  definition in `clubs-foundation.sql`)

## Scope

- Founder report: a club with a scheduled gathering still showed "First
  gathering being planned" on its browse card.
- Root cause: `club_directory` matched only `v.status = 'open'`. A gathering
  leaves that status as soon as it moves through matching (reviewing,
  ranking, finalized) - which is where every club gathering ends up once its
  attendees are confirmed - so the card fell back to the empty state.
- Now any non-cancelled future gathering counts, matching `club_detail`,
  `club_founder_invite_detail` and the club-chat next-gathering strip, which
  all used the wider rule already.
- No signature or field change; the app needs no deploy.

## Preconditions

- `clubs-foundation.sql` live.

## Deploy

- Run `supabase/club-directory-gatherings.sql` in the Supabase SQL editor.
  Safe to re-run.

## Verify

- Anon probe returns 42501 for `club_directory`.
- User path: the clubs browse card for a club with a confirmed gathering
  shows that gathering's title and date instead of "First gathering being
  planned".

## Rollback

- Re-run the `club_directory` block from `clubs-foundation.sql` (restores the
  `status = 'open'` filter).
