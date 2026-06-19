-- Buddy matching, consolidated + per-post targeting. Lets "Find a match" pick a
-- specific trip/activity to swipe on (p_trip). Run in the Supabase SQL editor.
-- Safe to re-run. (Replaces the inline buddy_candidates_trip / buddy_dest_count.)

drop function if exists public.buddy_dest_count();
drop function if exists public.buddy_dest_count(text);
drop function if exists public.buddy_dest_count(text, uuid);

-- How many OTHER users have an overlapping post (same kind + destination)?
create or replace function public.buddy_dest_count(p_kind text default 'trip', p_trip uuid default null)
returns int language sql security definer set search_path = public stable as $$
  with me_t as (
    select * from public.trips
    where user_id = auth.uid() and status = 'active'
      and (id = p_trip or (p_trip is null and kind = p_kind))
    order by created_at desc limit 1
  )
  select count(distinct t.user_id)::int
  from public.trips t cross join me_t
  where t.user_id <> auth.uid() and t.status = 'active' and t.kind = me_t.kind
    and coalesce(t.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    and exists (
      select 1 from unnest(coalesce(t.destinations, '{}')) a
      join unnest(coalesce(me_t.destinations, '{}')) b on lower(a) = lower(b)
    );
$$;
grant execute on function public.buddy_dest_count(text, uuid) to authenticated;

drop function if exists public.buddy_candidates_trip(int);
drop function if exists public.buddy_candidates_trip(int, text);
drop function if exists public.buddy_candidates_trip(int, text, uuid);

-- Ranked candidates for a specific post (p_trip) or the latest active of p_kind.
create or replace function public.buddy_candidates_trip(
  p_limit int default 30, p_kind text default 'trip', p_trip uuid default null
)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (
    select * from public.trips
    where user_id = auth.uid() and status = 'active'
      and (id = p_trip or (p_trip is null and kind = p_kind))
    order by created_at desc limit 1
  ),
  me_p as (select * from public.profiles where id = auth.uid())
  select cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
         ct.title, ct.destinations, ct.start_date, ct.end_date, ct.trip_type,
    ( (
        0.25 * (
          with sh as (select count(*)::float n from unnest(coalesce(ct.trip_type,'{}')) x
                      where x = any(coalesce(me_t.trip_type,'{}')))
          select case when cardinality(coalesce(me_t.trip_type,'{}'))=0 and cardinality(coalesce(ct.trip_type,'{}'))=0
                      then 0.5
                      else (select n from sh) / greatest(
                        cardinality(coalesce(me_t.trip_type,'{}')) + cardinality(coalesce(ct.trip_type,'{}')) - (select n from sh), 1) end
        )
      + 0.15 * (1 - abs(coalesce(ct.pace, cp.pace, 3) - coalesce(me_t.pace, me_p.pace, 3))::float / 4)
      + 0.15 * (1 - abs(coalesce(ct.budget, cp.budget, 3) - coalesce(me_t.budget, me_p.budget, 3))::float / 4)
      + 0.10 * (case when cp.planning is null or me_p.planning is null then 0.5
                     else 1 - abs(cp.planning - me_p.planning)::float / 4 end)
      + 0.10 * (case when cp.social_energy is null or me_p.social_energy is null then 0.5
                     else 1 - abs(cp.social_energy - me_p.social_energy)::float / 4 end)
      + 0.15 * (case when cp.planning is null or me_p.planning is null then 0.5
                     else 1 - ((abs(cp.planning-me_p.planning)+abs(cp.pace-me_p.pace)
                       +abs(cp.social_energy-me_p.social_energy)+abs(cp.budget-me_p.budget)
                       +abs(cp.nightlife-me_p.nightlife)+abs(cp.adventurousness-me_p.adventurousness))::float/24) end)
      ) / 0.90 ) * 100 as score
  from public.trips ct
  join public.profiles cp on cp.id = ct.user_id
  cross join me_t cross join me_p
  where ct.user_id <> auth.uid()
    and ct.status = 'active'
    and ct.kind = me_t.kind
    and coalesce(ct.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    and exists (select 1 from unnest(coalesce(ct.destinations,'{}')) a
                join unnest(coalesce(me_t.destinations,'{}')) b on lower(a)=lower(b))
    and (greatest(ct.start_date, me_t.start_date) - least(ct.end_date, me_t.end_date)) <= 30
    and cp.onboarding_complete
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int, text, uuid) to authenticated;
