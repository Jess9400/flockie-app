-- Home page carousels: "People in your city" + "Flocks you can join".
-- Run in the Supabase SQL editor. Safe to re-run.

-- People in the viewer's home city who are open to discovery. Mirrors
-- activity_candidates but keys off the viewer's own home_city instead of a
-- posted activity's destination, so it works with no posted activity.
create or replace function public.city_people(p_limit int default 12)
returns table (
  id uuid, display_name text, age int, photos text[], one_liner text,
  home_city text, score float8
)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid())
  select cp.id, cp.display_name, cp.age, cp.photos, cp.one_liner, cp.home_city,
         public.buddy_pair_score(auth.uid(), cp.id)::float8 as score
  from public.profiles cp, me
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    and coalesce(me.home_city, '') <> ''
    and lower(coalesce(cp.home_city, '')) = lower(me.home_city)
  order by score desc nulls last
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
