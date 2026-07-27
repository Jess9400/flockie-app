-- One-time cleanup of existing profiles.home_city values (2026-07-03).
-- Free-text entry produced inconsistent casing and stray whitespace
-- (e.g. "Dubai" / "dubai" / "dubai "). Matching already lowercases, but this
-- normalizes stored data so grouping/display are consistent and whitespace
-- can't bite. Run in the Supabase SQL editor. Idempotent.
update public.profiles
set home_city = initcap(trim(home_city))
where home_city is not null
  and home_city <> initcap(trim(home_city));

-- Manual typo fixes - extend as you spot them. Example from current data:
--   update public.profiles set home_city = 'Dubai'
--     where lower(trim(home_city)) in ('duabi', 'dubay', 'dubi');

-- Sanity check after running:
--   select coalesce(home_city,'(none)'), count(*) from public.profiles group by 1 order by 2 desc;
