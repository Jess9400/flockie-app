-- Public (anon-readable) view of a single Vibe, for shareable invite links.
-- Run in the Supabase SQL editor. Safe to re-run.

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
    v.id, v.title, v.description, v.category, v.photos, v.city, v.area, v.country,
    v.starts_at, v.capacity, v.event_vibe_tags, v.status,
    h.display_name as host_name,
    h.photos[1] as host_photo,
    (select count(*)::int from public.vibe_interests vi
       where vi.vibe_id = v.id and vi.status = 'confirmed') as confirmed_count
  from public.vibes v
  left join public.profiles h on h.id = v.host_id
  where v.id = p_id;
$$;
grant execute on function public.public_vibe(uuid) to anon, authenticated;
