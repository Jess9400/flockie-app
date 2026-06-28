-- Vibe location privacy, phase 1 of 2.
-- Run BEFORE deploying the matching app PR. This phase is additive and does
-- not yet remove the legacy broad read policy.

begin;

alter table public.vibes
  add column if not exists country text,
  add column if not exists area text,
  add column if not exists activity_url text,
  add column if not exists gender_pref text default 'any';

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
  v.created_at
from public.vibes v;

revoke all on public.vibe_directory from public, anon, authenticated;
grant select on public.vibe_directory to authenticated;

create or replace function public.vibe_private_logistics(p_vibe uuid)
returns table (
  location_name text,
  location_lat float8,
  location_lng float8,
  activity_url text
)
language sql security definer set search_path = public stable as $$
  select v.location_name, v.location_lat, v.location_lng, v.activity_url
  from public.vibes v
  where v.id = p_vibe
    and (
      v.host_id = auth.uid()
      or exists (
        select 1
        from public.vibe_interests i
        where i.vibe_id = v.id
          and i.user_id = auth.uid()
          and i.status = 'confirmed'
      )
    );
$$;
revoke all on function public.vibe_private_logistics(uuid) from public, anon;
grant execute on function public.vibe_private_logistics(uuid) to authenticated;

drop function if exists public.public_vibe(uuid);
create function public.public_vibe(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  photos text[],
  city text,
  area text,
  country text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  status text,
  host_name text,
  host_photo text,
  confirmed_count int
)
language sql security definer set search_path = public stable as $$
  select
    v.id, v.title, v.description, v.category, v.photos,
    v.city, v.area, v.country, v.starts_at, v.capacity,
    v.event_vibe_tags, v.status,
    h.display_name as host_name,
    h.photos[1] as host_photo,
    (
      select count(*)::int
      from public.vibe_interests vi
      where vi.vibe_id = v.id and vi.status = 'confirmed'
    ) as confirmed_count
  from public.vibes v
  left join public.profiles h on h.id = v.host_id
  where v.id = p_id;
$$;
revoke all on function public.public_vibe(uuid) from public;
grant execute on function public.public_vibe(uuid) to anon, authenticated;

-- SUPERSEDED 2026-06-28: duplicate recommended_vibes (functionally identical to
-- the canonical copy in recommended-vibes.sql). Wrapped (drop INCLUDED) so this
-- privacy-prepare migration is re-runnable without touching the live function.
-- (vibe_directory / vibe_private_logistics / public_vibe above remain ACTIVE.)
/*
drop function if exists public.recommended_vibes(int);
create function public.recommended_vibes(p_limit int default 6)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  photos text[],
  city text,
  area text,
  country text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  match_score int
)
language sql security definer set search_path = public stable as $$
  with me as (
    select id, home_city
    from public.profiles
    where id = auth.uid()
  )
  select
    v.id, v.host_id, v.title, v.category, v.photos,
    v.city, v.area, v.country, v.starts_at, v.capacity,
    v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status = 'open'
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    and not exists (
      select 1
      from public.vibe_interests vi
      where vi.vibe_id = v.id and vi.user_id = m.id
    )
    and not exists (
      select 1
      from public.vibe_feedback vf
      where vf.vibe_id = v.id
        and vf.user_id = m.id
        and vf.signal = 'not_for_me'
    )
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$$;
revoke all on function public.recommended_vibes(int) from public, anon;
grant execute on function public.recommended_vibes(int) to authenticated;
*/

commit;
