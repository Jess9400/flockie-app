# 2026-08-17 Club invites multi-use + next-gathering preview

## Canonical source

- `supabase/club-invite-multiuse.sql`

## Scope

- Founder invite links become MULTI-USE until their 14-day expiry (or revocation): the single-use rule broke the real usage of one link shared with a whole previous-vibe group - the first click consumed it, everyone else saw "expired".
- DATA FIX included: links consumed by the single-use rule but still inside their window are reactivated (status back to active, accepted_by/at cleared, accepted_count keeps 1).
- `club_founder_invites` + `accepted_count`.
- `accept_club_founder_invite` redefined: no longer flips status; increments the counter; clicking again after joining is a graceful no-op; pending 'invited'/'requested' memberships upgrade to founding (an invite trumps an open vote, whose ballot is cleared).
- `club_founder_invite_detail` DROPPED + recreated with next-gathering columns (id/title/starts_at/timezone via lateral) so the landing page previews the next event like a vibe invitation.
- App: the invite landing shows a "Next gathering" card with the event-local time.
- Access model unchanged: authenticated-only, anon revoked, token-gated.

## Preconditions

- `club-founder-invites.sql`, `club-democratic-entry.sql` (club_join_votes) live.

## Deploy

- Run `supabase/club-invite-multiuse.sql` in the Supabase SQL editor. Idempotent EXCEPT the data fix, which is safely re-runnable (guarded on status/expiry). Deploy order irrelevant (page tolerates missing columns as null).

## Verify

- Preflight (read-only): `select status, accepted_count, expires_at from public.club_founder_invites order by created_at desc limit 5;` - previously "accepted" unexpired rows now show active.
- User path: two different accounts open the SAME invite link - both join as founding members; a third click by either is a no-op landing on the club; the landing page shows the next gathering with its local time.

## Rollback

- Re-run the two function definitions from `club-founder-invites.sql` (restores single-use); `accepted_count` stays inert.

## Addendum (same day): one canonical link per club

`create_club_founder_invite` becomes get-or-create: an active unexpired link
is returned unchanged with its 14-day validity rolled forward (copying the
link keeps it alive); a new link is minted only when none exists or after a
revoke. The panel is now a single copy-link button with a guarded
"generate new" for compromised links. RE-RUN `club-invite-multiuse.sql`.

## Addendum 2 (2026-08-20): status flags no longer gate validity

Founder report: links went "invalid after a few people join". Root cause: a
single-use code path (legacy definition, or a partially applied run) sets
`status = 'accepted'` on first acceptance, and every read path required
`status = 'active'`, so one joiner locked out everyone else holding the same
link. Hardened: `club_founder_invite_detail`, `accept_club_founder_invite`
and the get-or-create lookup now treat a link as valid when it is NOT revoked
and NOT past `expires_at`. The `accepted`/`expired` flags are ignored, so a
legacy write cannot kill a live link. The data fix resurrects links flagged
accepted/expired in the last 30 days and gives them a fresh 14-day window.
Revoked stays dead: that kill is deliberate. RE-RUN
`club-invite-multiuse.sql`.
