-- P0 fix: scope the trips SELECT policy (was `using (true)` — every authenticated
-- user could read every trip, including private personal trips/activities:
-- destinations, dates, budget, pace, group size). Run in the Supabase SQL editor.
-- Safe to run anytime: all of the app's trip reads are owner / public flock /
-- accepted member / buddy-matched, which this policy still allows — so it does not
-- break the deployed app and needs no two-phase rollout.

-- Membership/visibility check. security definer so its internal reads of trips /
-- trip_join_requests / buddy_matches do not recurse through their own RLS.
create or replace function public.can_see_trip(p_trip uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip
      and (
        t.user_id = auth.uid()                                   -- owner
        or t.co_host_id = auth.uid()                             -- co-host
        or t.visibility = 'public'                               -- public Flock (browsable)
        or exists (                                              -- accepted member
          select 1 from public.trip_join_requests r
          where r.trip_id = t.id and r.user_id = auth.uid() and r.status = 'accepted'
        )
        or exists (                                              -- buddy matched on this trip
          select 1 from public.buddy_matches m
          where (m.trip_a = t.id or m.trip_b = t.id)
            and (m.user_a = auth.uid() or m.user_b = auth.uid())
        )
      )
  );
$$;
grant execute on function public.can_see_trip(uuid) to authenticated;

drop policy if exists "trips readable" on public.trips;
create policy "trips readable" on public.trips for select to authenticated
  using (public.can_see_trip(id));
