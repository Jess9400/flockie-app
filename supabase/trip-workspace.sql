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
