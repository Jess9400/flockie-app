-- Expose the vibe's IANA timezone through the public browse view so the app can
-- render each vibe's start time in ITS OWN zone (e.g. a Bangalore vibe reads
-- "5pm" for every viewer) instead of the runtime zone. Before this, the detail
-- page (a server component) rendered starts_at in UTC while the card (client)
-- rendered it in the viewer's browser zone - same vibe, two different times.
--
-- `timezone` is appended at the END: `create or replace view` can only add
-- trailing columns, never reorder/rename existing ones. Column list must match
-- the live view exactly up to that point. Run in the Supabase SQL editor.
-- Safe to re-run.

create or replace view public.vibe_directory
with (security_barrier = true, security_invoker = false)
as
select
  v.id,
  v.host_id,
  v.title,
  v.description,
  v.category,
  v.photos,
  v.country,
  v.city,
  v.area,
  v.starts_at,
  v.ends_at,
  v.signup_deadline,
  v.capacity,
  v.event_vibe_tags,
  v.required_skill_level,
  v.dealbreaker_rules,
  v.diversity_floor_enabled,
  v.what_to_bring,
  v.language,
  v.age_min,
  v.age_max,
  v.gender_pref,
  v.status,
  v.created_at,
  v.categories,
  -- appended at the END (see header note).
  v.timezone
from public.vibes v;

revoke all on public.vibe_directory from public, anon, authenticated;
grant select on public.vibe_directory to authenticated;
