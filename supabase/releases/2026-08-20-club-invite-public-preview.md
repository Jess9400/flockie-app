# 2026-08-20 Club invite links open the club, not a login wall

## Canonical source

- `supabase/club-invite-public-preview.sql`

## Scope

- Founder report: for a NEW user the club link opened the sign-in screen, then
  the age/continue step, then the onboarding form, and only afterwards the
  club invitation. The invitation is the reason they clicked; it has to come
  first.
- Shared Vibe links already work that way (`/invite/<id>` renders through the
  anon-callable `public_vibe`). Club invites went through the
  authenticated-only `club_founder_invite_detail`, so middleware bounced
  signed-out visitors to `/login`.
- New `public_club_invite(p_token)`: token-gated, read-only, returns exactly
  what the landing page renders (club identity + next gathering). No roster,
  no exact venue, no invite bookkeeping. Joining still requires an account -
  only the preview is public.
- ANON ALLOWLIST: deliberate sixth entry in
  `supabase/public-rpc-allowlist.json`.
- Null-safety: the host exclusion is dropped here rather than written with
  `<>`, which would evaluate NULL for anon and hide the row - the opposite of
  the intent. Signed-in viewers still go through
  `club_founder_invite_detail`, which keeps the host guard.
- App: `/clubs/invite/<token>` is exempted from the auth gate in middleware
  (the rest of `/clubs` stays behind it); the accept button becomes a sign-in
  link that returns to the same invite URL, so the flow is club → sign in →
  short profile → back to the invite → accept.

## Preconditions

- `club-invite-permanent.sql` (this reuses its `paused` status in the filter).

## Deploy

- Run `supabase/club-invite-public-preview.sql` in the Supabase SQL editor
  AFTER `club-invite-permanent.sql`. Safe to re-run.

## Verify

- Anon probe SUCCEEDS for this one (by design):
  `POST /rest/v1/rpc/public_club_invite` with a real token returns the club
  row; with a random uuid it returns `[]`.
- Every other RPC still returns 42501 to anon.
- User path: open a club invite link in a private window with no account -
  the club and its next gathering render, and the button leads to sign-in.

## Rollback

- `drop function public.public_club_invite(uuid);`, remove the allowlist
  entry, and drop the `/clubs/invite/` exemption in
  `src/lib/supabase/middleware.ts`.
