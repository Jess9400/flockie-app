-- Activity-specific candidate decisions.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- A pass belongs to one activity, so the same person may still be relevant for
-- a different activity later. A like still uses buddy_swipe so mutual likes
-- continue to create the existing buddy match and chat.

create table if not exists public.activity_candidate_decisions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.trips(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id, candidate_id),
  check (user_id <> candidate_id)
);

create index if not exists activity_candidate_decisions_user_candidate_idx
  on public.activity_candidate_decisions (user_id, candidate_id);

alter table public.activity_candidate_decisions enable row level security;
drop policy if exists "manage own activity candidate decisions"
  on public.activity_candidate_decisions;
create policy "manage own activity candidate decisions"
  on public.activity_candidate_decisions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.trips t
      where t.id = activity_id
        and t.user_id = auth.uid()
        and t.kind = 'activity'
    )
  );

drop function if exists public.activity_candidate_decide(uuid, uuid, boolean);
create or replace function public.activity_candidate_decide(
  p_activity uuid,
  p_target uuid,
  p_liked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_result jsonb;
begin
  if p_target = auth.uid() then
    raise exception 'You cannot choose yourself.';
  end if;

  select t.title
  into v_title
  from public.trips t
  where t.id = p_activity
    and t.user_id = auth.uid()
    and t.kind = 'activity'
    and t.status = 'active';

  if not found then
    raise exception 'Activity not found or no longer active.';
  end if;

  insert into public.activity_candidate_decisions (
    user_id,
    activity_id,
    candidate_id,
    liked,
    updated_at
  )
  values (auth.uid(), p_activity, p_target, p_liked, now())
  on conflict (user_id, activity_id, candidate_id)
  do update set
    liked = excluded.liked,
    updated_at = now();

  if p_liked then
    select public.buddy_swipe(
      p_target,
      true,
      coalesce(nullif(trim(v_title), ''), 'an activity')
    )
    into v_result;
    return v_result;
  end if;

  return jsonb_build_object('matched', false);
end;
$$;
grant execute on function public.activity_candidate_decide(uuid, uuid, boolean)
  to authenticated;

drop function if exists public.activity_candidates(uuid, int);
create or replace function public.activity_candidates(
  p_trip uuid,
  p_limit int default 30
)
returns table (
  id uuid,
  display_name text,
  age int,
  photos text[],
  video_url text,
  one_liner text,
  title text,
  destinations text[],
  start_date date,
  end_date date,
  trip_type text[],
  score float8
)
language sql
security definer
set search_path = public
stable
as $$
  with me_t as (
    select *
    from public.trips
    where id = p_trip
      and user_id = auth.uid()
      and kind = 'activity'
      and status = 'active'
  ),
  me_p as (
    select *
    from public.profiles
    where id = auth.uid()
  )
  select
    cp.id,
    cp.display_name,
    cp.age,
    cp.photos,
    cp.video_url,
    cp.one_liner,
    null::text as title,
    array[cp.home_city]::text[] as destinations,
    null::date as start_date,
    null::date as end_date,
    null::text[] as trip_type,
    (
      100 * (
        0.5 * (public.buddy_pair_score(auth.uid(), cp.id) / 100.0)
        + 0.5 * (
          case
            when coalesce(array_length(cp.activity_vibe, 1), 0) = 0
              or coalesce(array_length(me_p.activity_vibe, 1), 0) = 0
            then 0.5
            else cardinality(array(
              select unnest(cp.activity_vibe)
              intersect
              select unnest(me_p.activity_vibe)
            ))::numeric
            / nullif(cardinality(array(
              select unnest(cp.activity_vibe)
              union
              select unnest(me_p.activity_vibe)
            )), 0)
          end
        )
      )
    )::float8 as score
  from public.profiles cp
  cross join me_t
  cross join me_p
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    -- Discovery pool = people in YOUR city who are open to discovery, ranked by
    -- vibe similarity. We match on the swiper's own home_city (me_p) — NOT the
    -- activity's destination — and we do NOT require the candidate to have posted
    -- their own activity. You swipe in-city people and invite them to your activity.
    and coalesce(me_p.home_city, '') <> ''
    and lower(coalesce(cp.home_city, '')) = lower(me_p.home_city)
    and not public.buddy_hard_block(auth.uid(), cp.id)
    and not exists (
      select 1
      from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.activity_id = p_trip
        and d.candidate_id = cp.id
    )
    and not exists (
      select 1
      from public.buddy_swipes s
      where s.swiper_id = auth.uid()
        and s.target_id = cp.id
    )
  order by score desc
  limit p_limit;
$$;
grant execute on function public.activity_candidates(uuid, int)
  to authenticated;

-- SUPERSEDED 2026-06-29: the canonical city_people lives in home-carousels.sql.
-- This was a behaviorally-identical duplicate (whitespace-only diff). Wrapped so
-- re-running this file can't install a second live copy. Do not un-wrap.
/*
create or replace function public.city_people(p_limit int default 12)
returns table (
  id uuid,
  display_name text,
  age int,
  photos text[],
  one_liner text,
  home_city text,
  score float8
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select *
    from public.profiles
    where id = auth.uid()
  )
  select
    cp.id,
    cp.display_name,
    cp.age,
    cp.photos,
    cp.one_liner,
    cp.home_city,
    public.buddy_pair_score(auth.uid(), cp.id)::float8 as score
  from public.profiles cp
  cross join me
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    and coalesce(me.home_city, '') <> ''
    and lower(coalesce(cp.home_city, '')) = lower(me.home_city)
    and not exists (
      select 1
      from public.buddy_swipes s
      where s.swiper_id = auth.uid()
        and s.target_id = cp.id
    )
    and not exists (
      select 1
      from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.candidate_id = cp.id
    )
  order by score desc nulls last
  limit p_limit;
$$;
grant execute on function public.city_people(int) to authenticated;
*/
