# SQL source-of-truth map

Which SQL is **live**, which is **tombstoned** (superseded, comment-wrapped), and which files
are **dangerous to re-run**. Generated from a repo audit on 2026-07-02.

**Rules:**
- Never un-wrap a `/* SUPERSEDED */` block. If you need its behavior, port it into the canonical file.
- When two files define the same function, the **canonical** file below wins - edit only there.
- After editing any canonical function, it must also be **run on prod** (SQL editor) - merged ≠ deployed.

## Canonical (live) definitions

| Function / object | Canonical file |
|---|---|
| `buddy_pair_score`, matching helpers, self-interest source migration (calibrated onboarding fit plus explicit behavior confidence; no legacy quiz/trip fields) | `vibe-traits.sql` |
| `buddy_hard_block` | `match-priorities.sql` |
| `buddy_candidates_trip` (priority-weighted + hard block) | `match-priorities.sql` |
| `buddy_dest_count` | `buddy-candidates-v2.sql` |
| `buddy_swipe` (3-arg, notify-once) | `buddy-swipe-notify-once.sql` |
| `activity_candidates` (with hard block + decisions) | `activity-candidate-decisions.sql` |
| `activity_candidate_decide` | `activity-candidate-decisions.sql` |
| `activity_feed`, activity join-request RPCs | `activity-join-requests.sql` |
| `city_people` (shared-taste reasons), `home_flocks` | `home-carousels.sql` |
| `_rank_vibe_core`, `backfill_vibe` | `vibe-v2-private-link.sql` |
| `rank_vibe` (thin auth wrapper) | `vibe-auto-matching.sql` |
| `invite_city_fallback` (#77 `starts_at > now()` guard) | `vibe-auto-matching.sql` |
| `autofill_open_vibes`, `auto_rank_due_vibes` + crons | `vibe-auto-matching.sql` |
| `vibe_match` (regex-guarded `::int` cast, #98) | `recommended-vibes.sql` |
| `recommended_vibes` | `recommended-vibes.sql` |
| `vibe_display_match`, `vibe_display_match_scores` (card-only calibrated display score) | `vibe-display-match.sql` |
| `vibe_review_fit` | `vibe-review-preferences.sql` |
| `vibe_negative_fit`, `mark_/undo_vibe_not_for_me` | `vibe-not-for-me.sql` |
| Passive Vibe behavior shadow events, retention, write RPC | `vibe-behavior-shadow.sql` |
| Admin-only passive-signal coverage and pair diagnostics | `vibe-behavior-diagnostics.sql` |
| Explicit preference-signal ledger, ordinary Vibe attendance, and admin-only summaries | `explicit-preference-signals.sql` |
| `express_interest` (records self-expressed interest separately from algorithm-created rows) | `vibe-express-interest-autoconfirm.sql` |
| `confirm_vibe` | `ranking.sql` |
| `expire_invitations`, `decline_vibe` | `expiry.sql` |
| `vibe_directory`, `vibe_private_logistics`, `public_vibe` | `vibe-location-privacy-prepare.sql` |
| `public_profiles` (including public Vibe persona), `public_profile_events/stats` | `profile-privacy-prepare.sql` |
| `vibe_takes`, `save_vibe_take` | `vibe-takes.sql` |
| Club tables, Vibe-link ownership guard, membership/attendance RPCs, `club_directory`, `public_profile_clubs` | `clubs-foundation.sql` |
| `club_detail` (safe Club detail; no roster or exact location) | `club-detail-access.sql` |
| Founding member invite links and acceptance RPCs | `club-founder-invites.sql` |
| `set_club_status` (activate, pause, close) | `club-heartbeat.sql` |
| `decline_club_membership` | `club-membership-decisions.sql` |
| `trip_join_requests` SELECT policy (`can_see_trip_requests`) | `trip-requests-rls-enforce.sql` |
| host RPCs (`notify`, `cancel_vibe`, `update_vibe_when`, commit/remove/appeal) | `host-controls.sql` |
| Vibes-only onboarding profile fields | `onboarding-v3-vibes-only.sql` |

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
| `vibe-review-preferences.sql:44` | review-fit `vibe_match` | raw `::int` cast. ✅ 2026-07-02: the 0.15 review-fit weighting was PORTED into the live `recommended-vibes.sql` (using the #98 regex-guarded cast, weights rescaled to 0.35/0.25/0.12/0.13/0.15). → `recommended-vibes.sql` |
| `vibe-review-preferences.sql:106` | review-fit `_rank_vibe_core` | auto-invited → `vibe-v2-private-link.sql` |
| `vibe-review-preferences.sql:170` | review-fit `invite_city_fallback` | contained the age filter the live version had lost. ✅ 2026-07-02: age (and gender) now enforced live via `vibe_eligible()` inside `invite_city_fallback` → `vibe-auto-matching.sql` |
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

- **`_all-pending.sql`** - historical pre-hardening snapshot. Re-running would revert the
  RLS lockdowns (e.g. `trip_join_requests using (true)`). Loud header at line 1. Keep as history only.
- **`match-weights.sql`** - intentionally emptied to a no-op.

## Re-run hazards - DEFUSED 2026-07-02

- ✅ **`buddy-matching.sql:27-100`** - legacy `buddy_city_count` / `buddy_candidates` / 2-arg
  `buddy_swipe` are now wrapped in a `/* SUPERSEDED */` block. Drops for all three are in
  `legacy-buddy-cleanup.sql` and `deploy-2026-07-02.sql` (verified: all live `buddy_swipe`
  callers pass 3 args; only `buddy_candidates_trip` is used). → `match-priorities.sql` /
  `buddy-swipe-notify-once.sql`
- ✅ **`trips-and-buddy.sql:53`** - the `using (true)` "trips readable" policy is tombstoned
  and the file header is now a loud DO-NOT-RE-RUN warning. Live scoped policy (via
  `can_see_trip`) is in `trips-rls.sql` - no prod SQL needed, it's already correct.

## Deploy bundles

- **`deploy-2026-07-02.sql`** - point-in-time prod script for the tombstone-followup batch:
  updated `vibe_match` (review-fit), `invite_city_fallback` (eligibility+guard), and the
  legacy buddy drops. Idempotent. Snapshots of the canonical bodies - if you edit the
  canonical files later, this bundle is stale (re-generate or just run the canonical files).

## Schema drift - CAPTURED 2026-07-02

✅ The previously prod-only objects are now transcribed from prod into
**`prod-only-functions.sql`** (dumped via `pg_get_functiondef` / `information_schema`
/ `pg_constraint` / `pg_policies`). Security-reviewed - all correctly scoped:
- `set_my_location` - writes `profiles.location` for `auth.uid()` only
- `get_or_create_chat` - gates on `is_vibe_member`
- `accept_terms` - stamps `auth.uid()` only (coalesce, won't overwrite)
- `vibe_chat_summaries` - filters `where is_vibe_member(c.vibe_id)`
- `chat_reads` table - RLS on, policy `user_id = auth.uid()`

They already exist on prod (no re-run needed); the file exists for review + fresh-DB
reproducibility. One reconstruction: `vibe_chat_summaries`'s RETURNS TABLE tail
(`last_at`/`unread`) was inferred from the body (the prod dump was truncated in the viewer).
- `chat_reads` table (no CREATE/RLS in repo; written by `mark_chat_read`)
