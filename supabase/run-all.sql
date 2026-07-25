-- ============================================================================
-- Flockie - RUN-ALL bundle. Every block is idempotent, so running this whole
-- file (or re-running it) is safe. Order matters: workspace tables exist
-- before clubs extend them. Paste the entire file into the Supabase SQL
-- editor and Run once.
-- ============================================================================


-- ============================================================================
-- [1/6] trip-workspace.sql
--      Trip/flock workspace: members, checklist, agenda, expenses, balances
-- ============================================================================
-- ============================================================================
-- Flockie - Trip detail + Trip Workspace (checklist, agenda, expenses ledger).
-- Shared by 1:1 trips and flocks. Run in the SQL editor. Idempotent.
-- Member = the trip host OR anyone with an accepted trip_join_request.
-- ============================================================================

-- ── Membership helper ───────────────────────────────────────────────────────
create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.trips t where t.id = p_trip and t.user_id = auth.uid())
      or exists (
        select 1 from public.trip_join_requests r
        where r.trip_id = p_trip and r.user_id = auth.uid() and r.status = 'accepted'
      );
$$;
grant execute on function public.is_trip_member(uuid) to authenticated;

-- ── Detail for a single 1:1 trip (private trips aren't RLS-readable) ─────────
create or replace function public.trip_detail(p_trip uuid)
returns table (
  id uuid, kind text, destination text, destinations text[],
  start_date date, end_date date, group_size int, trip_type text[],
  budget int, pace int, description text, cover_photo text, language text,
  creator_id uuid, creator_name text, creator_age int, creator_photo text,
  creator_one_liner text, creator_countries int, creator_languages text[],
  going int, is_host boolean, my_request_status text
)
language sql security definer set search_path = public stable as $$
  select
    t.id,
    case when t.visibility = 'public' then 'flock' else 'trip' end,
    t.destination, t.destinations, t.start_date, t.end_date, t.group_size,
    t.trip_type, t.budget, t.pace, t.description, t.cover_photo, t.language,
    p.id, p.display_name, p.age, p.photos[1], p.one_liner,
    p.countries_visited, coalesce(p.languages_spoken, '{}'),
    (1 + (select count(*)::int from public.trip_join_requests r
           where r.trip_id = t.id and r.status = 'accepted')),
    t.user_id = auth.uid(),
    (select r.status from public.trip_join_requests r
      where r.trip_id = t.id and r.user_id = auth.uid())
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.id = p_trip and t.kind = 'trip' and t.status <> 'cancelled';
$$;
grant execute on function public.trip_detail(uuid) to authenticated;

-- ── Roster: everyone going (host + accepted). Visible to members only ───────
create or replace function public.trip_members(p_trip uuid)
returns table (id uuid, display_name text, photo text, age int, one_liner text, is_host boolean)
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos[1], p.age, p.one_liner,
         (t.user_id = p.id) as is_host
  from public.trips t
  join public.profiles p
    on p.id = t.user_id
    or p.id in (select r.user_id from public.trip_join_requests r
                where r.trip_id = t.id and r.status = 'accepted')
  where t.id = p_trip
    and (public.is_trip_member(p_trip))
  order by (t.user_id = p.id) desc, p.display_name;
$$;
grant execute on function public.trip_members(uuid) to authenticated;

-- ============================================================================
-- WORKSPACE TABLES — one per trip, member-gated. All keyed on trip_id.
-- ============================================================================

-- Checklist (to-dos, optionally assigned) --------------------------------------
create table if not exists public.trip_checklist (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  assignee uuid references public.profiles(id) on delete set null,
  done boolean not null default false,
  done_by uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.trip_checklist add column if not exists done_by uuid[] not null default '{}';
create index if not exists trip_checklist_trip_idx on public.trip_checklist (trip_id, created_at);

-- Agenda (day-by-day schedule) -------------------------------------------------
create table if not exists public.trip_agenda (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date,
  title text not null check (char_length(title) between 1 and 200),
  note text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists trip_agenda_trip_idx on public.trip_agenda (trip_id, day, created_at);

-- Expenses ledger (WHO PAID WHAT — no payments, settle outside the app) --------
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (char_length(currency) between 1 and 8),
  split_with uuid[] not null default '{}',  -- who shares it (incl. payer); empty = everyone
  created_at timestamptz default now()
);
create index if not exists trip_expenses_trip_idx on public.trip_expenses (trip_id, created_at);

alter table public.trip_checklist enable row level security;
alter table public.trip_agenda enable row level security;
alter table public.trip_expenses enable row level security;

-- Members read + write their trip's workspace; delete own rows.
do $$
declare tbl text;
begin
  foreach tbl in array array['trip_checklist','trip_agenda','trip_expenses'] loop
    execute format('drop policy if exists "ws read" on public.%I', tbl);
    execute format('create policy "ws read" on public.%I for select to authenticated using (public.is_trip_member(trip_id))', tbl);
    execute format('drop policy if exists "ws insert" on public.%I', tbl);
    execute format('create policy "ws insert" on public.%I for insert to authenticated with check (public.is_trip_member(trip_id))', tbl);
    execute format('drop policy if exists "ws update" on public.%I', tbl);
    execute format('create policy "ws update" on public.%I for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id))', tbl);
  end loop;
end $$;

-- Deletes: checklist/agenda by member; expenses only by the payer.
drop policy if exists "ws delete" on public.trip_checklist;
create policy "ws delete" on public.trip_checklist for delete to authenticated using (public.is_trip_member(trip_id));
drop policy if exists "ws delete" on public.trip_agenda;
create policy "ws delete" on public.trip_agenda for delete to authenticated using (public.is_trip_member(trip_id));
drop policy if exists "ws delete" on public.trip_expenses;
create policy "ws delete" on public.trip_expenses for delete to authenticated using (payer_id = auth.uid());

-- Balances: net per member (paid - owed). No settlement, just the ledger math.
create or replace function public.trip_balances(p_trip uuid)
returns table (user_id uuid, display_name text, photo text, paid numeric, owed numeric, net numeric)
language sql security definer set search_path = public stable as $$
  with mem as (
    select m.id, m.display_name, m.photo from public.trip_members(p_trip) m
  ),
  exp as (
    select e.payer_id, e.amount,
           case when coalesce(array_length(e.split_with,1),0) = 0
                then (select array_agg(id) from mem)
                else e.split_with end as sharers
    from public.trip_expenses e where e.trip_id = p_trip
  ),
  paid as (
    select payer_id as uid, sum(amount) as paid from exp group by payer_id
  ),
  owed as (
    select s as uid, sum(e.amount / nullif(array_length(e.sharers,1),0)) as owed
    from exp e, unnest(e.sharers) s group by s
  )
  select mem.id, mem.display_name, mem.photo,
         coalesce(paid.paid,0), coalesce(owed.owed,0),
         coalesce(paid.paid,0) - coalesce(owed.owed,0)
  from mem
  left join paid on paid.uid = mem.id
  left join owed on owed.uid = mem.id
  order by (coalesce(paid.paid,0) - coalesce(owed.owed,0)) desc;
$$;
grant execute on function public.trip_balances(uuid) to authenticated;

-- ── Public agenda preview: the itinerary shows on the trip/flock page so
-- browsers see what the trip is about. Read-only; writing stays member-gated.
create or replace function public.trip_agenda_preview(p_trip uuid)
returns table (id uuid, day date, title text, note text)
language sql security definer set search_path = public stable as $$
  select a.id, a.day, a.title, a.note
  from public.trip_agenda a
  join public.trips t on t.id = a.trip_id
  where a.trip_id = p_trip
    and t.status = 'active'
    -- visible for public flocks to anyone; private trips to members only
    and (t.visibility = 'public' or public.is_trip_member(p_trip))
  order by a.day asc nulls last, a.created_at;
$$;
grant execute on function public.trip_agenda_preview(uuid) to authenticated;


-- ============================================================================
-- [2/6] trip-board.sql
--      Trips & Flocks board + join requests + traveler cred columns
-- ============================================================================
-- ============================================================================
-- Flockie - the Trip Board: browse solo trips + flocks in one list, ask to
-- join with context. Mirrors the activity board. Run in the SQL editor.
-- Idempotent / safe to re-run.
-- ============================================================================

alter table public.trip_join_requests add column if not exists note text;
alter table public.profiles add column if not exists countries_visited int;
alter table public.profiles add column if not exists languages_spoken text[] not null default '{}';

drop function if exists public.trip_board(int);

-- One browsable list: other people's active solo trips (1:1) and public
-- flocks with room. Trip-first cards; the creator is context.
create or replace function public.trip_board(p_limit int default 60)
returns table (
  trip_id uuid, kind text, destination text, destinations text[],
  start_date date, end_date date, group_size int, trip_type text[],
  budget int, description text, cover_photo text, continent text,
  group_gender text, language text,
  creator_id uuid, creator_name text, creator_age int, creator_photo text,
  trips_taken int, countries_visited int, languages_spoken text[],
  going int, score float8, my_request_status text
)
language sql security definer set search_path = public stable as $$
  select
    t.id,
    case when t.visibility = 'public' then 'flock' else 'trip' end,
    t.destination, t.destinations, t.start_date, t.end_date, t.group_size,
    t.trip_type, t.budget, t.description, t.cover_photo, t.continent,
    t.group_gender, t.language,
    p.id, p.display_name, p.age, p.photos[1],
    (select count(*)::int from public.trips pt
      where pt.user_id = p.id and pt.end_date < current_date
        and pt.status <> 'cancelled') as trips_taken,
    p.countries_visited,
    coalesce(p.languages_spoken, '{}'),
    (1 + (select count(*)::int from public.trip_join_requests r
           where r.trip_id = t.id and r.status = 'accepted')) as going,
    public.buddy_pair_score(auth.uid(), p.id)::float8,
    (select r.status from public.trip_join_requests r
      where r.trip_id = t.id and r.user_id = auth.uid())
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.kind = 'trip'
    and t.status = 'active'
    and t.end_date >= current_date
    and t.user_id <> auth.uid()
    and p.onboarding_complete
    and not public.buddy_hard_block(auth.uid(), p.id)
    -- room left (host + accepted < capacity)
    and (1 + (select count(*) from public.trip_join_requests r2
              where r2.trip_id = t.id and r2.status = 'accepted'))
        < coalesce(t.group_size, 99)
  order by t.start_date asc
  limit p_limit;
$$;
grant execute on function public.trip_board(int) to authenticated;

-- Ask to join (both kinds) with a personal note + traveler context for the
-- host. Accept/decline stays on the existing respond_join_request flow, which
-- already seeds the right chat (1:1 for private trips, group for flocks).
create or replace function public.request_join_trip_v2(p_trip uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.trips; me public.profiles; v_score int; v_trips int; v_new boolean;
begin
  select * into v from public.trips where id = p_trip;
  if v.id is null or v.kind <> 'trip' or v.status <> 'active' then
    raise exception 'not joinable';
  end if;
  if v.user_id = auth.uid() then raise exception 'own trip'; end if;
  if public.buddy_hard_block(auth.uid(), v.user_id) then
    raise exception 'blocked_by_preferences';
  end if;

  insert into public.trip_join_requests (trip_id, user_id, note)
  values (p_trip, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (trip_id, user_id) do update
    set status = 'pending', approvals = '{}', created_at = now(),
        note = excluded.note
    where trip_join_requests.status = 'declined'
  returning true into v_new;

  if v_new is null then return; end if;

  select * into me from public.profiles where id = auth.uid();
  v_score := round(public.buddy_pair_score(auth.uid(), v.user_id));
  select count(*)::int into v_trips from public.trips pt
    where pt.user_id = auth.uid() and pt.end_date < current_date
      and pt.status <> 'cancelled';

  perform public.notify(
    v.user_id, 'trip_join_request',
    coalesce(me.display_name, 'Someone') || ' wants to join your '
      || coalesce(v.destination, 'trip') || ' trip',
    concat_ws(' - ',
      nullif(concat_ws(', ',
        coalesce(me.display_name, 'Someone'),
        nullif(me.age::text, ''),
        nullif(me.home_city, '')
      ), ''),
      case when me.countries_visited is not null and me.countries_visited > 0
           then me.countries_visited || ' countries visited'
           else v_trips || ' past trips' end,
      v_score || '% match')
      || case when p_note is not null and btrim(p_note) <> ''
           then e'\n"' || left(btrim(p_note), 280) || '"' else '' end,
    jsonb_build_object('trip_id', p_trip, 'href', '/my-trips')
  );
end $$;
grant execute on function public.request_join_trip_v2(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- [3/6] activity-join-requests.sql
--      Activity address + join requests + accept auto-declines the rest
-- ============================================================================
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


-- ============================================================================
-- [4/6] flock-chat-fix.sql
--      Backfill missing flock group chats + broaden my_flock_chats
-- ============================================================================
-- ============================================================================
-- Flockie - fix flock chats missing from the Chats list.
-- Two causes: (1) a flock with accepted members whose group chat was never
-- seeded (approved via the old path); (2) my_flock_chats excluded the host and
-- first member. Run in the SQL editor. Idempotent.
-- ============================================================================

-- 1) Backfill: every public trip with >=1 accepted member but no chat gets one,
--    seeded on the host + earliest accepted member (same shape respond_join
--    _request uses). Later members already reach it via my_flock_chats.
do $$
declare r record; v_a uuid; v_b uuid; v_match uuid;
begin
  for r in
    select t.id as trip_id, t.user_id as host_id,
           (select j.user_id from public.trip_join_requests j
             where j.trip_id = t.id and j.status = 'accepted'
             order by j.created_at asc limit 1) as first_member
    from public.trips t
    where t.visibility = 'public' and t.status = 'active'
      and exists (select 1 from public.trip_join_requests j
                  where j.trip_id = t.id and j.status = 'accepted')
      and not exists (
        select 1 from public.buddy_matches m
        join public.buddy_chats bc on bc.match_id = m.id
        where t.id in (m.trip_a, m.trip_b))
  loop
    if r.first_member is null then continue; end if;
    v_a := least(r.host_id, r.first_member);
    v_b := greatest(r.host_id, r.first_member);
    insert into public.buddy_matches (user_a, user_b, trip_a, score)
      values (v_a, v_b, r.trip_id, 100)
      on conflict (user_a, user_b) do update set trip_a = excluded.trip_a
      returning id into v_match;
    if v_match is null then
      select id into v_match from public.buddy_matches where user_a = v_a and user_b = v_b;
    end if;
    insert into public.buddy_chats (match_id) values (v_match)
      on conflict (match_id) do nothing;
  end loop;
end $$;

-- 2) my_flock_chats now covers the HOST and every accepted member of a public
--    trip that has a chat. Dedups against buddy_chat_summaries in the app layer
--    (chat-list-data appends a flock row only if the chat_id isn't already
--    present), so broadening here is safe and closes the gap.
create or replace function public.my_flock_chats()
returns table (chat_id uuid, name text, photo text)
language sql security definer set search_path = public stable as $$
  select bc.id,
         coalesce(t.destination, 'Flock') as name,
         coalesce(t.cover_photo, hp.photos[1]) as photo
  from public.trips t
  join public.buddy_matches m on (m.trip_a = t.id or m.trip_b = t.id)
  join public.buddy_chats bc on bc.match_id = m.id
  left join public.profiles hp on hp.id = t.user_id
  where t.visibility = 'public'
    and (
      t.user_id = auth.uid()
      or exists (select 1 from public.trip_join_requests j
                 where j.trip_id = t.id and j.user_id = auth.uid() and j.status = 'accepted')
    );
$$;
grant execute on function public.my_flock_chats() to authenticated;


-- ============================================================================
-- [5/6] flock-chat-cover.sql
--      Flock chat rows show the trip cover banner, not a member photo
-- ============================================================================
-- Flockie - flock chat rows use the trip cover banner, not a member photo.
-- Run in the SQL editor. Idempotent.

-- Flock chats show the trip cover, not a member's face (matches my_flock_chats).
create or replace function public.buddy_chat_summaries()
returns table(chat_id uuid, name text, photo text, last_at timestamptz, unread integer, kind text)
language sql stable security definer set search_path to 'public'
as $function$
  select bc.id,
    case when exists (select 1 from public.trips t
                      where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public')
         then coalesce((select t.destination from public.trips t
                        where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public' limit 1),
                       o.display_name)
         else o.display_name end as name,
    case when exists (select 1 from public.trips t
                      where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public')
         then coalesce((select t.cover_photo from public.trips t
                        where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public' limit 1),
                       (o.photos)[1])
         else (o.photos)[1] end as photo,
    coalesce(lm.last_at, bc.created_at) as last_at,
    coalesce((select count(*) from public.buddy_messages m
      where m.chat_id=bc.id and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select last_read_at from public.chat_reads r
              where r.user_id=auth.uid() and r.chat_id=bc.id),'epoch')),0)::int as unread,
    case
      when exists (select 1 from public.trips t
                   where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public') then 'flock'
      when exists (select 1 from public.trips t
                   where t.id in (mt.trip_a, mt.trip_b) and t.kind = 'activity') then 'activity_buddy'
      else 'travel_buddy'
    end as kind
  from public.buddy_chats bc
  join public.buddy_matches mt on mt.id = bc.match_id
  join public.profiles o on o.id = case when mt.user_a=auth.uid() then mt.user_b else mt.user_a end
  left join lateral (select max(created_at) last_at from public.buddy_messages m where m.chat_id=bc.id) lm on true
  where auth.uid() in (mt.user_a, mt.user_b)
  order by last_at desc;
$function$;


-- ============================================================================
-- [6/6] club-workspace.sql
--      Clubs reuse the workspace via club_id + club_balances/agenda preview
-- ============================================================================
-- ============================================================================
-- Flockie - Club Workspace. Clubs reuse the trip workspace tables (checklist,
-- agenda/schedule, expenses ledger) via a club_id column, so a club gets the
-- same planning HQ a flock/trip has. Run AFTER trip-workspace.sql. Idempotent.
-- Member = club host OR a founding/regular member (public.is_club_member).
-- ============================================================================

-- 1) Make the three workspace tables polymorphic: keyed by EITHER a trip or a
--    club. Existing rows all have trip_id, so the xor check is satisfied.
do $$
declare tbl text;
begin
  foreach tbl in array array['trip_checklist','trip_agenda','trip_expenses'] loop
    execute format('alter table public.%I add column if not exists club_id uuid references public.clubs(id) on delete cascade', tbl);
    execute format('alter table public.%I alter column trip_id drop not null', tbl);
    execute format('create index if not exists %I on public.%I (club_id, created_at)', tbl||'_club_idx', tbl);
    execute format('alter table public.%I drop constraint if exists %I', tbl, tbl||'_space_chk');
    execute format('alter table public.%I add constraint %I check (num_nonnulls(trip_id, club_id) = 1)', tbl, tbl||'_space_chk');
  end loop;
end $$;

-- 2) RLS: a row belongs to whoever is a member of its space (trip OR club).
do $$
declare tbl text;
begin
  foreach tbl in array array['trip_checklist','trip_agenda','trip_expenses'] loop
    execute format('drop policy if exists "ws read" on public.%I', tbl);
    execute format($f$create policy "ws read" on public.%I for select to authenticated
      using ((trip_id is not null and public.is_trip_member(trip_id))
          or (club_id is not null and public.is_club_member(club_id)))$f$, tbl);
    execute format('drop policy if exists "ws insert" on public.%I', tbl);
    execute format($f$create policy "ws insert" on public.%I for insert to authenticated
      with check ((trip_id is not null and public.is_trip_member(trip_id))
               or (club_id is not null and public.is_club_member(club_id)))$f$, tbl);
    execute format('drop policy if exists "ws update" on public.%I', tbl);
    execute format($f$create policy "ws update" on public.%I for update to authenticated
      using ((trip_id is not null and public.is_trip_member(trip_id))
          or (club_id is not null and public.is_club_member(club_id)))
      with check ((trip_id is not null and public.is_trip_member(trip_id))
               or (club_id is not null and public.is_club_member(club_id)))$f$, tbl);
  end loop;
end $$;

-- Deletes: checklist/agenda by any member of the space; expenses by the payer.
drop policy if exists "ws delete" on public.trip_checklist;
create policy "ws delete" on public.trip_checklist for delete to authenticated
  using ((trip_id is not null and public.is_trip_member(trip_id))
      or (club_id is not null and public.is_club_member(club_id)));
drop policy if exists "ws delete" on public.trip_agenda;
create policy "ws delete" on public.trip_agenda for delete to authenticated
  using ((trip_id is not null and public.is_trip_member(trip_id))
      or (club_id is not null and public.is_club_member(club_id)));
-- (trip_expenses "ws delete" stays payer-only from trip-workspace.sql.)

-- 3) Club balances — same net math as trip_balances, roster from club_members.
create or replace function public.club_balances(p_club uuid)
returns table (user_id uuid, display_name text, photo text, paid numeric, owed numeric, net numeric)
language sql security definer set search_path = public stable as $$
  with mem as (
    select m.id, m.display_name, m.photo from public.club_members(p_club) m
  ),
  exp as (
    select e.payer_id, e.amount,
           case when coalesce(array_length(e.split_with,1),0) = 0
                then (select array_agg(id) from mem)
                else e.split_with end as sharers
    from public.trip_expenses e where e.club_id = p_club
  ),
  paid as (
    select payer_id as uid, sum(amount) as paid from exp group by payer_id
  ),
  owed as (
    select s as uid, sum(e.amount / nullif(array_length(e.sharers,1),0)) as owed
    from exp e, unnest(e.sharers) s group by s
  )
  select mem.id, mem.display_name, mem.photo,
         coalesce(paid.paid,0), coalesce(owed.owed,0),
         coalesce(paid.paid,0) - coalesce(owed.owed,0)
  from mem
  left join paid on paid.uid = mem.id
  left join owed on owed.uid = mem.id
  order by (coalesce(paid.paid,0) - coalesce(owed.owed,0)) desc;
$$;
grant execute on function public.club_balances(uuid) to authenticated;

-- 4) Public schedule preview for the club detail page (members only — clubs are
--    invite/request based, so the agenda stays inside the membership).
create or replace function public.club_agenda_preview(p_club uuid)
returns table (id uuid, day date, title text, note text)
language sql security definer set search_path = public stable as $$
  select a.id, a.day, a.title, a.note
  from public.trip_agenda a
  where a.club_id = p_club
    and public.is_club_member(p_club)
  order by a.day asc nulls last, a.created_at;
$$;
grant execute on function public.club_agenda_preview(uuid) to authenticated;

notify pgrst, 'reload schema';

