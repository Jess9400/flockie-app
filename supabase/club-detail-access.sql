-- Flockie Clubs — safe detail access
-- Run this AFTER supabase/clubs-foundation.sql has been run on production.
-- Safe to re-run. This deliberately returns no exact gathering location or
-- membership roster.

create or replace function public.club_detail(p_club uuid)
returns table (
  id uuid,
  title text,
  description text,
  cover_photo text,
  city text,
  area text,
  category text,
  cadence text,
  status text,
  openness text,
  is_host boolean,
  membership_status text,
  next_vibe_id uuid,
  next_vibe_title text,
  next_vibe_starts_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    c.id,
    c.title,
    c.description,
    c.cover_photo,
    c.city,
    c.area,
    c.category,
    c.cadence,
    c.status,
    c.openness,
    c.owner_id = auth.uid() as is_host,
    mine.status as membership_status,
    next_vibe.id as next_vibe_id,
    next_vibe.title as next_vibe_title,
    next_vibe.starts_at as next_vibe_starts_at
  from public.clubs c
  left join lateral (
    select cm.status
    from public.club_memberships cm
    where cm.club_id = c.id and cm.user_id = auth.uid()
    limit 1
  ) mine on true
  left join lateral (
    select v.id, v.title, v.starts_at
    from public.vibes v
    where v.club_id = c.id
      and v.status in ('open', 'reviewing', 'ranking', 'finalized')
      and v.starts_at > now()
    order by v.starts_at asc
    limit 1
  ) next_vibe on true
  where c.id = p_club
    and (
      c.owner_id = auth.uid()
      or (c.openness = 'discoverable' and c.status in ('forming', 'active', 'paused'))
      or mine.status in ('invited', 'founding', 'requested', 'regular')
    );
$$;

revoke all on function public.club_detail(uuid) from public, anon;
grant execute on function public.club_detail(uuid) to authenticated;
