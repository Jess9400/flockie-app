-- Perf: make destination-overlap matching index-usable (before growth).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- buddy_dest_count / buddy_candidates_trip test "do these two trips share a
-- destination (case-insensitive)?" via unnest(...) join on lower() — which can't
-- use an index (sequential scan over all active trips). This adds an IMMUTABLE
-- lowercased-array helper + a GIN index on it, and the two functions are rewritten
-- (in their own files) to use `lower_array(a) && lower_array(b)` — a provably
-- equivalent array-overlap test the GIN index can serve. Also trims elements, so
-- "Paris " and "paris" match (same hardening as the home_city fix).

create or replace function public.lower_array(arr text[])
returns text[] language sql immutable set search_path = public as $$
  select coalesce(array(select lower(trim(x)) from unnest(arr) x where trim(x) <> ''), '{}');
$$;

create index if not exists trips_destinations_lower_gin
  on public.trips using gin (public.lower_array(destinations));
