# 2026-08-20 One permanent club invite link

## Canonical source

- `supabase/club-invite-permanent.sql` (supersedes the invite functions in
  `club-invite-multiuse.sql`)

## Scope

- Founder decision after a third "this invitation isn't available" report: a
  club has ONE link, it never expires, and the only way it stops working is
  the host pausing invitations - which is reversible.
- The 14-day window is gone. `expires_at` stays (not null, and every read path
  compares it) but defaults to `'infinity'`, and the data fix makes every
  non-revoked row infinite while reviving anything flagged accepted/expired.
- New `'paused'` status on `club_founder_invites`, set through
  `set_club_invites_paused(p_club, p_paused)` (host only). Reads reject
  `revoked` and `paused` only.
- `create_club_founder_invite` returns THE link whatever its state, so the
  panel can show "paused" rather than silently minting a replacement. It never
  resumes on its own.
- App: the panel drops "generate a new link" (which silently broke every copy
  already shared) for a pause/resume toggle, shows the link text, and states
  that it never expires. The invite landing page now separates its failure
  cases: the host opening their own link, a paused club, a truncated URL, and
  a genuinely dead link each get their own message.

## Preconditions

- `club-founder-invites.sql`, `club-democratic-entry.sql` live.

## Deploy

- Run `supabase/club-invite-permanent.sql` in the Supabase SQL editor. Safe to
  re-run.

## Verify

- Anon probes return 42501 for all four functions incl. `set_club_invites_paused`.
- `select status, expires_at from public.club_founder_invites;` - non-revoked
  rows show `infinity`.
- User path: two people open the same link and both join; the host pauses,
  a third person sees the paused message; the host resumes and the SAME link
  works again.

## Rollback

- Re-run `club-invite-multiuse.sql` (restores the 14-day rule) and
  `drop function public.set_club_invites_paused(uuid, boolean);`. Rows already
  set to `'infinity'` stay valid, which is harmless.
