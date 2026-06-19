-- Travel Buddy chat backend: persist trip pairing + score on matches, leave-match
-- with notification, per-chat mute, and user reports. Run the whole file in the
-- Supabase SQL editor. Safe to re-run.

-- ── 1) Persist trip pairing + score on the match ──────────────────────────
alter table public.buddy_matches
  add column if not exists trip_a uuid references public.trips(id) on delete set null,
  add column if not exists trip_b uuid references public.trips(id) on delete set null,
  add column if not exists score numeric;

-- Compatibility score (0-100): 0.6 * slider closeness + 0.4 * trip-vibe Jaccard.
-- Matches the on-the-fly formula the app used, so persisted == displayed.
create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  s numeric := 0; n int := 0; slider numeric; tagj numeric; inter int; uni int;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;
  if ra.planning is not null and rb.planning is not null then s := s + (1 - abs(ra.planning - rb.planning) / 4.0); n := n + 1; end if;
  if ra.pace is not null and rb.pace is not null then s := s + (1 - abs(ra.pace - rb.pace) / 4.0); n := n + 1; end if;
  if ra.social_energy is not null and rb.social_energy is not null then s := s + (1 - abs(ra.social_energy - rb.social_energy) / 4.0); n := n + 1; end if;
  if ra.budget is not null and rb.budget is not null then s := s + (1 - abs(ra.budget - rb.budget) / 4.0); n := n + 1; end if;
  if ra.nightlife is not null and rb.nightlife is not null then s := s + (1 - abs(ra.nightlife - rb.nightlife) / 4.0); n := n + 1; end if;
  if ra.adventurousness is not null and rb.adventurousness is not null then s := s + (1 - abs(ra.adventurousness - rb.adventurousness) / 4.0); n := n + 1; end if;
  slider := case when n > 0 then s / n else 0.5 end;

  select count(*) into inter
  from unnest(coalesce(ra.trip_vibe, '{}')) t
  where t = any (coalesce(rb.trip_vibe, '{}'));
  select cardinality(array(
    select distinct unnest(coalesce(ra.trip_vibe, '{}') || coalesce(rb.trip_vibe, '{}'))
  )) into uni;
  tagj := case when uni > 0 then inter::numeric / uni else 0.5 end;

  return round(100 * (0.6 * slider + 0.4 * tagj));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

-- Backfill existing matches once.
update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b)
where m.score is null;
update public.buddy_matches m
set trip_a = (select id from public.trips where user_id = m.user_a and status = 'active' order by created_at desc limit 1)
where m.trip_a is null;
update public.buddy_matches m
set trip_b = (select id from public.trips where user_id = m.user_b and status = 'active' order by created_at desc limit 1)
where m.trip_b is null;

-- ── 2) Record trip pairing + score when a match is created ─────────────────
create or replace function public.buddy_swipe(p_target uuid, p_liked boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_a uuid := least(auth.uid(), p_target);
  v_b uuid := greatest(auth.uid(), p_target);
  v_match uuid; v_chat uuid; v_trip_a uuid; v_trip_b uuid; v_score numeric;
begin
  insert into public.buddy_swipes (swiper_id, target_id, liked)
  values (auth.uid(), p_target, p_liked)
  on conflict (swiper_id, target_id) do update set liked = excluded.liked;

  if p_liked and exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = p_target and s.target_id = auth.uid() and s.liked
  ) then
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
    perform public.notify(p_target, 'buddy_match', 'It''s a match! 🎉',
            'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    perform public.notify(auth.uid(), 'buddy_match', 'It''s a match! 🎉',
            'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    return jsonb_build_object('matched', true, 'chat_id', v_chat);
  end if;
  return jsonb_build_object('matched', false);
end $$;
grant execute on function public.buddy_swipe(uuid, boolean) to authenticated;

-- ── 3) Leave match (notifies the other person, then deletes) ──────────────
drop policy if exists "leave own matches" on public.buddy_matches;
create policy "leave own matches" on public.buddy_matches for delete to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

create or replace function public.leave_buddy_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.buddy_matches%rowtype; v_other uuid;
begin
  select * into m from public.buddy_matches where id = p_match and auth.uid() in (user_a, user_b);
  if not found then raise exception 'not a member of this match'; end if;
  v_other := case when m.user_a = auth.uid() then m.user_b else m.user_a end;
  perform public.notify(v_other, 'buddy_left', 'A travel match ended',
          'One of your travel matches left the chat.', '{}'::jsonb);
  delete from public.buddy_matches where id = p_match;
end $$;
grant execute on function public.leave_buddy_match(uuid) to authenticated;

-- ── 4) Per-chat mute (works for buddy + vibe chats; generic chat_id) ───────
create table if not exists public.chat_mutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, chat_id)
);
alter table public.chat_mutes enable row level security;
drop policy if exists "own mutes" on public.chat_mutes;
create policy "own mutes" on public.chat_mutes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.toggle_chat_mute(p_chat uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.chat_mutes where user_id = auth.uid() and chat_id = p_chat) then
    delete from public.chat_mutes where user_id = auth.uid() and chat_id = p_chat;
    return false;
  else
    insert into public.chat_mutes (user_id, chat_id) values (auth.uid(), p_chat);
    return true;
  end if;
end $$;
grant execute on function public.toggle_chat_mute(uuid) to authenticated;

-- Teach notify() to respect per-chat mutes (when data carries a chat_id).
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = p_user and coalesce(notifications_enabled, true))
     and not exists (
       select 1 from public.chat_mutes cm
       where cm.user_id = p_user
         and p_data ? 'chat_id'
         and cm.chat_id = (p_data->>'chat_id')::uuid
     )
  then
    insert into public.notifications (user_id, type, title, body, data)
    values (p_user, p_type, p_title, p_body, p_data);
  end if;
end $$;

-- ── 5) User reports ───────────────────────────────────────────────────────
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);
alter table public.user_reports enable row level security;
drop policy if exists "report insert" on public.user_reports;
create policy "report insert" on public.user_reports for insert to authenticated
  with check (reporter_id = auth.uid());

create or replace function public.report_user(p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_reports (reporter_id, reported_id, reason)
  values (auth.uid(), p_target, nullif(trim(p_reason), ''));
end $$;
grant execute on function public.report_user(uuid, text) to authenticated;
