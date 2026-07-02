-- Phase 1 latency cleanup indexes. Safe to re-run.
-- These support the high-traffic Home/Vibes feed queries without changing app logic.

create index if not exists vibes_status_starts_idx
  on public.vibes (status, starts_at);

create index if not exists vibes_host_status_starts_idx
  on public.vibes (host_id, status, starts_at);

create index if not exists vibes_lower_city_starts_idx
  on public.vibes (lower(city), starts_at);

create index if not exists vibe_interests_user_status_vibe_idx
  on public.vibe_interests (user_id, status, vibe_id);

create index if not exists vibe_interests_vibe_status_user_idx
  on public.vibe_interests (vibe_id, status, user_id);

create index if not exists vibe_feedback_user_signal_vibe_idx
  on public.vibe_feedback (user_id, signal, vibe_id);

-- city_people / activity_candidates look up same-city discoverable people with
-- lower(home_city) = lower(...). The trgm index only covers vibes.city ILIKE,
-- so this btree expression index (partial on the discovery flag) serves the
-- equality path.
create index if not exists profiles_home_city_lower_idx
  on public.profiles (lower(home_city)) where open_to_discovery;
