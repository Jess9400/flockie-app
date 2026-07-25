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

-- 5) Scheduled meetings for the club Calendar — the club's own gatherings are
--    vibes with club_id set (heartbeat schedules them). Upcoming first, then
--    past. Members only.
create or replace function public.club_gatherings(p_club uuid)
returns table (id uuid, title text, starts_at timestamptz, timezone text, status text, city text)
language sql security definer set search_path = public stable as $$
  select v.id, v.title, v.starts_at, v.timezone, v.status, v.city
  from public.vibes v
  where v.club_id = p_club
    and v.status <> 'cancelled'
    and public.is_club_member(p_club)
  order by
    case when v.starts_at >= now() then 0 else 1 end,
    case when v.starts_at >= now() then v.starts_at end asc,
    v.starts_at desc;
$$;
grant execute on function public.club_gatherings(uuid) to authenticated;

-- 6) Gathering RSVPs — each club member checks whether they'll attend a
--    scheduled meetup (personal, self-only; everyone sees who's going).
create table if not exists public.club_gathering_rsvps (
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  going boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (vibe_id, user_id)
);
alter table public.club_gathering_rsvps enable row level security;

-- Any member of the gathering's club can read all RSVPs; you write only your own.
drop policy if exists "rsvp read" on public.club_gathering_rsvps;
create policy "rsvp read" on public.club_gathering_rsvps for select to authenticated
  using (exists (select 1 from public.vibes v
                 where v.id = vibe_id and v.club_id is not null and public.is_club_member(v.club_id)));
drop policy if exists "rsvp insert" on public.club_gathering_rsvps;
create policy "rsvp insert" on public.club_gathering_rsvps for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.vibes v
                          where v.id = vibe_id and v.club_id is not null and public.is_club_member(v.club_id)));
drop policy if exists "rsvp update" on public.club_gathering_rsvps;
create policy "rsvp update" on public.club_gathering_rsvps for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "rsvp delete" on public.club_gathering_rsvps;
create policy "rsvp delete" on public.club_gathering_rsvps for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
