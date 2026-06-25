-- Group review for a flock: list the other participants the current member can
-- review (star + short note via /review/[userId]). Run in the Supabase SQL editor.

create or replace function public.flock_review_targets(p_trip uuid)
returns table(user_id uuid, display_name text, photo text, reviewed boolean)
language plpgsql security definer set search_path = public stable as $$
declare v public.trips; v_is_member boolean;
begin
  select * into v from public.trips where id = p_trip;
  if v.id is null then return; end if;

  -- Only people who were in the flock (host or an accepted member) can review it.
  v_is_member := (v.user_id = auth.uid())
    or exists (
      select 1 from public.trip_join_requests
      where trip_id = p_trip and user_id = auth.uid() and status = 'accepted'
    );
  if not v_is_member then return; end if;

  return query
  with members as (
    select v.user_id as uid
    union
    select jr.user_id from public.trip_join_requests jr
      where jr.trip_id = p_trip and jr.status = 'accepted'
  )
  select
    m.uid,
    p.display_name,
    (p.photos)[1],
    exists (
      select 1 from public.reviews r
      where r.reviewer_id = auth.uid() and r.subject_id = m.uid
    ) as reviewed
  from members m
  join public.profiles p on p.id = m.uid
  where m.uid <> auth.uid();
end $$;
grant execute on function public.flock_review_targets(uuid) to authenticated;
