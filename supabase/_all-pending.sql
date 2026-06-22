-- Flockie — all pending migrations, ordered. Paste & run once. Safe to re-run.


-- ============================================================
-- recommended-vibes.sql
-- ============================================================
-- Vibe match scoring + "Picked for you". Run the whole file in the Supabase SQL
-- editor. Safe to re-run.
--
-- vibe_match(user, vibe) -> 0-100, how well an open Vibe fits a user's profile:
--   0.40 category fit   — does the Vibe's category match something you do?
--   0.30 vibe-tag fit   — event tags (chill/social/party…) vs your activity vibe
--   0.15 skill fit      — required skill vs your skill in that activity
--   0.15 social fit     — how social the event reads vs your activity-social pref
-- Used by both the "X% your vibe" card badge and the "Picked for you" ranking.

create or replace function public.vibe_match(p_user uuid, p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare
  pr public.profiles%rowtype;
  v public.vibes%rowtype;
  cat_fit numeric; tag_fit numeric; skill_fit numeric; social_fit numeric;
  n_tags int; n_match int; event_social int; matched_skill int;
begin
  select * into pr from public.profiles where id = p_user;
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return null; end if;

  -- category / activity fit
  if coalesce(array_length(pr.activities, 1), 0) = 0 or v.category is null or v.category = 'other' then
    cat_fit := 0.5;
  elsif exists (select 1 from unnest(pr.activities) a where lower(a) like '%' || lower(v.category) || '%') then
    cat_fit := 1.0;
  else
    cat_fit := 0.2;
  end if;

  -- vibe-tag fit (event tags appearing in the user's activity-vibe phrases)
  n_tags := coalesce(array_length(v.event_vibe_tags, 1), 0);
  if n_tags = 0 or coalesce(array_length(pr.activity_vibe, 1), 0) = 0 then
    tag_fit := 0.5;
  else
    select count(*) into n_match
    from unnest(v.event_vibe_tags) tg
    where lower(array_to_string(pr.activity_vibe, ' ')) like '%' || lower(tg) || '%';
    tag_fit := n_match::numeric / n_tags;
  end if;

  -- skill fit
  if v.required_skill_level is null then
    skill_fit := 1.0;
  else
    select (pr.activity_skills->>a)::int into matched_skill
    from unnest(pr.activities) a
    where lower(a) like '%' || lower(v.category) || '%' and pr.activity_skills ? a
    limit 1;
    if matched_skill is null then
      skill_fit := 0.5;
    else
      skill_fit := 1 - abs(v.required_skill_level - matched_skill)::numeric / 4;
    end if;
  end if;

  -- social fit
  event_social := case
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('party', 'social', 'energetic')) then 5
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('quiet', 'chill')) then 2
    else 3
  end;
  if pr.activity_social is null then
    social_fit := 0.5;
  else
    social_fit := 1 - abs(event_social - pr.activity_social)::numeric / 4;
  end if;

  return round(100 * (0.40 * cat_fit + 0.30 * tag_fit + 0.15 * skill_fit + 0.15 * social_fit));
end $$;
grant execute on function public.vibe_match(uuid, uuid) to authenticated;

-- Per-vibe match for the "X% your vibe" badge on cards.
drop function if exists public.vibe_match_scores(uuid[]);
create or replace function public.vibe_match_scores(p_ids uuid[])
returns table (vibe_id uuid, score int)
language sql security definer set search_path = public stable as $$
  select v.id, public.vibe_match(auth.uid(), v.id)
  from public.vibes v
  where v.id = any(p_ids);
$$;
grant execute on function public.vibe_match_scores(uuid[]) to authenticated;

-- "Picked for you": upcoming open Vibes in your city you don't host / haven't
-- shown interest in, ranked by vibe_match.
drop function if exists public.recommended_vibes(int);
create or replace function public.recommended_vibes(p_limit int default 6)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  photos text[],
  city text,
  location_name text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  match_score int
)
language sql security definer set search_path = public stable as $$
  with me as (select id, home_city from public.profiles where id = auth.uid())
  select
    v.id, v.host_id, v.title, v.category, v.photos, v.city, v.location_name,
    v.starts_at, v.capacity, v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status = 'open'
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    and not exists (
      select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = m.id
    )
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$$;
grant execute on function public.recommended_vibes(int) to authenticated;


-- ============================================================
-- reviews.sql
-- ============================================================
-- Reviews: travel buddies rate each other after a trip. Run in the Supabase SQL
-- editor. Safe to re-run.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reviewer_id, subject_id)
);
create index if not exists reviews_subject_idx on public.reviews (subject_id);

alter table public.reviews enable row level security;

-- Reviews are public (shown on profiles).
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews readable" on public.reviews for select to authenticated using (true);

-- Submit/update a review. Gated: you can only review someone you were matched
-- with as travel buddies, and never yourself. Upserts so editing is allowed.
create or replace function public.submit_review(p_subject uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_subject = auth.uid() then
    raise exception 'cannot review yourself';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1-5';
  end if;
  if not exists (
    select 1 from public.buddy_matches
    where (user_a = auth.uid() and user_b = p_subject)
       or (user_a = p_subject and user_b = auth.uid())
  ) then
    raise exception 'you can only review a travel buddy you matched with';
  end if;

  insert into public.reviews (reviewer_id, subject_id, rating, comment)
  values (auth.uid(), p_subject, p_rating, nullif(trim(p_comment), ''))
  on conflict (reviewer_id, subject_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end $$;
grant execute on function public.submit_review(uuid, int, text) to authenticated;


-- ============================================================
-- vibe-reviews.sql
-- ============================================================
-- Vibe reviews: attendees rate the EVENT (not each other). Aggregated into
-- weighted percentages ("80% said Fun"). Run in the Supabase SQL editor.
-- Safe to re-run.

create table if not exists public.vibe_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  recommend boolean not null default true,
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reviewer_id, vibe_id)
);
create index if not exists vibe_reviews_vibe_idx on public.vibe_reviews (vibe_id);

alter table public.vibe_reviews enable row level security;

drop policy if exists "vibe reviews readable" on public.vibe_reviews;
create policy "vibe reviews readable" on public.vibe_reviews for select to authenticated using (true);

-- Submit/update a vibe review. Gated: confirmed attendee + the vibe has started.
create or replace function public.submit_vibe_review(
  p_vibe uuid, p_recommend boolean, p_tags text[], p_comment text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_start timestamptz;
begin
  select starts_at into v_start from public.vibes where id = p_vibe;
  if v_start is null then
    raise exception 'vibe not found';
  end if;
  if v_start > now() then
    raise exception 'you can review a vibe once it has started';
  end if;
  if not exists (
    select 1 from public.vibe_interests
    where vibe_id = p_vibe and user_id = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'only confirmed attendees can review this vibe';
  end if;

  insert into public.vibe_reviews (reviewer_id, vibe_id, recommend, tags, comment)
  values (auth.uid(), p_vibe, p_recommend, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  on conflict (reviewer_id, vibe_id)
  do update set recommend = excluded.recommend, tags = excluded.tags,
                comment = excluded.comment, updated_at = now();
end $$;
grant execute on function public.submit_vibe_review(uuid, boolean, text[], text) to authenticated;


-- ============================================================
-- buddy-match-context.sql
-- ============================================================
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


-- ============================================================
-- vibe-lifecycle.sql
-- ============================================================
-- Real Vibe chat system messages (joined/left) + standby promotion on leave.
-- Run the whole file in the Supabase SQL editor. Safe to re-run.

-- Insert a system message (sender_id null) into a Vibe's chat, if it exists.
create or replace function public.vibe_system_msg(p_vibe uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select id into v_chat from public.vibing_chats where vibe_id = p_vibe;
  if v_chat is not null then
    insert into public.vibing_messages (chat_id, sender_id, content)
    values (v_chat, null, p_text);
  end if;
end $$;

-- confirm_vibe: invited user accepts; opens chat + confirms + posts "joined".
create or replace function public.confirm_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_name text;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;

  update public.vibe_interests
    set status = 'confirmed', confirmed_at = now()
    where vibe_id = p_vibe and user_id = auth.uid() and status in ('invited', 'interested');

  insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;

  v_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  perform public.vibe_system_msg(p_vibe, v_name || ' joined the chat');

  insert into public.notifications (user_id, type, title, body, data)
    values (auth.uid(), 'vibe_confirmed', 'You''re in for ' || v.title,
            'Vibing Chat is now open.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.confirm_vibe(uuid) to authenticated;

-- leave_vibe: a confirmed attendee leaves; posts "left", and if a spot freed,
-- promotes the top standby to invited (24h window + notification).
create or replace function public.leave_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.vibes; v_status text; v_name text; v_promoted uuid; v_promoted_name text;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;

  select status into v_status from public.vibe_interests
    where vibe_id = p_vibe and user_id = auth.uid();

  update public.vibe_interests set status = 'declined'
    where vibe_id = p_vibe and user_id = auth.uid();

  v_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  perform public.vibe_system_msg(p_vibe, v_name || ' left the chat');

  if v_status in ('confirmed', 'invited') then
    select user_id into v_promoted from public.vibe_interests
      where vibe_id = p_vibe and status = 'standby'
      order by match_score desc nulls last
      limit 1;
    if v_promoted is not null then
      update public.vibe_interests
        set status = 'invited', invitation_sent_at = now(),
            invitation_expires_at = now() + interval '24 hours'
        where vibe_id = p_vibe and user_id = v_promoted;
      insert into public.notifications (user_id, type, title, body, data)
        values (v_promoted, 'vibe_invitation', 'A spot opened in ' || v.title,
                'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
      v_promoted_name := coalesce((select display_name from public.profiles where id = v_promoted), 'Someone');
      perform public.vibe_system_msg(p_vibe, v_promoted_name || ' was invited from standby');
    end if;
  end if;
end $$;
grant execute on function public.leave_vibe(uuid) to authenticated;


-- ============================================================
-- flock-match.sql
-- ============================================================
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


-- ============================================================
-- flock-requests.sql
-- ============================================================
-- Flock join approvals: host accepts/declines requests; "going" = host + accepted.
-- Run the whole file in the Supabase SQL editor. Safe to re-run.

alter table public.trip_join_requests
  add column if not exists status text not null default 'pending';

-- Host approves a request → member is "going".
create or replace function public.approve_join_request(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_dest text;
begin
  select user_id, destination into v_host, v_dest from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can approve'; end if;
  update public.trip_join_requests set status = 'accepted'
    where trip_id = p_trip and user_id = p_user;
  perform public.notify(p_user, 'flock_approved', 'You''re in! ' || v_dest,
          'The host approved your request to join.', jsonb_build_object('trip_id', p_trip));
end $$;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;

-- Host declines a request.
create or replace function public.decline_join_request(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  select user_id into v_host from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can decline'; end if;
  update public.trip_join_requests set status = 'declined'
    where trip_id = p_trip and user_id = p_user;
end $$;
grant execute on function public.decline_join_request(uuid, uuid) to authenticated;

-- Accepted members can read each other's requests on a trip (so confirmed
-- attendees + browsers can see who's going). Requesters always see their own.
drop policy if exists "join requests readable" on public.trip_join_requests;
create policy "join requests readable" on public.trip_join_requests for select to authenticated
  using (true);


-- ============================================================
-- creation-gates.sql
-- ============================================================
-- Creation gates for trips/activities. Run in the Supabase SQL editor. Safe to re-run.
--   1) A user may have at most 10 active trips (kind='trip'); activities unlimited.
--   2) After a trip/activity is done, the user must review their matched buddy
--      before creating the next trip or activity.

-- Buddies the caller still needs to review (past trip/activity, no review yet).
-- Used by the UI to show the gate with links.
create or replace function public.pending_reviews()
returns table (buddy_id uuid, display_name text, photo text, destination text)
language sql security definer set search_path = public stable as $$
  select
    (case when m.user_a = auth.uid() then m.user_b else m.user_a end) as buddy_id,
    other.display_name,
    other.photos[1] as photo,
    t.destination
  from public.buddy_matches m
  join public.trips t
    on t.id = (case when m.user_a = auth.uid() then m.trip_a else m.trip_b end)
  join public.profiles other
    on other.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  where auth.uid() in (m.user_a, m.user_b)
    and t.end_date < current_date
    and not exists (
      select 1 from public.reviews r
      where r.reviewer_id = auth.uid()
        and r.subject_id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
    );
$$;
grant execute on function public.pending_reviews() to authenticated;

-- BEFORE INSERT gate on trips (covers trips + activities).
create or replace function public.trips_creation_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Service-role / SQL inserts (seeds, admin) have no auth context: skip gates.
  if auth.uid() is null then
    return new;
  end if;

  -- Review gate: any done trip/activity with an unreviewed matched buddy blocks.
  if exists (
    select 1
    from public.buddy_matches m
    join public.trips t
      on t.id = (case when m.user_a = new.user_id then m.trip_a else m.trip_b end)
    where new.user_id in (m.user_a, m.user_b)
      and t.end_date < current_date
      and not exists (
        select 1 from public.reviews r
        where r.reviewer_id = new.user_id
          and r.subject_id = (case when m.user_a = new.user_id then m.user_b else m.user_a end)
      )
  ) then
    raise exception 'Review your past travel buddies before creating a new trip or activity.';
  end if;

  -- 10 active-trip cap (activities are unlimited).
  if new.kind = 'trip' and (
    select count(*) from public.trips
    where user_id = new.user_id and kind = 'trip' and status = 'active'
  ) >= 10 then
    raise exception 'You can have up to 10 active trips. Complete or close one first.';
  end if;

  return new;
end $$;

drop trigger if exists trips_creation_gate_trg on public.trips;
create trigger trips_creation_gate_trg
  before insert on public.trips
  for each row execute function public.trips_creation_gate();


-- ============================================================
-- public-vibe.sql
-- ============================================================
-- Public (anon-readable) view of a single Vibe, for shareable invite links.
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.public_vibe(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  photos text[],
  city text,
  location_name text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  status text,
  host_name text,
  host_photo text,
  confirmed_count int
)
language sql security definer set search_path = public stable as $$
  select
    v.id, v.title, v.description, v.category, v.photos, v.city, v.location_name,
    v.starts_at, v.capacity, v.event_vibe_tags, v.status,
    h.display_name as host_name,
    h.photos[1] as host_photo,
    (select count(*)::int from public.vibe_interests vi
       where vi.vibe_id = v.id and vi.status = 'confirmed') as confirmed_count
  from public.vibes v
  left join public.profiles h on h.id = v.host_id
  where v.id = p_id;
$$;
grant execute on function public.public_vibe(uuid) to anon, authenticated;




-- ============================================================
-- match-priorities.sql
-- ============================================================
-- Per-user match weighting + hard dealbreaker filters. Run in the Supabase SQL
-- editor. Safe to re-run.
--
-- Two upgrades the matching algo needs to actually differentiate people:
--   1. WEIGHTS  — each user picks the 2-3 things that matter most to them.
--      Those dimensions count ~2x in THEIR ranking, so a budget-obsessed
--      traveler and a budget-agnostic one no longer get the same score.
--   2. FILTERS  — the dealbreakers we already collect (same-gender, sober)
--      now hard-exclude incompatible candidates instead of being dead data.
-- Also rescales the personality cosine, which structurally lands ~0.7-0.95 for
-- everyone, so scores spread across a usable range.

-- ── 1. Priority columns (the "weight question" answers) ──────────────────────
alter table public.profiles
  add column if not exists match_priorities text[] default '{}',      -- trip dims
  add column if not exists activity_priorities text[] default '{}';   -- activity dims

-- ── 2. Hard dealbreaker filter ───────────────────────────────────────────────
-- True when a pair should be hidden from each other entirely. Only the
-- dealbreakers with a clear partner-facing meaning are enforced; self-
-- descriptors (dietary, private bathroom…) stay soft.
create or replace function public.buddy_hard_block(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b)
  select
    -- Same-gender requirement on either side. Only enforceable when both
    -- genders are known; "prefer not to say" (null) is never auto-excluded.
    ( ( 'I prefer same-gender travel partners' = any(coalesce(a.dealbreakers, '{}'))
        or 'I prefer same-gender travel partners' = any(coalesce(b.dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(a.activity_dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(b.activity_dealbreakers, '{}')) )
      and a.gender is not null and b.gender is not null
      and a.gender <> b.gender )
    or
    -- Sober-only vs. drinks-are-fine is a real conflict for activity meetups.
    ( ( 'Sober events only' = any(coalesce(a.activity_dealbreakers, '{}'))
          and 'Drinking is fine' = any(coalesce(b.activity_dealbreakers, '{}')) )
      or ( 'Sober events only' = any(coalesce(b.activity_dealbreakers, '{}'))
          and 'Drinking is fine' = any(coalesce(a.activity_dealbreakers, '{}')) ) )
  from a, b;
$$;
grant execute on function public.buddy_hard_block(uuid, uuid) to authenticated;

-- ── 3. Weighted pair score ───────────────────────────────────────────────────
-- Weights are taken from p_a (the viewer) — "what matters to ME when ranking
-- you." A prioritized dimension counts 2x; everything else counts 1x, then the
-- block is renormalized so the total still sums to 1.
create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  prio text[];   -- viewer's trip priorities
  aprio text[];  -- viewer's activity priorities
  -- trip
  s numeric := 0; w numeric := 0; ww numeric; inter int; uni int; tagj numeric;
  slider numeric; tag_w numeric; trip_sim numeric; trip_w numeric := 0;
  -- personality
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
  cos numeric; pers_sim numeric; pers_w numeric := 0;
  -- activity
  a_inter int; a_uni int; parts numeric := 0; pw numeric := 0; pwi numeric;
  act_sim numeric; act_w numeric := 0;
  -- blend
  total numeric; wsum numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;
  prio  := coalesce(ra.match_priorities, '{}');
  aprio := coalesce(ra.activity_priorities, '{}');

  -- ----- Trip vibe: priority-weighted sliders (60%) + trip_vibe Jaccard (40%) -
  if ra.planning is not null and rb.planning is not null then
    ww := case when 'planning' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.planning - rb.planning)/4.0); w := w + ww; end if;
  if ra.pace is not null and rb.pace is not null then
    ww := case when 'pace' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.pace - rb.pace)/4.0); w := w + ww; end if;
  if ra.social_energy is not null and rb.social_energy is not null then
    ww := case when 'social_energy' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.social_energy - rb.social_energy)/4.0); w := w + ww; end if;
  if ra.budget is not null and rb.budget is not null then
    ww := case when 'budget' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.budget - rb.budget)/4.0); w := w + ww; end if;
  if ra.nightlife is not null and rb.nightlife is not null then
    ww := case when 'nightlife' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.nightlife - rb.nightlife)/4.0); w := w + ww; end if;
  if ra.adventurousness is not null and rb.adventurousness is not null then
    ww := case when 'adventurousness' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.adventurousness - rb.adventurousness)/4.0); w := w + ww; end if;

  select count(*) into inter from unnest(coalesce(ra.trip_vibe,'{}')) t where t = any(coalesce(rb.trip_vibe,'{}'));
  select cardinality(array(select distinct unnest(coalesce(ra.trip_vibe,'{}') || coalesce(rb.trip_vibe,'{}')))) into uni;

  if w > 0 then
    slider := s / w;
    tagj := case when uni > 0 then inter::numeric / uni else 0.5 end;
    -- "Shared interests" as a priority pulls the tag overlap up to a 50/50 split.
    tag_w := case when 'interests' = any(prio) then 0.5 else 0.4 end;
    trip_sim := (1 - tag_w) * slider + tag_w * tagj;
    trip_w := 0.35;
  elsif uni > 0 then
    trip_sim := inter::numeric / uni;
    trip_w := 0.35;
  end if;

  -- ----- Personality: 6-dim cosine, rescaled so the typical band spreads -----
  if ra.vibe_scores is not null and rb.vibe_scores is not null then
    foreach d in array dims loop
      av := coalesce((ra.vibe_scores ->> d)::float, 0);
      bv := coalesce((rb.vibe_scores ->> d)::float, 0);
      dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
    end loop;
    if na > 0 and nb > 0 then
      cos := dot / (sqrt(na) * sqrt(nb));
      -- 0.55 -> 0, 1.0 -> 1; clamps the all-positive cosine into a real range.
      pers_sim := greatest(0, least(1, (cos - 0.55) / 0.45));
      pers_w := 0.40;
    end if;
  end if;

  -- ----- Activity: priority-weighted over its sub-signals --------------------
  if coalesce(array_length(ra.activities,1),0) > 0 and coalesce(array_length(rb.activities,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activities) t where t = any(rb.activities);
    select cardinality(array(select distinct unnest(ra.activities || rb.activities))) into a_uni;
    pwi := case when 'interests' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activity_vibe) t where t = any(rb.activity_vibe);
    select cardinality(array(select distinct unnest(ra.activity_vibe || rb.activity_vibe))) into a_uni;
    pwi := case when 'vibe' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if ra.activity_social is not null and rb.activity_social is not null then
    pwi := case when 'social' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_social - rb.activity_social)/4.0); pw := pw + pwi;
  end if;
  if ra.activity_intensity is not null and rb.activity_intensity is not null then
    pwi := case when 'intensity' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_intensity - rb.activity_intensity)/4.0); pw := pw + pwi;
  end if;
  if pw > 0 then
    act_sim := parts / pw;
    act_w := 0.25;
  end if;

  -- ----- Weighted blend over the components both people have ------------------
  wsum := pers_w + trip_w + act_w;
  if wsum = 0 then return 50; end if; -- no shared data — neutral
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

-- ── 4. Trip candidate deck: priority-weighted per-dimension score + filter ───
drop function if exists public.buddy_candidates_trip(int);
drop function if exists public.buddy_candidates_trip(int, text);
drop function if exists public.buddy_candidates_trip(int, text, uuid);
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
    -- Priority-weighted average of the per-dimension similarities. Each weight
    -- is 2 when the viewer flagged that dimension as a priority, else 1. Inline
    -- arithmetic (not a VALUES list) so the me_t/ct/cp correlation is plain and
    -- portable. Denominator is the sum of the 7 weights, always >= 7.
    ( 100 * (
        score_w.w_interests * sim.s_interests
      + score_w.w_pace      * sim.s_pace
      + score_w.w_budget    * sim.s_budget
      + score_w.w_planning  * sim.s_planning
      + score_w.w_social    * sim.s_social
      + score_w.w_night     * sim.s_night
      + score_w.w_adv       * sim.s_adv
      ) / (
        score_w.w_interests + score_w.w_pace + score_w.w_budget + score_w.w_planning
      + score_w.w_social + score_w.w_night + score_w.w_adv
      ) )::float8 as score
  from public.trips ct
  join public.profiles cp on cp.id = ct.user_id
  cross join me_t cross join me_p
  -- per-dimension similarities (0..1)
  cross join lateral (
    select
      ( case when cardinality(coalesce(me_t.trip_type,'{}'))=0 and cardinality(coalesce(ct.trip_type,'{}'))=0 then 0.5
             else (select count(*)::float from unnest(coalesce(ct.trip_type,'{}')) x where x = any(coalesce(me_t.trip_type,'{}')))
                  / greatest(cardinality(coalesce(me_t.trip_type,'{}')) + cardinality(coalesce(ct.trip_type,'{}'))
                    - (select count(*)::float from unnest(coalesce(ct.trip_type,'{}')) x where x = any(coalesce(me_t.trip_type,'{}'))), 1) end ) as s_interests,
      ( 1 - abs(coalesce(ct.pace, cp.pace, 3) - coalesce(me_t.pace, me_p.pace, 3))::float / 4 ) as s_pace,
      ( 1 - abs(coalesce(ct.budget, cp.budget, 3) - coalesce(me_t.budget, me_p.budget, 3))::float / 4 ) as s_budget,
      ( case when cp.planning is null or me_p.planning is null then 0.5 else 1 - abs(cp.planning - me_p.planning)::float / 4 end ) as s_planning,
      ( case when cp.social_energy is null or me_p.social_energy is null then 0.5 else 1 - abs(cp.social_energy - me_p.social_energy)::float / 4 end ) as s_social,
      ( case when cp.nightlife is null or me_p.nightlife is null then 0.5 else 1 - abs(cp.nightlife - me_p.nightlife)::float / 4 end ) as s_night,
      ( case when cp.adventurousness is null or me_p.adventurousness is null then 0.5 else 1 - abs(cp.adventurousness - me_p.adventurousness)::float / 4 end ) as s_adv
  ) sim
  -- viewer's priority weights (2 = flagged as "matters most", else 1)
  cross join lateral (
    select
      case when 'interests'     = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_interests,
      case when 'pace'          = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_pace,
      case when 'budget'        = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_budget,
      case when 'planning'      = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_planning,
      case when 'social_energy' = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_social,
      case when 'nightlife'     = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_night,
      case when 'adventurousness' = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_adv
  ) score_w
  where ct.user_id <> auth.uid()
    and ct.status = 'active'
    and ct.kind = me_t.kind
    and coalesce(ct.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    and exists (select 1 from unnest(coalesce(ct.destinations,'{}')) a
                join unnest(coalesce(me_t.destinations,'{}')) b on lower(a)=lower(b))
    and (greatest(ct.start_date, me_t.start_date) - least(ct.end_date, me_t.end_date)) <= 30
    and cp.onboarding_complete
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int, text, uuid) to authenticated;

-- ── 5. Activity discovery deck: add the same hard filter ─────────────────────
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
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id = auth.uid() and s.target_id = cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.activity_candidates(uuid, int) to authenticated;

-- ── 6. Recompute persisted pair scores with the new formula ──────────────────
update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);


-- ============================================================
-- vibe-traits.sql
-- ============================================================
-- New screenshot-derived traits + their matching terms. Run in the Supabase SQL
-- editor after match-priorities.sql. Safe to re-run.
--
-- Adds three columns and folds them into the activity side of the pair score:
--   social_style        1..5   "walking into a room of strangers" (extroversion)
--   activity_motivation text    why you go out: people | activity | company
--   initiator           text    starts | joins the plan (matched complementarily)

alter table public.profiles
  add column if not exists social_style int check (social_style between 1 and 5),
  add column if not exists activity_motivation text check (activity_motivation in ('people','activity','company')),
  add column if not exists initiator text check (initiator in ('starter','joiner'));

-- Re-create the weighted pair score with the three new activity signals added.
-- (Same body as match-priorities.sql, plus the social_style / motivation /
-- initiator terms in the activity block.)
create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  prio text[];
  aprio text[];
  s numeric := 0; w numeric := 0; ww numeric; inter int; uni int; tagj numeric;
  slider numeric; tag_w numeric; trip_sim numeric; trip_w numeric := 0;
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
  cos numeric; pers_sim numeric; pers_w numeric := 0;
  a_inter int; a_uni int; parts numeric := 0; pw numeric := 0; pwi numeric;
  act_sim numeric; act_w numeric := 0;
  total numeric; wsum numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;
  prio  := coalesce(ra.match_priorities, '{}');
  aprio := coalesce(ra.activity_priorities, '{}');

  -- ----- Trip vibe: priority-weighted sliders (60%) + trip_vibe Jaccard (40%) -
  if ra.planning is not null and rb.planning is not null then
    ww := case when 'planning' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.planning - rb.planning)/4.0); w := w + ww; end if;
  if ra.pace is not null and rb.pace is not null then
    ww := case when 'pace' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.pace - rb.pace)/4.0); w := w + ww; end if;
  if ra.social_energy is not null and rb.social_energy is not null then
    ww := case when 'social_energy' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.social_energy - rb.social_energy)/4.0); w := w + ww; end if;
  if ra.budget is not null and rb.budget is not null then
    ww := case when 'budget' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.budget - rb.budget)/4.0); w := w + ww; end if;
  if ra.nightlife is not null and rb.nightlife is not null then
    ww := case when 'nightlife' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.nightlife - rb.nightlife)/4.0); w := w + ww; end if;
  if ra.adventurousness is not null and rb.adventurousness is not null then
    ww := case when 'adventurousness' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.adventurousness - rb.adventurousness)/4.0); w := w + ww; end if;

  select count(*) into inter from unnest(coalesce(ra.trip_vibe,'{}')) t where t = any(coalesce(rb.trip_vibe,'{}'));
  select cardinality(array(select distinct unnest(coalesce(ra.trip_vibe,'{}') || coalesce(rb.trip_vibe,'{}')))) into uni;

  if w > 0 then
    slider := s / w;
    tagj := case when uni > 0 then inter::numeric / uni else 0.5 end;
    tag_w := case when 'interests' = any(prio) then 0.5 else 0.4 end;
    trip_sim := (1 - tag_w) * slider + tag_w * tagj;
    trip_w := 0.35;
  elsif uni > 0 then
    trip_sim := inter::numeric / uni;
    trip_w := 0.35;
  end if;

  -- ----- Personality: 6-dim cosine, rescaled -----
  if ra.vibe_scores is not null and rb.vibe_scores is not null then
    foreach d in array dims loop
      av := coalesce((ra.vibe_scores ->> d)::float, 0);
      bv := coalesce((rb.vibe_scores ->> d)::float, 0);
      dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
    end loop;
    if na > 0 and nb > 0 then
      cos := dot / (sqrt(na) * sqrt(nb));
      pers_sim := greatest(0, least(1, (cos - 0.55) / 0.45));
      pers_w := 0.40;
    end if;
  end if;

  -- ----- Activity: interests + vibe + social + intensity + new traits --------
  if coalesce(array_length(ra.activities,1),0) > 0 and coalesce(array_length(rb.activities,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activities) t where t = any(rb.activities);
    select cardinality(array(select distinct unnest(ra.activities || rb.activities))) into a_uni;
    pwi := case when 'interests' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activity_vibe) t where t = any(rb.activity_vibe);
    select cardinality(array(select distinct unnest(ra.activity_vibe || rb.activity_vibe))) into a_uni;
    pwi := case when 'vibe' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if ra.activity_social is not null and rb.activity_social is not null then
    pwi := case when 'social' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_social - rb.activity_social)/4.0); pw := pw + pwi;
  end if;
  if ra.activity_intensity is not null and rb.activity_intensity is not null then
    pwi := case when 'intensity' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_intensity - rb.activity_intensity)/4.0); pw := pw + pwi;
  end if;
  -- room-of-strangers extroversion: closer = better
  if ra.social_style is not null and rb.social_style is not null then
    parts := parts + (1 - abs(ra.social_style - rb.social_style)/4.0); pw := pw + 1;
  end if;
  -- motivation: same reason for going out scores best
  if ra.activity_motivation is not null and rb.activity_motivation is not null then
    parts := parts + (case when ra.activity_motivation = rb.activity_motivation then 1 else 0.5 end); pw := pw + 1;
  end if;
  -- initiator: a starter pairs best with a joiner (complementary)
  if ra.initiator is not null and rb.initiator is not null then
    parts := parts + (case when ra.initiator <> rb.initiator then 1.0
                           when ra.initiator = 'joiner' then 0.8 else 0.6 end); pw := pw + 1;
  end if;
  if pw > 0 then
    act_sim := parts / pw;
    act_w := 0.25;
  end if;

  wsum := pers_w + trip_w + act_w;
  if wsum = 0 then return 50; end if;
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);
