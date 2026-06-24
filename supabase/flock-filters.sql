-- Find a Flock filters: continent, group gender, language on trips/flocks.
-- Safe to re-run. Run in the Supabase SQL editor BEFORE deploying the matching
-- app changes (the Flock form writes these and Find a Flock filters on them).

alter table public.trips
  add column if not exists continent text,
  add column if not exists group_gender text not null default 'any',
  add column if not exists language text;

-- Constrain group_gender to the three app values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trips_group_gender_check'
  ) then
    alter table public.trips
      add constraint trips_group_gender_check
      check (group_gender in ('any', 'women', 'men'));
  end if;
end $$;

create index if not exists trips_flock_filters_idx
  on public.trips (visibility, kind, continent, group_gender, language);
