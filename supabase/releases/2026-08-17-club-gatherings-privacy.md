# 2026-08-17 Club gatherings invite-only + member notifications

## Canonical source

- `supabase/club-gatherings-privacy.sql`

## Scope

- `vibe_directory` view: `club_id` appended at the END (view append rule). No column changes before it.
- `recommended_vibes`: club gatherings excluded (supersedes `recommended-vibes-joinable.sql`).
- `invite_city_fallback`: early-return for club gatherings - no city nudges into members-only meetups (supersedes `vibe-city-fallback-recommend.sql`).
- New: `vibes.club_notified_at` + `notify_club_gathering(uuid)` - host-only, once per gathering, notifies every active member except the host ('club_gathering', inbox-only type). Called by the create-form after scheduling.
- App side (no SQL): browse/home filter club gatherings out client-side (degrades gracefully before this runs); the detail page shows a locked members-only card to outsiders without an interest row or invite code; the host's Share button on club gatherings appends the host invite code so the private link admits guests via the join-with-code flow.
- Access model: SECURITY DEFINER + explicit search_path; authenticated-only, anon revoked. `public_vibe` (anon invite page) intentionally still serves club gatherings - the private link is the entry path.

## Preconditions

- `vibe-directory-timezone.sql` applied (view currently ends at `timezone`) - true on prod.
- `clubs-foundation.sql` (`is_club_host`, memberships), `notify` live.

## Deploy

- Run `supabase/club-gatherings-privacy.sql` in the Supabase SQL editor. Idempotent, safe to re-run.
- Runner: founder, after the app deploy. Before the SQL: everything behaves as today (gatherings stay visible); the new notify call errors silently (fire-and-forget).

## Verify

- Preflight (read-only): `select column_name from information_schema.columns where table_name = 'vibe_directory' and column_name = 'club_id';` → one row.
- User path: schedule a gathering from a club (members get the notification); confirm it does NOT appear on /vibes or Home for a non-member; open its /vibes/[id] as a non-member → locked card; open the shared invite link (carries ?code=) → join works.

## Rollback

- Re-run `recommended-vibes-joinable.sql` and `vibe-city-fallback-recommend.sql` (previous canonicals); drop `notify_club_gathering`; the view column and `club_notified_at` can stay (inert).

## Addendum 2026-08-17 (same day)

`express_interest` (canonical `vibe-express-interest-autoconfirm.sql`) gains a
club-member fast path: an active member tapping join on their club's gathering
is CONFIRMED directly (capacity-guarded, same side effects), whatever the
matching state - members are pre-vetted, matching is irrelevant inside a club.
The detail page shows them the "Join now" direct-confirm button accordingly.
RE-RUN `vibe-express-interest-autoconfirm.sql` on prod.

## Addendum 2 (same day): auto-pin in the club chat

`notify_club_gathering` now also upserts the club chat's pin (chat_pins,
one pin per chat) with the gathering title + event-local date and a
confirm-attendance nudge - the newest gathering always replaces the previous
pin. Requires `chat-pins.sql` live (it is). RE-RUN
`club-gatherings-privacy.sql` on prod.
