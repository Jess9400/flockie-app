-- Cover image + free-text "about" for trips / flocks / activities. Run in the
-- Supabase SQL editor. Safe to re-run.
alter table public.trips
  add column if not exists cover_photo text;

-- Short free-text description so browsers know what the trip/Flock is about
-- before requesting to join.
alter table public.trips
  add column if not exists description text;
