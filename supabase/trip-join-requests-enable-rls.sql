-- P0 FIX - Supabase Security Advisor: rls_disabled_in_public on
-- public.trip_join_requests (flagged 2026-07-06).
--
-- Root cause: the table has a correctly-scoped SELECT policy (see
-- trip-requests-rls-enforce.sql) but RLS was never ENABLED on it. In Postgres,
-- a policy is inert until RLS is enabled, so the table has been readable/
-- writable by anyone with the anon key. This script is self-contained and
-- idempotent: it (1) recreates the helper functions, (2) recreates the scoped
-- SELECT policy, then (3) enables RLS. Run the whole file in the Supabase SQL
-- editor. Safe to re-run.
--
-- Writes (request/approve/decline) go through SECURITY DEFINER RPCs that run as
-- the table owner and bypass RLS, so no write policy is needed and no flow
-- breaks. Use ENABLE, not FORCE - FORCE would apply RLS to those definer
-- functions too and break them.

-- 1. Helpers (from trip-requests-rls-prepare.sql) --------------------------------

-- Definer count RPC for the public flocks browse: accepted members per trip,
-- without exposing individual request rows.
create or replace function public.flock_going_counts(p_trip_ids uuid[])
returns table (trip_id uuid, accepted int)
language sql security definer set search_path = public stable as $$
  select r.trip_id, count(*)::int as accepted
  from public.trip_join_requests r
  where r.trip_id = any(p_trip_ids)
    and r.status = 'accepted'
  group by r.trip_id;
$$;
grant execute on function public.flock_going_counts(uuid[]) to authenticated;

-- Membership check used by the SELECT policy. security definer so its internal
-- trip_join_requests read does not recurse through the policy.
create or replace function public.can_see_trip_requests(p_trip uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip
      and (t.user_id = auth.uid() or t.co_host_id = auth.uid())
  ) or exists (
    select 1 from public.trip_join_requests r
    where r.trip_id = p_trip
      and r.user_id = auth.uid()
      and r.status = 'accepted'
  );
$$;
grant execute on function public.can_see_trip_requests(uuid) to authenticated;

-- 2. Scoped SELECT policy (from trip-requests-rls-enforce.sql) -------------------
-- A user can read a join-request row only if they are the requester, the trip
-- host/co-host, or an accepted member of that trip.
drop policy if exists "join requests readable" on public.trip_join_requests;
create policy "join requests readable" on public.trip_join_requests for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_see_trip_requests(trip_id)
  );

-- 3. THE MISSING PIECE - actually enable RLS ------------------------------------
alter table public.trip_join_requests enable row level security;

-- Verify (optional): should return rowsecurity = true.
-- select relname, relrowsecurity from pg_class where relname = 'trip_join_requests';
