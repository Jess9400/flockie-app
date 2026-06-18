-- Buddy (people) matching: swipes, matches, ranking, city gate. Run in SQL Editor.

create table if not exists public.buddy_swipes (
  swiper_id uuid references public.profiles(id) on delete cascade,
  target_id uuid references public.profiles(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz default now(),
  primary key (swiper_id, target_id)
);
alter table public.buddy_swipes enable row level security;
drop policy if exists "own swipes" on public.buddy_swipes;
create policy "own swipes" on public.buddy_swipes for all to authenticated
  using (swiper_id = auth.uid()) with check (swiper_id = auth.uid());

create table if not exists public.buddy_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_a, user_b)
);
alter table public.buddy_matches enable row level security;
drop policy if exists "see own matches" on public.buddy_matches;
create policy "see own matches" on public.buddy_matches for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- How many registered profiles share my city (excluding me)?
create or replace function public.buddy_city_count()
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from public.profiles p
  where p.id <> auth.uid()
    and p.home_city is not null
    and lower(p.home_city) = (select lower(home_city) from public.profiles where id = auth.uid());
$$;
grant execute on function public.buddy_city_count() to authenticated;

-- Ranked candidates in my city (completed profiles, not me, not already swiped)
create or replace function public.buddy_candidates(p_limit int default 30)
returns table (id uuid, display_name text, age int, photos text[], one_liner text, trip_vibe text[], home_city text, score float8)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid())
  select c.id, c.display_name, c.age, c.photos, c.one_liner, c.trip_vibe, c.home_city,
    ( 0.6 * (case when me.planning is null or c.planning is null then 0.5 else 1 - (
        (abs(c.planning-me.planning)+abs(c.pace-me.pace)+abs(c.social_energy-me.social_energy)
        +abs(c.budget-me.budget)+abs(c.nightlife-me.nightlife)+abs(c.adventurousness-me.adventurousness))::float/24) end)
    + 0.4 * ( coalesce((
        select count(*)::float from unnest(coalesce(c.trip_vibe,'{}')||coalesce(c.travel_style,'{}')) t
        where t = any (coalesce(me.trip_vibe,'{}')||coalesce(me.travel_style,'{}'))
      ),0) / greatest(cardinality(coalesce(me.trip_vibe,'{}')||coalesce(me.travel_style,'{}')),1) )
    ) * 100 as score
  from public.profiles c cross join me
  where c.id <> me.id
    and c.onboarding_complete
    and c.home_city is not null
    and lower(c.home_city) = lower(me.home_city)
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id = me.id and s.target_id = c.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.buddy_candidates(int) to authenticated;

-- Record a swipe; on mutual like, create a match + notify both
create or replace function public.buddy_swipe(p_target uuid, p_liked boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare matched boolean := false;
begin
  insert into public.buddy_swipes (swiper_id, target_id, liked)
  values (auth.uid(), p_target, p_liked)
  on conflict (swiper_id, target_id) do update set liked = excluded.liked;

  if p_liked and exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = p_target and s.target_id = auth.uid() and s.liked
  ) then
    insert into public.buddy_matches (user_a, user_b)
    values (least(auth.uid(), p_target), greatest(auth.uid(), p_target))
    on conflict (user_a, user_b) do nothing;
    perform public.notify(p_target, 'buddy_match', 'It''s a match! 🎉',
            'You both liked each other. Say hi.', jsonb_build_object('user_id', auth.uid()));
    perform public.notify(auth.uid(), 'buddy_match', 'It''s a match! 🎉',
            'You both liked each other. Say hi.', jsonb_build_object('user_id', p_target));
    matched := true;
  end if;
  return matched;
end $$;
grant execute on function public.buddy_swipe(uuid, boolean) to authenticated;
