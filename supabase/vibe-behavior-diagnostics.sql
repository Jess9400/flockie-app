-- Admin-only diagnostics for Vibe behavior shadow mode.
-- Run only after vibe-behavior-shadow.sql and vibe-traits.sql are live.
-- These objects read signals for analysis. They never change matching or ranking.

create or replace view public.vibe_behavior_user_summary as
with passive as (
  select
    user_id,
    count(distinct vibe_id)::int as passive_vibe_count,
    coalesce(sum(occurrences) filter (where event_type = 'card_impression'), 0)::bigint as card_impressions,
    coalesce(sum(occurrences) filter (where event_type = 'detail_open'), 0)::bigint as detail_opens,
    coalesce(sum(occurrences) filter (where event_type = 'detail_dwell_10s'), 0)::bigint as detail_dwell_10s,
    coalesce(sum(occurrences) filter (where event_type = 'detail_dwell_30s'), 0)::bigint as detail_dwell_30s,
    max(last_seen_at) as last_passive_signal_at
  from public.vibe_behavior_events
  group by user_id
),
explicit_events as (
  select
    user_id,
    count(*) filter (where signal = 'self_interest')::int as self_interest_count,
    count(*) filter (where signal = 'confirmed')::int as confirmed_count,
    count(*) filter (where signal = 'not_for_me')::int as not_for_me_count,
    count(*) filter (where signal = 'positive_review')::int as positive_review_count,
    count(*) filter (where signal = 'negative_review')::int as negative_review_count,
    count(*)::int as explicit_signal_count
  from (
    select vi.user_id, 'self_interest'::text as signal
    from public.vibe_interests vi
    where vi.source = 'self'
      and vi.status in ('interested', 'shortlisted', 'standby', 'invited')

    union all

    select vi.user_id, 'confirmed'::text
    from public.vibe_interests vi
    where vi.status = 'confirmed'

    union all

    select vf.user_id, 'not_for_me'::text
    from public.vibe_feedback vf
    where vf.signal = 'not_for_me'

    union all

    select vr.reviewer_id, 'positive_review'::text
    from public.vibe_reviews vr
    where vr.rating >= 4

    union all

    select vr.reviewer_id, 'negative_review'::text
    from public.vibe_reviews vr
    where vr.rating <= 2
  ) signals
  group by user_id
)
select
  coalesce(p.user_id, e.user_id) as user_id,
  coalesce(p.passive_vibe_count, 0) as passive_vibe_count,
  coalesce(p.card_impressions, 0) as card_impressions,
  coalesce(p.detail_opens, 0) as detail_opens,
  coalesce(p.detail_dwell_10s, 0) as detail_dwell_10s,
  coalesce(p.detail_dwell_30s, 0) as detail_dwell_30s,
  p.last_passive_signal_at,
  coalesce(e.self_interest_count, 0) as self_interest_count,
  coalesce(e.confirmed_count, 0) as confirmed_count,
  coalesce(e.not_for_me_count, 0) as not_for_me_count,
  coalesce(e.positive_review_count, 0) as positive_review_count,
  coalesce(e.negative_review_count, 0) as negative_review_count,
  coalesce(e.explicit_signal_count, 0) as explicit_signal_count
from passive p
full join explicit_events e on e.user_id = p.user_id;

revoke all on table public.vibe_behavior_user_summary from public, anon, authenticated;

create or replace view public.vibe_behavior_outcome_summary as
with passive as (
  select
    user_id,
    vibe_id,
    coalesce(sum(occurrences) filter (where event_type = 'card_impression'), 0)::bigint as card_impressions,
    coalesce(sum(occurrences) filter (where event_type = 'detail_open'), 0)::bigint as detail_opens,
    coalesce(sum(occurrences) filter (where event_type = 'detail_dwell_10s'), 0)::bigint as detail_dwell_10s,
    coalesce(sum(occurrences) filter (where event_type = 'detail_dwell_30s'), 0)::bigint as detail_dwell_30s,
    max(last_seen_at) as last_passive_signal_at
  from public.vibe_behavior_events
  group by user_id, vibe_id
),
explicit as (
  select
    user_id,
    vibe_id,
    bool_or(signal = 'self_interest') as self_interested,
    bool_or(signal = 'confirmed') as confirmed,
    bool_or(signal = 'not_for_me') as not_for_me,
    bool_or(signal = 'positive_review') as positive_review,
    bool_or(signal = 'negative_review') as negative_review
  from (
    select vi.user_id, vi.vibe_id, 'self_interest'::text as signal
    from public.vibe_interests vi
    where vi.source = 'self'
      and vi.status in ('interested', 'shortlisted', 'standby', 'invited')

    union all

    select vi.user_id, vi.vibe_id, 'confirmed'::text
    from public.vibe_interests vi
    where vi.status = 'confirmed'

    union all

    select vf.user_id, vf.vibe_id, 'not_for_me'::text
    from public.vibe_feedback vf
    where vf.signal = 'not_for_me'

    union all

    select vr.reviewer_id, vr.vibe_id, 'positive_review'::text
    from public.vibe_reviews vr
    where vr.rating >= 4

    union all

    select vr.reviewer_id, vr.vibe_id, 'negative_review'::text
    from public.vibe_reviews vr
    where vr.rating <= 2
  ) signals
  group by user_id, vibe_id
)
select
  coalesce(p.user_id, e.user_id) as user_id,
  coalesce(p.vibe_id, e.vibe_id) as vibe_id,
  coalesce(p.card_impressions, 0) as card_impressions,
  coalesce(p.detail_opens, 0) as detail_opens,
  coalesce(p.detail_dwell_10s, 0) as detail_dwell_10s,
  coalesce(p.detail_dwell_30s, 0) as detail_dwell_30s,
  p.last_passive_signal_at,
  coalesce(e.self_interested, false) as self_interested,
  coalesce(e.confirmed, false) as confirmed,
  coalesce(e.not_for_me, false) as not_for_me,
  coalesce(e.positive_review, false) as positive_review,
  coalesce(e.negative_review, false) as negative_review
from passive p
full join explicit e on e.user_id = p.user_id and e.vibe_id = p.vibe_id;

revoke all on table public.vibe_behavior_outcome_summary from public, anon, authenticated;

create or replace function public.vibe_behavior_shadow_status(p_days int default 30)
returns table (
  window_days int,
  users_with_passive_signals bigint,
  passive_event_rows bigint,
  passive_occurrences bigint,
  users_with_detail_opens bigint,
  users_with_long_views bigint,
  users_with_explicit_signals bigint,
  explicit_signal_count bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with windowed_passive as (
    select *
    from public.vibe_behavior_events
    where event_date >= current_date - least(greatest(coalesce(p_days, 30), 1), 365)
  ),
  windowed_explicit as (
    select vi.user_id
    from public.vibe_interests vi
    where vi.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
      and (
        vi.status = 'confirmed'
        or (vi.source = 'self' and vi.status in ('interested', 'shortlisted', 'standby', 'invited'))
      )

    union all

    select vf.user_id
    from public.vibe_feedback vf
    where vf.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
      and vf.signal = 'not_for_me'

    union all

    select vr.reviewer_id
    from public.vibe_reviews vr
    where vr.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
      and (vr.rating >= 4 or vr.rating <= 2)
  )
  select
    least(greatest(coalesce(p_days, 30), 1), 365) as window_days,
    (select count(distinct user_id) from windowed_passive) as users_with_passive_signals,
    (select count(*) from windowed_passive) as passive_event_rows,
    (select coalesce(sum(occurrences), 0) from windowed_passive) as passive_occurrences,
    (select count(distinct user_id) from windowed_passive where event_type = 'detail_open') as users_with_detail_opens,
    (select count(distinct user_id) from windowed_passive where event_type = 'detail_dwell_30s') as users_with_long_views,
    (select count(distinct user_id) from windowed_explicit) as users_with_explicit_signals,
    (select count(*) from windowed_explicit) as explicit_signal_count;
$$;

revoke all on function public.vibe_behavior_shadow_status(int)
  from public, anon, authenticated;

create or replace function public.buddy_pair_shadow_diagnostic(
  p_a uuid,
  p_b uuid,
  p_days int default 90
)
returns table (
  current_match_score numeric,
  explicit_behavior_fit numeric,
  explicit_behavior_evidence int,
  passive_vibes_a int,
  passive_vibes_b int,
  card_impressions_a bigint,
  card_impressions_b bigint,
  detail_opens_a bigint,
  detail_opens_b bigint,
  long_views_a bigint,
  long_views_b bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with passive as (
    select
      user_id,
      count(distinct vibe_id)::int as passive_vibes,
      coalesce(sum(occurrences) filter (where event_type = 'card_impression'), 0)::bigint as card_impressions,
      coalesce(sum(occurrences) filter (where event_type = 'detail_open'), 0)::bigint as detail_opens,
      coalesce(sum(occurrences) filter (where event_type = 'detail_dwell_30s'), 0)::bigint as long_views
    from public.vibe_behavior_events
    where user_id in (p_a, p_b)
      and event_date >= current_date - least(greatest(coalesce(p_days, 90), 1), 365)
    group by user_id
  )
  select
    public.buddy_pair_score(p_a, p_b) as current_match_score,
    behavior.fit as explicit_behavior_fit,
    behavior.evidence as explicit_behavior_evidence,
    coalesce(a.passive_vibes, 0) as passive_vibes_a,
    coalesce(b.passive_vibes, 0) as passive_vibes_b,
    coalesce(a.card_impressions, 0) as card_impressions_a,
    coalesce(b.card_impressions, 0) as card_impressions_b,
    coalesce(a.detail_opens, 0) as detail_opens_a,
    coalesce(b.detail_opens, 0) as detail_opens_b,
    coalesce(a.long_views, 0) as long_views_a,
    coalesce(b.long_views, 0) as long_views_b
  from public._buddy_behavior_fit(p_a, p_b) behavior
  left join passive a on a.user_id = p_a
  left join passive b on b.user_id = p_b;
$$;

revoke all on function public.buddy_pair_shadow_diagnostic(uuid, uuid, int)
  from public, anon, authenticated;
