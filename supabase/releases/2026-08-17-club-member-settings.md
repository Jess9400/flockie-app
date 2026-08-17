# 2026-08-17 Club member settings (report; leave/visibility reuse)

## Canonical source

- `supabase/club-member-settings.sql`

## Scope

- New `club_reports` table: reason (spam/inappropriate/safety/other) + optional note, one row per user per club (repeat reports update in place). NO select/insert policies by design - writes only via the RPC, reads with the service role during review. No existing data changes.
- New `report_club(uuid, text, text)` RPC: any authenticated viewer except the club's own host; validates reason; upserts.
- Leave and profile-visibility reuse the existing `leave_club` and `set_club_profile_visibility` RPCs - no changes to them.
- App: "Your membership" section at the bottom of the club page for non-hosts (report for any viewer; visibility toggle and leave for active members).
- Access model: SECURITY DEFINER + explicit search_path; authenticated-only, anon revoked. No anonymous surface; allowlist unchanged.

## Preconditions

- `clubs-foundation.sql` live (clubs, memberships, `set_club_profile_visibility`); `club-chat-settings.sql` (`leave_club`).

## Deploy

- Run `supabase/club-member-settings.sql` in the Supabase SQL editor. Idempotent, safe to re-run. Until then the Report button errors; leave/visibility work already.

## Verify

- Anon probe: `POST /rest/v1/rpc/report_club` → 42501.
- User path: member toggles "show on profile" off (profile stops listing the club), reports the club (thanks message; a second report doesn't duplicate - check `select count(*) from club_reports` stays 1 for that pair), leaves the club (lands on /clubs, roster drops them, seat math unaffected).

## Rollback

- Drop `report_club` and `club_reports`. Leave/visibility are untouched features.

## Addendum (same day): member-side paid-tier cancel

New `end_my_club_paid_tier(uuid)` in the same canonical file: a paid member
can end their own tier early (forfeits remaining days, becomes free, host
notified). The settings section shows "Paid member until {date}" with the
explicit "nothing renews automatically" note - and this button is where the
future recurring rail's real cancel will hook in. RE-RUN the file if the
first version was already applied.
