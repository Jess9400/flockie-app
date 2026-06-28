-- P0 fix (phase 2 of 2): tighten trip_join_requests SELECT.
-- Run in the Supabase SQL editor AFTER the flocks-page change is deployed.
-- Safe to re-run. Refuses to run unless phase 1 (the count RPC) exists.
--
-- After this, a user can read a join-request row only if they are the requester,
-- the trip host/co-host, or an accepted member of that trip. The flocks browse
-- "going" count comes from flock_going_counts; "did I request" reads own rows.

do $$
begin
  if to_regprocedure('public.flock_going_counts(uuid[])') is null then
    raise exception 'Run trip-requests-rls-prepare.sql before enforcing.';
  end if;
end;
$$;

drop policy if exists "join requests readable" on public.trip_join_requests;
create policy "join requests readable" on public.trip_join_requests for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_see_trip_requests(trip_id)
  );
