-- Creation gates for trips/activities. Run in the Supabase SQL editor. Safe to re-run.
--   1) A user may have at most 10 active trips (kind='trip'); activities unlimited.
--   2) After a trip/activity is done, the user must review their matched buddy
--      before creating the next trip or activity.

-- Buddies the caller still needs to review (past trip/activity, no review yet).
-- Used by the UI to show the gate with links.
create or replace function public.pending_reviews()
returns table (buddy_id uuid, display_name text, photo text, destination text)
language sql security definer set search_path = public stable as $$
  select
    (case when m.user_a = auth.uid() then m.user_b else m.user_a end) as buddy_id,
    other.display_name,
    other.photos[1] as photo,
    t.destination
  from public.buddy_matches m
  join public.trips t
    on t.id = (case when m.user_a = auth.uid() then m.trip_a else m.trip_b end)
  join public.profiles other
    on other.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  where auth.uid() in (m.user_a, m.user_b)
    and t.end_date < current_date
    and not exists (
      select 1 from public.reviews r
      where r.reviewer_id = auth.uid()
        and r.subject_id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
    );
$$;
grant execute on function public.pending_reviews() to authenticated;

-- BEFORE INSERT gate on trips (covers trips + activities).
create or replace function public.trips_creation_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Service-role / SQL inserts (seeds, admin) have no auth context: skip gates.
  if auth.uid() is null then
    return new;
  end if;

  -- Review gate: any done trip/activity with an unreviewed matched buddy blocks.
  if exists (
    select 1
    from public.buddy_matches m
    join public.trips t
      on t.id = (case when m.user_a = new.user_id then m.trip_a else m.trip_b end)
    where new.user_id in (m.user_a, m.user_b)
      and t.end_date < current_date
      and not exists (
        select 1 from public.reviews r
        where r.reviewer_id = new.user_id
          and r.subject_id = (case when m.user_a = new.user_id then m.user_b else m.user_a end)
      )
  ) then
    raise exception 'Review your past travel buddies before creating a new trip or activity.';
  end if;

  -- 10 active-trip cap (activities are unlimited).
  if new.kind = 'trip' and (
    select count(*) from public.trips
    where user_id = new.user_id and kind = 'trip' and status = 'active'
  ) >= 10 then
    raise exception 'You can have up to 10 active trips. Complete or close one first.';
  end if;

  return new;
end $$;

drop trigger if exists trips_creation_gate_trg on public.trips;
create trigger trips_creation_gate_trg
  before insert on public.trips
  for each row execute function public.trips_creation_gate();
