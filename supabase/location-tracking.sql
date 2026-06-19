-- Location tracking preference. Run in the Supabase SQL editor. Safe to re-run.
-- When on, the app keeps the user's location current silently; when off, it asks
-- contextually (only when location is needed to find Vibes/trips/activities).

alter table public.profiles
  add column if not exists location_tracking_enabled boolean not null default false;
