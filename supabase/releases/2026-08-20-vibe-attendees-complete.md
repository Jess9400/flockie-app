# 2026-08-20 Attendee lists show every attendee

## Canonical source

- `supabase/vibe-attendees-rls.sql`

## Scope

- Founder report: a gathering read "Going (4) - 6 confirmed attendance", with
  two confirmed people missing from both the face chips and the host's
  "Invited & going" panel.
- Root cause: `public_profiles` ends in `where p.onboarding_complete or p.id =
  auth.uid()`. Anyone who signed up through an invitation and never finished
  onboarding is counted by the tallies (which read `vibe_interests` directly)
  but dropped by every list that joins the safe view.
- `vibe_attendees` now joins `public.profiles`. Same three fields
  (id, display_name, photos); who is coming to an event you can already see is
  not a discovery question, so the completeness filter does not belong here.
- New `vibe_people(p_vibe, p_ids)`: host-only name/photo lookup for people who
  have an interest row on that vibe, used by the shortlist, private-request
  and roster panels for the same reason.
- Discovery is deliberately untouched: `public_profiles` still hides
  unfinished profiles everywhere else.
- App: the host roster is now built from the interest rows rather than from
  the profile lookup, so a missing profile row can never remove a person from
  a list the host acts on.

## Preconditions

- None; supersedes the previous definition in the same file.

## Deploy

- Re-run `supabase/vibe-attendees-rls.sql` in the Supabase SQL editor. Safe to
  re-run (it also re-asserts the scoped `interests read` policy).

## Verify

- Anon probes return 42501 for `vibe_attendees` and `vibe_people`.
- User path: on a gathering where the counts disagreed, the face chips now
  match the confirmed count, and the host's "Invited & going" list shows the
  same number of people.

## Rollback

- Restore the previous body of `vibe_attendees` (join `public_profiles`) and
  `drop function public.vibe_people(uuid, uuid[]);`.
