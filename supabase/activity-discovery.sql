-- Activity discovery: match anyone in your current city who is "open to discovery"
-- (no posted activity needed). Run in the Supabase SQL editor. Safe to re-run.

alter table public.profiles
  add column if not exists open_to_discovery boolean not null default true;

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
  on public.activity_candidate_decisions for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.trips t
      where t.id = activity_id
        and t.user_id = auth.uid()
        and t.kind = 'activity'
    )
  );

-- SUPERSEDED: this activity_candidates lacked the buddy_hard_block dealbreaker
-- filter. Canonical version is in supabase/activity-candidate-decisions.sql.
-- Wrapped out 2026-06-28 so re-running this file can't downgrade the live engine.
-- (The open_to_discovery column add above and buddy_swipe below remain active.)
/*
-- People in the activity's city, open to discovery, with an activity check done.
drop function if exists public.activity_candidates(uuid, int);
create or replace function public.activity_candidates(p_trip uuid, p_limit int default 30)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (select * from public.trips where id = p_trip and user_id = auth.uid()),
       me_p as (select * from public.profiles where id = auth.uid())
  select
    cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
    null::text as title,
    array[cp.home_city]::text[] as destinations,
    null::date as start_date,
    null::date as end_date,
    null::text[] as trip_type,
    ( 100 * (
        0.5 * (public.buddy_pair_score(auth.uid(), cp.id) / 100.0)
        + 0.5 * (
          case
            when coalesce(array_length(cp.activity_vibe, 1), 0) = 0
              or coalesce(array_length(me_p.activity_vibe, 1), 0) = 0
            then 0.5
            else cardinality(array(select unnest(cp.activity_vibe) intersect select unnest(me_p.activity_vibe)))::numeric
                 / nullif(cardinality(array(select unnest(cp.activity_vibe) union select unnest(me_p.activity_vibe))), 0)
          end
        )
      ) )::float8 as score
  from public.profiles cp
  cross join me_t
  cross join me_p
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    and coalesce(array_length(cp.activities, 1), 0) > 0
    and lower(coalesce(cp.home_city, '')) = lower(coalesce(me_t.destination, ''))
    and not exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.activity_id = p_trip
        and d.candidate_id = cp.id
    )
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id = auth.uid() and s.target_id = cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.activity_candidates(uuid, int) to authenticated;
*/

-- buddy_swipe + a one-way "likes you" notification for activity discovery.
-- SUPERSEDED: canonical buddy_swipe is in supabase/buddy-swipe-notify-once.sql
-- (#89 — gates match / activity-like notifications so repeat calls don't spam).
-- Wrapped out 2026-06-28; re-running this file must NOT revert that fix.
/*
drop function if exists public.buddy_swipe(uuid, boolean);
drop function if exists public.buddy_swipe(uuid, boolean, text);
create or replace function public.buddy_swipe(p_target uuid, p_liked boolean, p_activity_title text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_a uuid := least(auth.uid(), p_target);
  v_b uuid := greatest(auth.uid(), p_target);
  v_match uuid; v_chat uuid; v_trip_a uuid; v_trip_b uuid; v_score numeric; v_mutual boolean;
  v_liker text; v_city text;
begin
  insert into public.buddy_swipes (swiper_id, target_id, liked)
  values (auth.uid(), p_target, p_liked)
  on conflict (swiper_id, target_id) do update set liked = excluded.liked;

  v_mutual := p_liked and exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = p_target and s.target_id = auth.uid() and s.liked
  );

  if v_mutual then
    select id into v_trip_a from public.trips where user_id = v_a and status = 'active' order by created_at desc limit 1;
    select id into v_trip_b from public.trips where user_id = v_b and status = 'active' order by created_at desc limit 1;
    v_score := public.buddy_pair_score(v_a, v_b);
    insert into public.buddy_matches (user_a, user_b, trip_a, trip_b, score)
    values (v_a, v_b, v_trip_a, v_trip_b, v_score)
    on conflict (user_a, user_b) do update set
      trip_a = coalesce(public.buddy_matches.trip_a, excluded.trip_a),
      trip_b = coalesce(public.buddy_matches.trip_b, excluded.trip_b),
      score  = coalesce(public.buddy_matches.score,  excluded.score);
    select id into v_match from public.buddy_matches where user_a = v_a and user_b = v_b;
    insert into public.buddy_chats (match_id) values (v_match) on conflict (match_id) do nothing;
    select id into v_chat from public.buddy_chats where match_id = v_match;
    perform public.notify(p_target, 'buddy_match', 'It''s a match! 🎉', 'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    perform public.notify(auth.uid(), 'buddy_match', 'It''s a match! 🎉', 'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    return jsonb_build_object('matched', true, 'chat_id', v_chat);
  elsif p_liked and p_activity_title is not null then
    select display_name, home_city into v_liker, v_city from public.profiles where id = auth.uid();
    perform public.notify(
      p_target, 'activity_like',
      coalesce(v_liker, 'Someone') || ' wants to do something with you',
      coalesce(v_liker, 'Someone') || ' is in ' || coalesce(v_city, 'your city') ||
        ' looking for someone to do ' || p_activity_title || ' — your vibes match. Match back to chat.',
      jsonb_build_object('like_from', auth.uid())
    );
  end if;
  return jsonb_build_object('matched', false);
end $$;
grant execute on function public.buddy_swipe(uuid, boolean, text) to authenticated;
*/

drop function if exists public.activity_candidate_decide(uuid, uuid, boolean);
create or replace function public.activity_candidate_decide(
  p_activity uuid,
  p_target uuid,
  p_liked boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_result jsonb;
begin
  if p_target = auth.uid() then
    raise exception 'You cannot choose yourself.';
  end if;

  select t.title into v_title
  from public.trips t
  where t.id = p_activity
    and t.user_id = auth.uid()
    and t.kind = 'activity'
    and t.status = 'active';

  if not found then
    raise exception 'Activity not found or no longer active.';
  end if;

  insert into public.activity_candidate_decisions (
    user_id, activity_id, candidate_id, liked, updated_at
  )
  values (auth.uid(), p_activity, p_target, p_liked, now())
  on conflict (user_id, activity_id, candidate_id)
  do update set liked = excluded.liked, updated_at = now();

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
end $$;
grant execute on function public.activity_candidate_decide(uuid, uuid, boolean)
  to authenticated;
