# Session changelog — home redesign + bug fixes

Worked on the home page (intent-first redesign), the "Say hi → activity" flow,
several bug fixes, and a matching-cron correctness fix. All PRs below are merged
to `main` and deployed to production unless noted.

## Cofounder PRs we merged (her work, shipped as-is)

- **#64** — Clarify reveal CTA after signup
- **#63** — Phase-1 latency cleanup (parallel Supabase reads on Home/Vibes + an index file)
- **#27** — "Vibe matching reminders" — **left UNMERGED** intentionally

## Our changes (merged → production)

| PR  | Summary | Needs SQL run? |
|-----|---------|----------------|
| #65 | pg_trgm city index — corrects #63's unusable `lower(city)` btree | Yes — `home-carousels.sql` / trgm |
| #66 | Stop "Review this Vibe" prompting after you've already reviewed | Yes — `public-profile-events.sql` |
| #67 | Intent-first home redesign | No |
| #68 | Empty-state CTAs, compact filters, vibe-check call-out | No |
| #69 | Remove match-people button; compact flock request button | No |
| #70 | "Explore vibes around the world" carousel below "Happening near you" | No |
| #71 | Say hi → invite a recommendation to an activity (reuses `buddy_swipe`) | No |
| #72 | Design polish: motion, hero, match rings, floating Create button | No |
| #73 | Dismissible "what does the % mean" legend | No |
| #74 | Flock join-request match %; fixed invisible category tag | No |
| #75 | Portal Say hi modal (flicker fix) | No |
| #76 | Trip matching gates on `trip_prefs` (no more /profile bounce) | No |
| #77 | Stop matching/notifying for already-started Vibes | **Yes** — `vibe-auto-matching.sql` |

### Pending SQL migrations to run on Supabase
- `supabase/home-carousels.sql` — #65 trgm index + `city_people` / `home_flocks` RPCs
- `supabase/public-profile-events.sql` — #66 `reviewed` flag
- `supabase/vibe-auto-matching.sql` — #77 (re-run the 3 changed functions:
  `invite_city_fallback`, `auto_rank_due_vibes`, `autofill_open_vibes`)
- (#63 indexes already run)

## Bugs fixed

- **Notifications for already-finished Vibes** (#77): the scheduled matchers
  (`auto_rank_due_vibes`, `autofill_open_vibes`) filtered by status but not time,
  so Vibes stuck in `open`/`ranking` past their start kept getting ranked and the
  city fallback kept sending invites. Added `starts_at > now()` guards + an early
  bail in `invite_city_fallback`.
- **Create trip → bounced to /profile** (#76): `/match?mode=trip` required the
  activity-vibe (`activities`), unrelated to trips. Now gates on `trip_prefs_complete`.
- **Say hi modal flicker** (#75): the card hover-lift transform trapped the modal's
  `position: fixed`; portaled it to `<body>`.
- **Invisible category tag** (#74): `VibeCard`'s category badge had no text color,
  so inside the blue "Happening near you" box it inherited `text-white`. Added `text-ink`.
- **Review CTA after reviewing** (#66): profile events list never knew if you'd
  reviewed; now returns a `reviewed` flag and shows "Edit your review".

## City-fallback behavior (not a bug — for reference)

`invite_city_fallback` only invites people whose `home_city` matches the Vibe's
city, who've done the activity vibe-check, when the room is short of capacity and
within 48h of the signup deadline (or in ranking). It is strictly **same-city** —
it never pulls people from other cities.

## What we touched from cofounder (`stayavl-collab`) work

Determined by git authorship. Note: the **matching engine is mostly Jess's own
work** — the city-fallback / auto-run logic in `vibe-auto-matching.sql` are Jess's
commits; `stayavl-collab` only contributed the "Not for me" signal there.

| File | Our change (PR) | Her footprint |
|------|-----------------|---------------|
| `src/app/(app)/home/page.tsx` | full redesign (#67–73) | 5 of 23 commits |
| `src/app/(app)/vibes/[id]/page.tsx` | different-city banner (#66) | 5 of 41 commits |
| `src/components/VibeCard.tsx` | `text-ink` on category badge (#74) | 3 of 10 commits |
| `src/app/(app)/match/page.tsx` | trip-mode gate (#76) | 1 of 24 commits |
| `supabase/vibe-auto-matching.sql` | time guards (#77) | 1 of 4 commits |

**Did NOT touch her work** (no `stayavl-collab` history): `FlockJoinRequests.tsx`,
`FlockRequestButton.tsx`, `ProfileEvents.tsx`, `public-profile-events.sql`,
`my-trips/page.tsx`, and all new files (`HomeHero`, `CreateFab`, `SayHiButton`,
`MatchKeyTip`, `home-carousels.sql`, `performance-indexes-trgm.sql`).

Highest overlap with her work: the **home page redesign** and **matching/gate
changes (#76, #77)** — worth a sync with her since those are shared surfaces.
