-- Fix: don't ask to review a match that was created AFTER the activity/trip's
-- end_date. A brand-new activity match (e.g. from Home "Say hi") whose activity
-- is past-dated was being flagged as "reviewable" the instant it was made — you
-- can't have attended something that ended before you matched.
--
-- Adds `m.created_at::date <= t.end_date` to both the pending_reviews() list
-- (drives the Home "leave a review" banner + the in-chat prompt) and the
-- trips_creation_gate() BEFORE-INSERT guard (so a phantom review can't block
-- creating a new trip/activity).
--
-- Run in the Supabase SQL editor. Idempotent / safe to re-run. Frontend-safe:
-- pending_reviews() keeps the same return signature.

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
    and m.created_at::date <= t.end_date          -- ← only if you matched by the time it ended
    and not exists (
      select 1 from public.reviews r
      where r.reviewer_id = auth.uid()
        and r.subject_id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
    );
$$;
grant execute on function public.pending_reviews() to authenticated;

create or replace function public.trips_creation_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if exists (
    select 1
    from public.buddy_matches m
    join public.trips t
      on t.id = (case when m.user_a = new.user_id then m.trip_a else m.trip_b end)
    where new.user_id in (m.user_a, m.user_b)
      and t.end_date < current_date
      and m.created_at::date <= t.end_date        -- ← same guard on the write gate
      and not exists (
        select 1 from public.reviews r
        where r.reviewer_id = new.user_id
          and r.subject_id = (case when m.user_a = new.user_id then m.user_b else m.user_a end)
      )
  ) then
    raise exception 'Review your past travel buddies before creating a new trip or activity.';
  end if;

  return new;
end;
$$;
