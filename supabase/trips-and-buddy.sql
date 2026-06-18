-- Phase 1: trip posting + trip-based buddy matching + match-opens-chat.
-- Run in Supabase SQL Editor.

-- Base swipe/match tables (safe if already created earlier)
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

-- Deals readiness (one-tap later if we get an activities API)
alter table public.vibes
  add column if not exists source_provider text,
  add column if not exists source_activity_url text,
  add column if not exists source_provider_id text;

-- ── trips (a user's trip intention) ───────────────────────────────────────
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  group_size int not null default 2 check (group_size between 1 and 50),
  trip_type text[] default '{}',
  budget int check (budget between 1 and 5),
  pace int check (pace between 1 and 5),
  status text not null default 'active',
  created_at timestamptz default now()
);
create index if not exists trips_dest_idx on public.trips (lower(destination));
create index if not exists trips_user_idx on public.trips (user_id, status, created_at desc);

alter table public.trips enable row level security;
drop policy if exists "trips readable" on public.trips;
create policy "trips readable" on public.trips for select to authenticated using (true);
drop policy if exists "trips own write" on public.trips;
create policy "trips own write" on public.trips for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── buddy chats (1:1 chat opened on a mutual match) ───────────────────────
create table if not exists public.buddy_chats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.buddy_matches(id) on delete cascade unique,
  created_at timestamptz default now()
);
create table if not exists public.buddy_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.buddy_chats(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table public.buddy_chats enable row level security;
alter table public.buddy_messages enable row level security;

create or replace function public.is_buddy_chat_member(p_chat uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.buddy_chats bc
    join public.buddy_matches m on m.id = bc.match_id
    where bc.id = p_chat and auth.uid() in (m.user_a, m.user_b)
  );
$$;

drop policy if exists "buddy chat read" on public.buddy_chats;
create policy "buddy chat read" on public.buddy_chats for select to authenticated
  using (public.is_buddy_chat_member(id));
drop policy if exists "buddy msg read" on public.buddy_messages;
create policy "buddy msg read" on public.buddy_messages for select to authenticated
  using (public.is_buddy_chat_member(chat_id));
drop policy if exists "buddy msg send" on public.buddy_messages;
create policy "buddy msg send" on public.buddy_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_buddy_chat_member(chat_id));

do $$ begin alter publication supabase_realtime add table public.buddy_messages;
exception when duplicate_object then null; end $$;

-- ── how many OTHER users have a trip to my destination? (the 99 gate) ──────
create or replace function public.buddy_dest_count()
returns int language sql security definer set search_path = public stable as $$
  with me as (select destination from public.trips
              where user_id = auth.uid() and status='active'
              order by created_at desc limit 1)
  select count(distinct t.user_id)::int
  from public.trips t, me
  where t.user_id <> auth.uid() and t.status='active'
    and lower(t.destination) = lower(me.destination);
$$;
grant execute on function public.buddy_dest_count() to authenticated;

-- ── ranked candidates: same destination + date overlap >=3 days (V1a) ─────
create or replace function public.buddy_candidates_trip(p_limit int default 30)
returns table (id uuid, display_name text, age int, photos text[], one_liner text,
               destination text, start_date date, end_date date, trip_type text[], score float8)
language sql security definer set search_path = public stable as $$
  with me_t as (select * from public.trips where user_id=auth.uid() and status='active' order by created_at desc limit 1),
       me_p as (select * from public.profiles where id=auth.uid())
  select cp.id, cp.display_name, cp.age, cp.photos, cp.one_liner,
         ct.destination, ct.start_date, ct.end_date, ct.trip_type,
    ( (  -- tag overlap (trip type)
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
    and ct.status='active'
    and lower(ct.destination) = lower(me_t.destination)
    and (least(ct.end_date, me_t.end_date) - greatest(ct.start_date, me_t.start_date)) >= 2
    and cp.onboarding_complete
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int) to authenticated;

-- ── swipe → on mutual like, create match + chat, return chat id ───────────
create or replace function public.buddy_swipe(p_target uuid, p_liked boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_match uuid; v_chat uuid;
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
    select id into v_match from public.buddy_matches
      where user_a = least(auth.uid(), p_target) and user_b = greatest(auth.uid(), p_target);
    insert into public.buddy_chats (match_id) values (v_match) on conflict (match_id) do nothing;
    select id into v_chat from public.buddy_chats where match_id = v_match;
    perform public.notify(p_target, 'buddy_match', 'It''s a match! 🎉',
            'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    perform public.notify(auth.uid(), 'buddy_match', 'It''s a match! 🎉',
            'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    return jsonb_build_object('matched', true, 'chat_id', v_chat);
  end if;
  return jsonb_build_object('matched', false);
end $$;
grant execute on function public.buddy_swipe(uuid, boolean) to authenticated;
