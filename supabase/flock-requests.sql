-- Flock join approvals: host accepts/declines requests; "going" = host + accepted.
-- Run the whole file in the Supabase SQL editor. Safe to re-run.

-- Base table. Columns are exact (captured from prod 2026-06-29); the PK/FKs are
-- the natural reconstruction so a fresh DB is reproducible. `create ... if not
-- exists` is a no-op on prod (the table already exists there).
create table if not exists public.trip_join_requests (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  created_at timestamptz default now(),
  status     text not null default 'pending',
  approvals  uuid[] not null default '{}',
  primary key (trip_id, user_id)
);

alter table public.trip_join_requests
  add column if not exists status text not null default 'pending';

-- A user requests to join a public Flock → creates a request (status defaults to
-- 'pending') and notifies the host. Captured verbatim from prod 2026-06-29 — this
-- was previously DB-only / missing from the repo.
create or replace function public.request_join_trip(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
  declare v public.trips;
  begin
    select * into v from public.trips where id = p_trip;
    if v.id is null or v.visibility <> 'public' then raise exception 'not joinable'; end if;
    if v.user_id = auth.uid() then raise exception 'own trip'; end if;
    insert into public.trip_join_requests (trip_id, user_id) values (p_trip, auth.uid())
      on conflict do nothing;
    perform public.notify(v.user_id, 'trip_join_request', 'Someone wants to join your trip',
      'A flockie requested to join your ' || v.destination || ' trip.',
      jsonb_build_object('trip_id', p_trip));
  end $$;
grant execute on function public.request_join_trip(uuid) to authenticated;

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

-- join requests SELECT policy: SUPERSEDED — do not recreate here.
-- The live, scoped policy is in supabase/trip-requests-rls-enforce.sql (#90 —
-- requester / trip host / co-host / accepted member, via can_see_trip_requests).
-- The old `using (true)` version (any authed user reads every join request) was
-- removed 2026-06-28 so re-running this file can't re-open the table.
