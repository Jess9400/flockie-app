-- Home page carousels: "People in your city" + "Flocks you can join".
-- Run in the Supabase SQL editor. Safe to re-run.

-- People in the viewer's home city who are open to discovery. Mirrors
-- activity_candidates but keys off the viewer's own home_city instead of a
-- posted activity's destination, so it works with no posted activity.
--
-- Ranking: `score` stays a pure match % (the home UI renders it directly).
-- The ORDER BY additionally applies:
--   * a recency boost from auth.users.last_sign_in_at (~10-day decay, max +12
--     on the 0-100 scale) so dormant accounts stop outranking active ones
--     without recency dominating compatibility;
--   * a small deterministic jitter (+/- ~2.5), stable per viewer per ISO week,
--     so everyone in a city doesn't see the identical order and it rotates.
-- Hygiene: bilateral hard dealbreakers (buddy_hard_block) and people who
-- already swiped no on the viewer are excluded entirely.
-- Thinness valve: when the fresh pool (never swiped/decided) has fewer than 6
-- people, top the carousel back up to 6 with people the viewer previously
-- PASSED on in activity decisions (liked = false), ordered after the fresh
-- pool - never with hard-blocked people or anyone the viewer buddy-swiped.
drop function if exists public.city_people(int);
create function public.city_people(p_limit int default 12)
returns table (
  id uuid, display_name text, age int, photos text[], one_liner text,
  home_city text, score float8, shared_interests text[], shared_styles text[]
)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid()),
  -- materialized so buddy_pair_score runs once per candidate even though the
  -- score feeds both the returned column and the rank expression below
  base as materialized (
    select cp.id, cp.display_name, cp.age, cp.photos, cp.one_liner, cp.home_city,
           public.buddy_pair_score(auth.uid(), cp.id)::float8 as score,
           array(
             select interest
             from unnest(cp.vibe_interests) interest
             where interest = any(me.vibe_interests)
             order by array_position(me.vibe_interests, interest)
           ) as shared_interests,
           array(
             select style
             from unnest(cp.activity_vibe) style
             where style = any(me.activity_vibe)
             order by array_position(me.activity_vibe, style)
           ) as shared_styles,
           u.last_sign_in_at
    from public.profiles cp
    cross join me
    left join auth.users u on u.id = cp.id
    where cp.id <> auth.uid()
      and cp.open_to_discovery
      and cp.onboarding_complete
      and trim(coalesce(me.home_city, '')) <> ''
      -- trim() so a stray space ("dubai " vs "dubai") can't silently break the
      -- city match; case is already handled by lower().
      and lower(trim(coalesce(cp.home_city, ''))) = lower(trim(coalesce(me.home_city, '')))
      and not public.buddy_hard_block(auth.uid(), cp.id)
      and not exists (  -- they already swiped no on the viewer
        select 1 from public.buddy_swipes s
        where s.swiper_id = cp.id and s.target_id = auth.uid() and not s.liked
      )
      and not exists (  -- the viewer already buddy-swiped them
        select 1 from public.buddy_swipes s
        where s.swiper_id = auth.uid() and s.target_id = cp.id
      )
  ),
  pool as (
    select b.id, b.display_name, b.age, b.photos, b.one_liner, b.home_city, b.score,
           b.shared_interests, b.shared_styles,
           ( coalesce(b.score, 0)
             + case when b.last_sign_in_at is null then 0
                    else 12.0 * exp(-greatest(extract(epoch from (now() - b.last_sign_in_at)), 0)::float8 / 864000.0)
               end
             + (hashtext(auth.uid()::text || b.id::text || to_char(now(), 'IYYY-IW')) % 250)::float8 / 100.0
           ) as rank_score
    from base b
    -- Do not recommend a person whose calibrated fit is below the product's
    -- minimum. A thin city gets an honest empty state instead of a weak match.
    where b.score >= 60
  ),
  fresh as (
    select p.* from pool p
    where not exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid() and d.candidate_id = p.id
    )
  ),
  backfill as (
    select p.* from pool p
    where exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid() and d.candidate_id = p.id and not d.liked
    )
    order by p.rank_score desc nulls last, p.id
    limit greatest(6 - (select count(*) from fresh), 0)
  )
  select c.id, c.display_name, c.age, c.photos, c.one_liner, c.home_city, c.score,
         c.shared_interests, c.shared_styles
  from (
    select f.*, 0 as pri from fresh f
    union all
    select b.*, 1 as pri from backfill b
  ) c
  order by c.pri, c.rank_score desc nulls last, c.id
  limit p_limit;
$$;
grant execute on function public.city_people(int) to authenticated;

-- Open, not-full public group trips (Flocks) you can request to join, with the
-- host, current going-count, and whether you've already requested.
create or replace function public.home_flocks(p_limit int default 10)
returns table (
  id uuid, destination text, destinations text[], start_date date, end_date date,
  group_size int, cover_photo text, going int, requested boolean,
  host_name text, host_photo text
)
language sql security definer set search_path = public stable as $$
  select t.id, t.destination, t.destinations, t.start_date, t.end_date,
         t.group_size, t.cover_photo,
         (1 + coalesce(a.accepted, 0))::int as going,
         exists(
           select 1 from public.trip_join_requests r
           where r.trip_id = t.id and r.user_id = auth.uid()
             and r.status in ('pending', 'accepted') -- declined = not requested anymore
         ) as requested,
         hp.display_name as host_name,
         (hp.photos)[1] as host_photo
  from public.trips t
  join public.profiles hp on hp.id = t.user_id
  left join lateral (
    select count(*)::int as accepted
    from public.trip_join_requests r
    where r.trip_id = t.id and r.status = 'accepted'
  ) a on true
  where t.visibility = 'public'
    and t.kind = 'trip'
    and t.status = 'active'
    and t.user_id <> auth.uid()
    and t.end_date >= current_date
    and (1 + coalesce(a.accepted, 0)) < t.group_size
  order by t.created_at desc
  limit p_limit;
$$;
grant execute on function public.home_flocks(int) to authenticated;
