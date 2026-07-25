-- ============================================================================
-- Flockie - Trip/flock photo gallery. Beyond the single cover_photo, a host can
-- add a few photos about the trip/flock (the place, past meetups, themselves).
-- Shown on the trip/flock detail page. Run in the SQL editor. Idempotent.
-- ============================================================================

alter table public.trips add column if not exists gallery text[] not null default '{}';

notify pgrst, 'reload schema';
