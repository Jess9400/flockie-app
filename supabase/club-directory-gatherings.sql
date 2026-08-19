-- Club cards were stuck on "First gathering being planned" even when the club
-- had a scheduled gathering (founder report 2026-08-20). `club_directory`
-- only looked for `v.status = 'open'`, so the moment a gathering moved on -
-- reviewing, ranking, finalized, which is where every club gathering ends up
-- once its attendees are confirmed - the card fell back to the empty state.
-- `club_detail` (the club page itself) already allowed the full set, so the
-- browse card and the club page disagreed about the same gathering.
--
-- Now: anything not cancelled and still in the future counts, matching
-- `club_detail`, `club_founder_invite_detail` and the next-gathering strip.
-- Supersedes the definition in clubs-foundation.sql. Run in the Supabase SQL
-- editor. Safe to re-run.

create or replace function public.club_directory(p_city text default null, p_limit int default 24)
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
  next_vibe_id uuid,
  next_vibe_title text,
  next_vibe_starts_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    c.id, c.title, c.description, c.cover_photo, c.city, c.area, c.category, c.cadence, c.status,
    next_vibe.id, next_vibe.title, next_vibe.starts_at
  from public.clubs c
  left join lateral (
    select v.id, v.title, v.starts_at
    from public.vibes v
    where v.club_id = c.id
      and v.status <> 'cancelled'
      and v.starts_at > now()
    order by v.starts_at asc
    limit 1
  ) next_vibe on true
  where c.status in ('forming', 'active')
    and c.openness = 'discoverable'
    and (p_city is null or lower(c.city) = lower(trim(p_city)))
  order by next_vibe.starts_at nulls last, c.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 48);
$$;
revoke all on function public.club_directory(text, int) from public, anon;
grant execute on function public.club_directory(text, int) to authenticated;
