-- P0 fix (phase 1 of 2): scope trip_join_requests reads. ADDITIVE — safe, and
-- changes no existing policy. Run in the Supabase SQL editor BEFORE merging the
-- flocks-page change. Phase 2 (trip-requests-rls-enforce.sql) tightens the policy
-- after deploy.
--
-- Why: the "join requests readable" SELECT policy is `using (true)`, so any
-- authenticated user can enumerate every join request app-wide (who requested
-- which trip and their status). These helpers let us tighten it without breaking
-- the flocks browse "going" count (which currently relies on the broad read).

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

-- Membership check used by the tightened SELECT policy. security definer so its
-- internal trip_join_requests read does not recurse through the policy.
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
