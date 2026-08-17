-- Club members see their club gathering's EXACT address without confirming
-- first (founder report 2026-08-17): they are already vetted club members -
-- the address is club business, not a confirmation reward. Non-club vibes
-- keep the confirmed-only gate. Supersedes vibe_private_logistics
-- (vibe-location-privacy-prepare.sql). Run in the Supabase SQL editor.
-- Safe to re-run.

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
      or (
        v.club_id is not null
        and exists (
          select 1 from public.club_memberships m
          where m.club_id = v.club_id
            and m.user_id = auth.uid()
            and m.status in ('founding', 'regular')
        )
      )
    );
$$;
revoke all on function public.vibe_private_logistics(uuid) from public, anon;
grant execute on function public.vibe_private_logistics(uuid) to authenticated;
