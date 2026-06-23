-- Let an owner delete their trip / activity / flock. Cleans up join requests
-- first so the delete can't be blocked by a foreign key; buddy_matches.trip_a/
-- trip_b are ON DELETE SET NULL, so any 1:1 chats survive (they just lose the
-- trip link). Run in the Supabase SQL editor. Safe to re-run.
create or replace function public.delete_trip(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.trips where id = p_trip;
  if v_owner is null then return; end if;            -- already gone
  if v_owner <> auth.uid() then raise exception 'not your trip'; end if;
  delete from public.trip_join_requests where trip_id = p_trip;
  delete from public.trips where id = p_trip;
end $$;
grant execute on function public.delete_trip(uuid) to authenticated;
