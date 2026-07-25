-- ============================================================================
-- Flockie — Activity Board v2: per-activity join requests with HOST APPROVAL.
-- Run the WHOLE file in the Supabase SQL editor. Idempotent / safe to re-run.
--
-- Model (founder spec):
--   · Several people can tap "I'm in" on one activity.
--   · The card stays on the board + Home carousel for everyone until the HOST
--     accepts someone (then it's filled and disappears for all).
--   · Requesters keep seeing the card with a "Requested" state.
--   · The host accepts/declines each request; accept = match + chat + the
--     activity as an ACCEPTED plan.
-- ============================================================================

create table if not exists public.activity_join_requests (
  activity_id uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  level       text,
  note        text,
  created_at  timestamptz default now(),
  primary key (activity_id, user_id)
);
alter table public.trips add column if not exists location_name text;
alter table public.activity_join_requests add column if not exists status text not null default 'pending';
alter table public.activity_join_requests add column if not exists level text;
alter table public.activity_join_requests add column if not exists note text;

alter table public.activity_join_requests enable row level security;
drop policy if exists "own join requests" on public.activity_join_requests;
create policy "own join requests" on public.activity_join_requests
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "creator sees requests" on public.activity_join_requests;
create policy "creator sees requests" on public.activity_join_requests
  for select to authenticated using (
    exists (select 1 from public.trips t where t.id = activity_id and t.user_id = auth.uid())
  );

-- ── Feed ─────────────────────────────────────────────────────────────────────
-- Visible until FILLED (host accepted someone). Requesters get their own
-- status back so the UI shows "Requested" instead of the join button.
drop function if exists public.activity_feed(int);
create or replace function public.activity_feed(p_limit int default 30)
returns table (
  activity_id uuid, title text, start_date date, end_date date, city text,
  cover_photo text, description text, location_name text,
  creator_id uuid, display_name text, age int, photo text, one_liner text,
  score float8,
  my_request_status text
)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid())
  select
    t.id, t.title, t.start_date, t.end_date, t.destination,
    t.cover_photo, t.description, t.location_name,
    p.id, p.display_name, p.age, p.photos[1], p.activity_one_liner,
    public.buddy_pair_score(auth.uid(), p.id)::float8,
    (select r.status from public.activity_join_requests r
      where r.activity_id = t.id and r.user_id = auth.uid())
  from public.trips t
  join public.profiles p on p.id = t.user_id
  cross join me
  where t.kind = 'activity'
    and t.status = 'active'
    and coalesce(t.visibility, 'private') <> 'public'
    and t.end_date >= current_date
    and t.user_id <> auth.uid()
    and p.onboarding_complete
    and lower(coalesce(t.destination, '')) = lower(coalesce(me.home_city, ''))
    and not public.buddy_hard_block(auth.uid(), p.id)
    -- Score floor disabled pre-scale (founder call 2026-07-25): re-enable
    -- `and public.buddy_pair_score(auth.uid(), p.id) >= 40` at 100+ users.
    -- filled activities (host accepted someone) drop off for everyone
    and not exists (
      select 1 from public.activity_join_requests f
      where f.activity_id = t.id and f.status = 'accepted'
    )
    -- and ones where the host declined ME stay hidden for me
    and not exists (
      select 1 from public.activity_join_requests d
      where d.activity_id = t.id and d.user_id = auth.uid() and d.status = 'declined'
    )
  order by 12 desc, t.start_date asc
  limit p_limit;
$$;
grant execute on function public.activity_feed(int) to authenticated;

-- ── "I'm in" ─────────────────────────────────────────────────────────────────
-- Records the request (with level + note for the host) and notifies the host.
-- No auto-match: the HOST decides via respond_activity_request.
create or replace function public.request_join_activity(
  p_activity uuid, p_level text default null, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record; me record;
  v_score int; v_ctx text; v_new boolean;
begin
  select tr.*, tr.user_id as creator_id into t
  from public.trips tr
  where tr.id = p_activity and tr.kind = 'activity' and tr.status = 'active';
  if not found then raise exception 'activity_not_found'; end if;
  if t.creator_id = auth.uid() then raise exception 'own_activity'; end if;

  if public.buddy_hard_block(auth.uid(), t.creator_id) then
    raise exception 'blocked_by_preferences';
  end if;

  insert into public.activity_join_requests (activity_id, user_id, level, note)
  values (p_activity, auth.uid(), nullif(btrim(coalesce(p_level, '')), ''), nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (activity_id, user_id) do nothing
  returning true into v_new;

  if v_new is null then
    -- already requested — nothing new to notify
    return jsonb_build_object('requested', true, 'duplicate', true);
  end if;

  select * into me from public.profiles where id = auth.uid();
  v_score := round(public.buddy_pair_score(auth.uid(), t.creator_id));
  -- Separator built with chr(183) ('middle dot') so a copy/paste encoding
  -- mishap in the SQL editor can never mangle it into mojibake.
  v_ctx := concat_ws(' ' || chr(183) || ' ',
    nullif(concat_ws(', ',
      coalesce(me.display_name, 'Someone'),
      nullif(me.age::text, ''),
      nullif(me.gender, '')
    ), ''),
    case when p_level is not null and btrim(p_level) <> '' then 'Level: ' || btrim(p_level) end,
    v_score || '% match'
  );

  perform public.notify(
    t.creator_id, 'activity_like',
    coalesce(me.display_name, 'Someone') || ' wants to join "' || coalesce(t.title, 'your activity') || '"',
    v_ctx
      || case when p_note is not null and btrim(p_note) <> ''
           then e'\n"' || left(btrim(p_note), 200) || '"' else '' end
      || e'\nReview it under My Plans - Activities.',
    jsonb_build_object('like_from', auth.uid(), 'activity_id', t.id, 'href', '/my-activities')
  );

  return jsonb_build_object('requested', true);
end $$;
grant execute on function public.request_join_activity(uuid, text, text) to authenticated;

-- ── Host decision ────────────────────────────────────────────────────────────
-- Accept: match + chat with the requester, the activity lands as an ACCEPTED
-- plan in that chat, requester is notified. Decline: request marked declined
-- (silent). Other pending requests stay for the host to manage.
create or replace function public.respond_activity_request(
  p_activity uuid, p_user uuid, p_accept boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_a uuid; v_b uuid; v_match uuid; v_chat uuid; v_score numeric;
begin
  select tr.*, tr.user_id as creator_id into t
  from public.trips tr where tr.id = p_activity and tr.kind = 'activity';
  if not found or t.creator_id <> auth.uid() then raise exception 'not_allowed'; end if;

  update public.activity_join_requests
    set status = case when p_accept then 'accepted' else 'declined' end
    where activity_id = p_activity and user_id = p_user and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;

  -- The request is handled — clear its notification off Home/inbox unread.
  update public.notifications
     set read_at = coalesce(read_at, now())
   where user_id = auth.uid()
     and type = 'activity_like'
     and data->>'activity_id' = p_activity::text
     and data->>'like_from' = p_user::text;

  if not p_accept then
    return jsonb_build_object('declined', true);
  end if;

  -- Match + chat (reuse existing pair if they already matched before).
  v_a := least(auth.uid(), p_user);
  v_b := greatest(auth.uid(), p_user);
  v_score := public.buddy_pair_score(v_a, v_b);
  insert into public.buddy_matches (user_a, user_b, score)
  values (v_a, v_b, v_score)
  on conflict (user_a, user_b) do update set
    score = coalesce(public.buddy_matches.score, excluded.score);
  select id into v_match from public.buddy_matches where user_a = v_a and user_b = v_b;
  insert into public.buddy_chats (match_id) values (v_match)
    on conflict (match_id) do nothing;
  select id into v_chat from public.buddy_chats where match_id = v_match;

  -- The activity becomes the agreed plan: both sides said yes, so it lands
  -- ACCEPTED (any still-open proposal in the chat is superseded).
  update public.buddy_plans set status = 'declined'
    where chat_id = v_chat and status = 'proposed';
  insert into public.buddy_plans (chat_id, proposed_by, category, place_name, when_at, status)
    values (v_chat, p_user, 'activity', coalesce(nullif(btrim(t.location_name), ''), nullif(btrim(t.title), '')), null, 'accepted');
  insert into public.buddy_messages (chat_id, sender_id, content)
    values (v_chat, null, '✅ accepted the plan');

  perform public.notify(
    p_user, 'buddy_match', 'You''re in! 🎉',
    'Your request to join "' || coalesce(t.title, 'the activity') || '" was accepted. Say hi and sort the details.',
    jsonb_build_object('chat_id', v_chat, 'activity_id', t.id)
  );

  -- 1:1 activity is now filled: decline the other pending requests, but softly —
  -- tell each the spot filled and nudge them to invite the host to something
  -- else (link to the host's profile Say-hi).
  declare r_other record;
  begin
    for r_other in
      select user_id from public.activity_join_requests
      where activity_id = p_activity and status = 'pending' and user_id <> p_user
    loop
      update public.activity_join_requests set status = 'declined'
        where activity_id = p_activity and user_id = r_other.user_id;
      perform public.notify(
        r_other.user_id, 'activity_like',
        'The "' || coalesce(t.title, 'activity') || '" spot was filled',
        'Someone else joined this one — but the host is around. Invite them to something else!',
        jsonb_build_object('like_from', auth.uid(), 'href', '/people/' || auth.uid())
      );
    end loop;
  end;

  return jsonb_build_object('accepted', true, 'chat_id', v_chat);
end $$;
grant execute on function public.respond_activity_request(uuid, uuid, boolean) to authenticated;

-- ── Requests on MY activities (host view for My Plans) ──────────────────────
create or replace function public.activity_requests_for_mine()
returns table (
  activity_id uuid, requester_id uuid, display_name text, age int, photo text,
  level text, note text, status text, score float8, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select r.activity_id, r.user_id, p.display_name, p.age, p.photos[1],
         r.level, r.note, r.status,
         public.buddy_pair_score(auth.uid(), r.user_id)::float8,
         r.created_at
  from public.activity_join_requests r
  join public.trips t on t.id = r.activity_id and t.user_id = auth.uid()
  join public.profiles p on p.id = r.user_id
  where r.status <> 'declined'
  order by r.created_at desc;
$$;
grant execute on function public.activity_requests_for_mine() to authenticated;

-- ── Activities I requested/joined (requester view for My Plans) ─────────────
create or replace function public.my_joined_activities()
returns table (
  activity_id uuid, title text, start_date date,
  creator_id uuid, creator_name text, creator_photo text,
  chat_id uuid, request_status text
)
language sql security definer set search_path = public stable as $$
  select
    t.id, t.title, t.start_date,
    p.id, p.display_name, p.photos[1],
    c.id,
    r.status
  from public.activity_join_requests r
  join public.trips t on t.id = r.activity_id
  join public.profiles p on p.id = t.user_id
  left join public.buddy_matches m
    on m.user_a = least(r.user_id, t.user_id)
   and m.user_b = greatest(r.user_id, t.user_id)
  left join public.buddy_chats c on c.match_id = m.id
  where r.user_id = auth.uid()
    and r.status <> 'declined'
  order by r.created_at desc
  limit 20;
$$;
grant execute on function public.my_joined_activities() to authenticated;
