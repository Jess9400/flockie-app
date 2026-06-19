-- Optional free-text "about you" on the profile. Additive; safe to re-run.
alter table public.profiles
  add column if not exists bio text;
