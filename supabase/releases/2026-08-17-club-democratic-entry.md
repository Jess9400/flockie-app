# 2026-08-17 Democratic club entry (Stage C)

## Canonical source

- `supabase/club-democratic-entry.sql`

## Scope

- `club_memberships` + `request_message` (the applicant's intro, <= 600 chars). No data changes.
- New `club_join_votes` table (PK club/candidate/voter): member-readable tallies, RPC-only writes.
- `request_club_membership` REWRITTEN with `p_message` (old 1-arg signature DROPPED - the deployed app always sends the message); posts the automatic "ACCEPT NEW MEMBER: ... YES/NO" system message into the club chat, clears any stale ballot, and notifies the host.
- New `vote_club_member` (active members incl. host, not the candidate, one changeable vote): decides automatically at MAJORITY of the electorate (`_club_electorate` internal helper = active members + host if off-roster, minus candidate). YES -> regular + welcome notification (href `?welcome=1`) + celebration chat message. NO -> declined + kind notification pointing at similar clubs (`/clubs?city=`). Ballot cleared on decision.
- New `club_membership_candidates` reader (member-gated) for the voting panel.
- `approve_club_membership` / `decline_club_membership` (manager override) redefined ONLY to also clear the ballot and reuse the kind decline text; approval now links `?welcome=1`. Supersedes the club-moderators.sql versions.
- App: intro textarea (required, min 20 chars) on the request card; voting panel for every active member with live tally + needed-to-decide count; welcome card on `?welcome=1` offering free vs paid membership (benefits + checkout when payments enabled).
- Access model: SECURITY DEFINER + explicit search_path; authenticated-only, anon revoked; internal helpers revoked from all callers. No anonymous surface; allowlist unchanged.

## Preconditions

- `club-moderators.sql` (is_club_manager), `clubs-loop.sql` (`club_messages`), `club-socio-tier.sql` - all live.

## Deploy

- Run `supabase/club-democratic-entry.sql` in the Supabase SQL editor. Idempotent, safe to re-run. NOTE: drops the 1-arg `request_club_membership` - deploy the app first (already done in the same push) so requests carry the message.

## Verify

- Preflight (read-only): `select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'request_club_membership';` → exactly one row: `p_club uuid, p_message text`.
- Anon probe: `vote_club_member` → 42501.
- User path: attendee requests with an intro → poll message appears in the club chat → two members vote YES in a 3-member club → applicant flips to regular, gets the acceptance notification, and `?welcome=1` shows the free/paid choice; a NO-majority case sends the kind decline linking to the clubs directory.

## Rollback

- Re-run the `request_club_membership` definition from `clubs-foundation.sql` and the approve/decline pair from `club-moderators.sql`; drop `vote_club_member`, `club_membership_candidates`, `_club_electorate`, and `club_join_votes`. `request_message` can stay (inert).
