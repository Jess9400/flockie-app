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

---

# Session 2 (2026-06-27 / 06-28) — audit follow-up: security, matching cleanup, P1

Drove the audit findings to resolution. All PRs merged to `main`.

## P0 security — ALL CLOSED
- **#87** (cofounder) — Profile privacy/RLS. `profiles` base table locked to owner-only;
  cross-user reads go through a `security_barrier` definer view `public_profiles`
  (safe fields only — no GPS/`location`, no raw sliders/dealbreakers); socials gated
  by `social_visibility`. Two-phase rollout (prepare → deploy → enforce).
- **#88** (cofounder) — Vibe location privacy. Exact venue/coords private; public
  browsing via `vibe_directory` (country/city/area); exact logistics only for host +
  confirmed attendees. Two-phase rollout.
- **#89** — `buddy_swipe` notifies once (gated to newly-created chat / fresh like).
- **#90** — `trip_join_requests` SELECT scoped (requester / host / co-host / accepted
  member); flocks "going" count moved to a definer RPC `flock_going_counts`.

## Option B profiles (cofounder #84/#85)
- New owner profile dashboard + identity card (#84); public `/people/[id]` rebuilt and
  stops querying raw matching fields (#85).

## Activity-candidate fixes (cofounder #86)
- `activity_candidate_decisions` (contextual pass/like); excludes handled people from
  `city_people` + `activity_candidates`; SwipeDeck error handling; honest empty states.

## Matching engine — single source of truth (#94–#98, repo-only unless noted)
The live functions were dumped from prod (the canonical) and all non-live duplicate
definitions were neutralized so re-running any file can't downgrade the engine.
Canonical files:
- `buddy_pair_score` → `vibe-traits.sql`
- `activity_candidates` → `activity-candidate-decisions.sql`
- `_rank_vibe_core` + `backfill_vibe` → `vibe-v2-private-link.sql`
- `rank_vibe` (thin wrapper) → `vibe-auto-matching.sql`
- `invite_city_fallback` → `vibe-auto-matching.sql` (the #77 `starts_at` version)
- `buddy_swipe` → `buddy-swipe-notify-once.sql` (#89)
- `match-weights.sql` emptied (was the dangerous downgrade: dumb buddy_pair_score +
  mute-bypassing rank_vibe).
- **#98** also added a regex guard to the `activity_skills::int` cast in `_rank_vibe_core`
  and `vibe_match` (skips non-numeric values instead of aborting scoring) — the one
  prod-touching change; applied + verified against the live dump.
- Note: the audit's "standby double-notify" was a non-issue (live ranking uses a
  shortlist→host-review flow). `_all-pending.sql` still has stale copies but
  self-converges (last-write-wins) — harmless, optional cleanup.

## P1 / UX (#91–#93)
- Portaled the remaining modals (InterestButton / ProfilePeek / ActivityVibePopup) —
  same flicker-trap class as the SayHi fix (#91).
- Match-% standardized to coral; `prefers-reduced-motion` disables the ping dots;
  `backfill-prefs-flags.sql` fixes the legacy-user matching dead end (#92).
- Modal a11y (role/aria-modal + Esc-to-close via `useEsc`) + larger tap targets (#93).

## Run-on-Supabase checklist (SQL not auto-applied by deploys)
- ✅ #87 prepare + enforce, #88 prepare + enforce, #89, #90 prepare + enforce — run.
- ✅ #98 `::int` guard (`vibe-v2-private-link.sql` + `recommended-vibes.sql`) — run + verified.
- Verify the rest with: `city_people`/`home_flocks` exist (home-carousels.sql);
  `public_profile_events` contains `reviewed` (public-profile-events.sql);
  `select count(*) from profiles where coalesce(trip_prefs_complete,false)=false and planning is not null` = 0 (backfill-prefs-flags.sql).
- Matching cleanup PRs #94–#97 are **repo-only — no SQL to run.**

## Deferred (optional)
- Brand **contrast** (white on `flockie-blue` fails WCAG) — pending the color decision.
- `_all-pending.sql` monolith dedup (self-converges; low priority).

## Security hardening (#100–#103)
Driven by the "vibe-coded apps" security checklist + a Supabase Security Advisor scan.

| PR | Summary | Needs SQL run? |
|----|---------|----------------|
| #100 | Trips RLS (`can_see_trip` helper, scoped `trips readable` — replaced `using(true)`); per-user rate limiting (`rate_limit_hit` RPC) + auth-gate on `geocode` / `reverse-geocode` | **Yes** — `trips-rls.sql`, `rate-limits.sql` |
| #101 | Tombstone the stale `using(true)` join-requests policy (canonical scoped one is in `trip-requests-rls-enforce.sql` #90) | No (repo-only) |
| #102 | `og` route SSRF hardening + auth + rate limit; generic `generate-cover` error; **WITH CHECK** on 3 UPDATE policies; DO-NOT-RUN header on `_all-pending.sql` | **Yes** — `security-hardening.sql` |
| #103 | Advisor cleanup: pin `set_updated_at` search_path; revoke EXECUTE from all client roles on 9 internal cron/trigger/`notify` functions | **Yes** — `advisor-cleanup.sql` |

### Supabase Security Advisor — triage (2026-06-28)
Scan returned **0 errors, all WARN**. Outcome:
- **Fixed** (`advisor-cleanup.sql`): `function_search_path_mutable` on `set_updated_at`;
  the 9 internal-only functions (5 cron jobs, 3 triggers, `notify`) — revoked from
  `public, anon, authenticated` (verified none are client-called) to clear them from
  both the 0028 (anon) and 0029 (authenticated) lists.
- **Dismiss — working as intended:** the ~95 `authenticated…executable` (0029) rows
  are the app's RPC surface, each gated on `auth.uid()`. The leftover `anon…executable`
  (0028) rows fail safe (`auth.uid()` is null inside); a blanket anon-revoke was rejected
  because the public routes (`/vouch`, `/invite`, `/compat`, `/join`) legitimately need
  `get_vouch_subject` / `submit_vouch` / `public_vibe` / `compat_*` / referral RPCs.
- **Dismiss — managed:** `postgis` / `pg_trgm` `extension_in_public` + `st_estimatedextent`
  (PostGIS-owned; moving breaks dependencies).
- **No action — Pro-only:** `auth_leaked_password_protection` is a paid-plan toggle, and
  signup is Google-only anyway. Revisit if email/password login is added.

## Full audit + P0 fix (2026-06-28)
Ran a 4-track audit (auth/signup, matching algo, core flows, build/breakage).

| PR | Summary | Needs SQL run? |
|----|---------|----------------|
| #105 | **P0** — lock `vibe_interests` self-write to `status='interested'` | **Yes** — `vibe-interests-status-lock.sql` ✅ run on prod 2026-06-28 |

- **P0 (fixed, #105):** the `vibe_interests` INSERT/UPDATE RLS only checked `user_id =
  auth.uid()` — status unconstrained. Any authed user could directly set their row to
  `status='confirmed'` for any vibe, bypassing invite/matching/capacity and unlocking
  exact GPS (`vibe_private_logistics`) + vibe chat (`is_vibe_member`). Audit query
  confirmed **no exploitation** (only confirmed/null-invitation rows were legit
  `redeem_host_code` joins, `source='private'`). Code/link invites unaffected (SECURITY
  DEFINER RPCs bypass RLS).
- **Verified clean:** build (`tsc` + `next build` pass), Google OAuth/session/callback,
  middleware PUBLIC_PATHS, #103 `handle_new_user` revoke does NOT break signup, the
  "flock chat = 1 person" + trip-request-enumeration fixes held.
- **Verified LIVE on prod** (via `pg_get_functiondef`): `autofill_open_vibes` /
  `auto_rank_due_vibes` / `invite_city_fallback` carry the #77 time guards;
  `vibe_match` carries the #98 `::int` guard. (Resolves the earlier "vibe-auto-matching
  not run?" uncertainty — the guarded versions are deployed.)

### Audit follow-ups still open (no prod impact)
- **Matching re-run downgrade hazards (repo-only):** non-canonical *active* copies still
  exist that would downgrade the engine if those files are re-run — `autofill_open_vibes`
  (`host-controls.sql` body + its `cron.schedule`, `vibe-v2-preview-reject.sql`),
  `vibe_match` (`vibe-not-for-me.sql`, `vibe-review-preferences.sql`), `buddy_candidates_trip`
  (`buddy-candidates-v2.sql`), `recommended_vibes` (`vibe-location-privacy-prepare.sql`).
  Fix = comment-wrap them (same pattern as #94–#98). Prod is correct; this only matters
  on re-run.
- **Onboarding soft-gated:** hard redirect runs only at login callback; a user who abandons
  onboarding can navigate directly to `/home`. If hard enforcement is wanted, gate in
  `(app)/layout.tsx`. (Product decision.)
- **Terms not persisted:** no `accept_terms` RPC; login writes a dead `flockie-pending-terms`
  localStorage flag that's never read. Consent is clickwrap-only. (Product decision.)
- **Repo can't rebuild DB from scratch:** `schema.sql` only creates `profiles`; base tables
  + several core functions live in an uncommitted migration. Prod works; repo isn't a DB
  source of truth.
- **Minor:** no ESLint config (`next lint` can't run in CI); unauth API hits 307→/login
  instead of 401; Supabase env vars use `!` assertions.
