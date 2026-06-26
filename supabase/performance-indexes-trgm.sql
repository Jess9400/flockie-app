-- Phase 1 latency cleanup — follow-up to performance-indexes.sql. Safe to re-run.
--
-- Why: the Home and Vibes feed filter city with ILIKE
--   home:  .ilike("city", homeCity)        -> city ILIKE 'berlin'
--   vibes: .ilike("city", `%${city}%`)     -> city ILIKE '%berlin%'
-- Postgres will NOT use a plain btree(lower(city), ...) index for ILIKE
-- predicates, so vibes_lower_city_starts_idx ends up unused. A pg_trgm GIN
-- index supports both the anchored and the substring ILIKE forms.

create extension if not exists pg_trgm;

create index if not exists vibes_city_trgm_idx
  on public.vibes using gin (city gin_trgm_ops);

-- Optional: drop the superseded btree index once the trigram index is verified
-- in EXPLAIN ANALYZE. Left commented so nothing is removed automatically.
-- drop index if exists vibes_lower_city_starts_idx;
