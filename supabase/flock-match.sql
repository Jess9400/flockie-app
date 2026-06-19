-- Match % between a browsing user and an open group trip (Find a Flock).
-- Run the whole file in the Supabase SQL editor. Safe to re-run.
--   0.35 activity fit  — trip_type vs your trip-vibe / activity-vibe
--   0.20 budget fit    — trip budget vs your budget
--   0.20 pace fit      — trip pace vs your pace
--   0.25 vibe fit      — slider closeness with the trip host

create or replace function public.flock_match(p_user uuid, p_trip uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare
  me public.profiles%rowtype;
  host public.profiles%rowtype;
  t public.trips%rowtype;
  tag_fit numeric; budget_fit numeric; pace_fit numeric; slider numeric;
  s numeric := 0; n int := 0; inter int; my_tags text[];
begin
  select * into t from public.trips where id = p_trip;
  if t.id is null then return null; end if;
  select * into me from public.profiles where id = p_user;
  select * into host from public.profiles where id = t.user_id;

  -- activity / tag fit
  my_tags := coalesce(me.trip_vibe, '{}') || coalesce(me.activity_vibe, '{}');
  if coalesce(array_length(t.trip_type, 1), 0) = 0 or coalesce(array_length(my_tags, 1), 0) = 0 then
    tag_fit := 0.5;
  else
    select count(*) into inter
    from unnest(t.trip_type) tt
    where exists (
      select 1 from unnest(my_tags) mt
      where lower(mt) like '%' || lower(tt) || '%' or lower(tt) like '%' || lower(mt) || '%'
    );
    tag_fit := least(inter::numeric / array_length(t.trip_type, 1), 1);
  end if;

  -- budget / pace closeness vs the trip
  budget_fit := case when t.budget is null or me.budget is null then 0.5
                     else 1 - abs(t.budget - me.budget)::numeric / 4 end;
  pace_fit := case when t.pace is null or me.pace is null then 0.5
                   else 1 - abs(t.pace - me.pace)::numeric / 4 end;

  -- slider closeness with the host
  if me.planning is not null and host.planning is not null then s := s + (1 - abs(me.planning - host.planning) / 4.0); n := n + 1; end if;
  if me.social_energy is not null and host.social_energy is not null then s := s + (1 - abs(me.social_energy - host.social_energy) / 4.0); n := n + 1; end if;
  if me.nightlife is not null and host.nightlife is not null then s := s + (1 - abs(me.nightlife - host.nightlife) / 4.0); n := n + 1; end if;
  if me.adventurousness is not null and host.adventurousness is not null then s := s + (1 - abs(me.adventurousness - host.adventurousness) / 4.0); n := n + 1; end if;
  slider := case when n > 0 then s / n else 0.5 end;

  return round(100 * (0.35 * tag_fit + 0.20 * budget_fit + 0.20 * pace_fit + 0.25 * slider));
end $$;
grant execute on function public.flock_match(uuid, uuid) to authenticated;

create or replace function public.flock_match_scores(p_ids uuid[])
returns table (trip_id uuid, score int)
language sql security definer set search_path = public stable as $$
  select t.id, public.flock_match(auth.uid(), t.id)
  from public.trips t
  where t.id = any(p_ids);
$$;
grant execute on function public.flock_match_scores(uuid[]) to authenticated;
