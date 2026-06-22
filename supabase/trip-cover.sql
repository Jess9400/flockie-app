-- Cover image for trips / flocks / activities (uploaded or AI-generated). Run in
-- the Supabase SQL editor. Safe to re-run.
alter table public.trips
  add column if not exists cover_photo text;
