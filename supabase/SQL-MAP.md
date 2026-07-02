# SQL source-of-truth map

Which SQL is **live**, which is **tombstoned** (superseded, comment-wrapped), and which files
are **dangerous to re-run**. Generated from a repo audit on 2026-07-02.

**Rules:**
- Never un-wrap a `/* SUPERSEDED */` block. If you need its behavior, port it into the canonical file.
- When two files define the same function, the **canonical** file below wins — edit only there.
- After editing any canonical function, it must also be **run on prod** (SQL editor) — merged ≠ deployed.

## Canonical (live) definitions

| Function / object | Canonical file |
|---|---|
| `buddy_pair_score` | `vibe-traits.sql` |
| `buddy_hard_block` | `match-priorities.sql` |
| `buddy_candidates_trip` (priority-weighted + hard block) | `match-priorities.sql` |
| `buddy_dest_count` | `buddy-candidates-v2.sql` |
| `buddy_swipe` (3-arg, notify-once) | `buddy-swipe-notify-once.sql` |
| `activity_candidates` (with hard block + decisions) | `activity-candidate-decisions.sql` |
| `activity_candidate_decide` | `activity-candidate-decisions.sql` |
| `city_people`, `home_flocks` | `home-carousels.sql` |
| `_rank_vibe_core`, `backfill_vibe` | `vibe-v2-private-link.sql` |
| `rank_vibe` (thin auth wrapper) | `vibe-auto-matching.sql` |
| `invite_city_fallback` (#77 `starts_at > now()` guard) | `vibe-auto-matching.sql` |
| `autofill_open_vibes`, `auto_rank_due_vibes` + crons | `vibe-auto-matching.sql` |
| `vibe_match` (regex-guarded `::int` cast, #98) | `recommended-vibes.sql` |
| `recommended_vibes` | `recommended-vibes.sql` |
| `vibe_review_fit` | `vibe-review-preferences.sql` |
| `vibe_negative_fit`, `mark_/undo_vibe_not_for_me` | `vibe-not-for-me.sql` |
| `confirm_vibe` | `ranking.sql` |
| `expire_invitations`, `decline_vibe` | `expiry.sql` |
| `vibe_directory`, `vibe_private_logistics`, `public_vibe` | `vibe-location-privacy-prepare.sql` |
| `public_profiles`, `public_profile_events/stats` | `profile-privacy-prepare.sql` |
| `trip_join_requests` SELECT policy (`can_see_trip_requests`) | `trip-requests-rls-enforce.sql` |
| host RPCs (`notify`, `cancel_vibe`, `update_vibe_when`, commit/remove/appeal) | `host-controls.sql` |

## Tombstoned blocks (`/* SUPERSEDED */`, do not un-wrap)

| File : line | Wrapped-out content | Why superseded → canonical |
|---|---|---|
| `host-controls.sql:54` | old `backfill_vibe` + `rank_vibe` | pre-algo-share → `vibe-v2-private-link.sql` / wrapper in `vibe-auto-matching.sql` |
| `host-controls.sql:392` | old `autofill_open_vibes` | no `starts_at > now()` guard, re-pointed cron at itself → `vibe-auto-matching.sql` |
| `expiry.sql:3` | old `backfill_vibe` | no `_vibe_algo_remaining` → `vibe-v2-private-link.sql` |
| `vibe-auto-matching.sql:30` | old `backfill_vibe` | same → `vibe-v2-private-link.sql` |
| `vibe-auto-matching.sql:112` | old `_rank_vibe_core` | auto-invited (no host review) → `vibe-v2-private-link.sql` |
| `vibe-v2-private-link.sql:110` | old `invite_city_fallback` | lacked #77 guard (but note: it HAD the age filter the live one lost) → `vibe-auto-matching.sql` |
| `vibe-v2-preview-reject.sql:13` | old `_rank_vibe_core` | lacked `source<>'private'` filter → `vibe-v2-private-link.sql` |
| `vibe-v2-preview-reject.sql:158` | old `autofill_open_vibes` | no `starts_at` guard → `vibe-auto-matching.sql` |
| `vibe-v2-algo-share.sql:21` | algo-budget `_rank_vibe_core` + `backfill_vibe` | not live → `vibe-v2-private-link.sql` |
| `vibe-v2-algo-share.sql:108` | algo-budget `invite_city_fallback` | not live → `vibe-auto-matching.sql` |
| `vibe-review-preferences.sql:44` | review-fit `vibe_match` | raw `::int` cast; **contains the 0.15 review-fit weighting we may want to port** → `recommended-vibes.sql` |
| `vibe-review-preferences.sql:106` | review-fit `_rank_vibe_core` | auto-invited → `vibe-v2-private-link.sql` |
| `vibe-review-preferences.sql:170` | review-fit `invite_city_fallback` | **contains the age filter missing from the live version** → `vibe-auto-matching.sql` |
| `vibe-not-for-me.sql:106` | stale `vibe_match` | raw cast + different formula → `recommended-vibes.sql` |
| `ranking.sql:3` | old direct `rank_vibe` | pre-wrapper → `vibe-auto-matching.sql` |
| `match-weights.sql:1` | **entire file is a no-op** | its `buddy_pair_score`/`rank_vibe` would downgrade the engine |
| `match-priorities.sql:49` | old `buddy_pair_score` | missing social_style/motivation/initiator → `vibe-traits.sql` |
| `match-priorities.sql:245` | old `activity_candidates` | missing decision/swipe exclusions → `activity-candidate-decisions.sql` |
| `buddy-candidates-v2.sql:29` | old `buddy_candidates_trip` | flat weights, NO hard block (drops included in wrap) → `match-priorities.sql` |
| `buddy-match-context.sql:11` | old trip-only `buddy_pair_score` (0.6/0.4) | → `vibe-traits.sql` |
| `activity-discovery.sql:35` | old `activity_candidates` | no hard block → `activity-candidate-decisions.sql` |
| `activity-discovery.sql:91` | old `buddy_swipe` | pre notify-once (#89) → `buddy-swipe-notify-once.sql` |
| `activity-discovery.sql:145` | duplicate `activity_candidate_decide` | identical copy → `activity-candidate-decisions.sql` |
| `activity-candidate-decisions.sql:203` | duplicate `city_people` | whitespace-only dup → `home-carousels.sql` |
| `vibe-location-privacy-prepare.sql:109` | duplicate `recommended_vibes` | identical (drop included in wrap) → `recommended-vibes.sql` |
| `flock-requests.sql:65` | `using (true)` join-requests SELECT policy | the June P0; removed, live policy in `trip-requests-rls-enforce.sql` |

## Do-not-run files

- **`_all-pending.sql`** — historical pre-hardening snapshot. Re-running would revert the
  RLS lockdowns (e.g. `trip_join_requests using (true)`). Loud header at line 1. Keep as history only.
- **`match-weights.sql`** — intentionally emptied to a no-op.

## ⚠️ Known re-run hazards NOT yet defused (2026-07-02 audit)

- **`buddy-matching.sql:28-63`** — legacy `buddy_city_count` / `buddy_candidates` / 2-arg
  `buddy_swipe` are **unwrapped**: old flat 0.6/0.4 deck, no hard block, NULL-score bug,
  still `grant execute to authenticated`. Unused by the client but callable, and re-running
  the file re-creates them. TODO: wrap + drop from prod.
- **`trips-and-buddy.sql:53-54`** — re-creates the `using (true)` "trips readable" policy,
  reverting `trips-rls.sql`, and the file header says "Safe to re-run". TODO: defuse like
  `flock-requests.sql`.

## ⚠️ Prod-only objects with NO repo definition (schema drift)

Dump via `select pg_get_functiondef('public.<fn>'::regproc);` and commit:

- `set_my_location` (writes GPS to `profiles.location` — called from `src/lib/location.ts`)
- `get_or_create_chat` (vibe chat membership gate — `vibes/[id]/chat/page.tsx`)
- `accept_terms` (legal consent stamping — `auth/callback/route.ts`)
- `vibe_chat_summaries` (`chats/page.tsx`)
- `chat_reads` table (no CREATE/RLS in repo; written by `mark_chat_read`)
