# Behavior signal diagnostics

This is an admin-only analysis layer for the private Vibe behavior data. It
does not change matching, ranking, recommendations, or displayed percentages.

## What it answers

1. Do enough users have passive and explicit signals to evaluate a new weight?
2. Are users opening and spending time on the Vibes they later choose?
3. Does an individual pair's current score rely on onboarding, explicit
   behavior, or both?

## Privacy boundary

The diagnostic views and functions have no app-facing grants. They are for the
Supabase SQL editor only. The app cannot call or display them.

## Deployment

Run this only after the following SQL files are live:

1. `supabase/vibe-traits.sql`
2. `supabase/vibe-behavior-shadow.sql`
3. `supabase/vibe-behavior-diagnostics.sql`

## Recommended review cadence

Do not alter matching weights immediately. Review the data after at least four
weeks and only if all of these are true:

- At least 30 users have passive signals.
- At least 100 Vibe detail opens have been recorded.
- At least 20 explicit positive or negative actions have been recorded.
- The data includes more than one active city or community.
- Passive signals support the same broad preferences as explicit choices.

If these conditions are not met, keep the current onboarding and explicit
behavior logic unchanged.

## Queries

Overall signal coverage for the last 30 days:

```sql
select * from public.vibe_behavior_shadow_status(30);
```

Per-user coverage, ordered by the most recent passive signal:

```sql
select *
from public.vibe_behavior_user_summary
order by last_passive_signal_at desc nulls last;
```

Whether longer Vibe views are followed by a positive or negative explicit
choice:

```sql
select
  detail_dwell_30s > 0 as had_long_view,
  count(*) as user_vibes,
  count(*) filter (where self_interested or confirmed) as positive_actions,
  count(*) filter (where not_for_me) as negative_actions
from public.vibe_behavior_outcome_summary
group by had_long_view
order by had_long_view;
```

One pair's current score and available evidence:

```sql
select *
from public.buddy_pair_shadow_diagnostic(
  'first-user-uuid',
  'second-user-uuid',
  90
);
```

## Decision rule for a future weighting PR

Passive data may only influence a person's matching score after a separate
review confirms all of the following:

- A passive signal predicts later explicit interest or a positive review.
- The change improves results for new and established users, not only frequent
  app users.
- Users with low activity are not pushed into lower displayed match scores.
- The proposed weight is capped and can be rolled back in one canonical SQL
  file.
