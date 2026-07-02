-- delete_my_account(): lets a signed-in user delete their own account.
-- Deleting the auth.users row cascades to public.profiles (FK on delete cascade)
-- and any other tables that reference the user with on-delete-cascade.
-- Run this whole block in the Supabase SQL editor. Safe to re-run.
--
-- Cancellation-aware (2026-07-02): before deleting, we cancel the user's UPCOMING
-- hosted Vibes and notify their attendees, and notify accepted members of their
-- upcoming hosted Flocks — otherwise a host could vanish and silently strand
-- people who'd planned around the event. Runs BEFORE the delete so the rows (and
-- auth.uid()) still exist while we notify; the notifications belong to the
-- attendees (not the departing user), so they persist through the cascade.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  -- 1) Cancel upcoming hosted Vibes. cancel_vibe sets status='cancelled' and
  --    notifies invited/confirmed/standby attendees (host check passes — it's us).
  for r in
    select id from public.vibes
    where host_id = auth.uid()
      and status not in ('cancelled', 'completed')
      and starts_at > now()
  loop
    perform public.cancel_vibe(r.id);
  end loop;

  -- 2) Notify accepted members of upcoming hosted Flocks (public group trips)
  --    that the trip is going away (the trip + its group chat cascade-delete).
  for r in
    select distinct j.user_id as member_id, t.destination
    from public.trips t
    join public.trip_join_requests j on j.trip_id = t.id
    where t.user_id = auth.uid()
      and t.visibility = 'public'
      and t.status = 'active'
      and t.end_date >= current_date
      and j.status = 'accepted'
  loop
    perform public.notify(
      r.member_id, 'flock_cancelled', 'Cancelled: ' || r.destination,
      'The host left Flockie, so this Flock is no longer happening. Plenty more await.',
      '{}'::jsonb  -- no link: the trip is about to be deleted
    );
  end loop;

  -- 3) Delete the account (cascades profiles, trips, vibes, swipes, chats, etc.).
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
