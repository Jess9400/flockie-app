-- A club invite link should open the club, not a login wall (founder report
-- 2026-08-20). Shared Vibe links have always worked this way: /invite/<id>
-- renders the event for a signed-out visitor via the anon-callable
-- `public_vibe`, and signing in happens when they act. Club invites went
-- through the authenticated-only `club_founder_invite_detail`, so anyone
-- without an account hit /login and never saw what they were invited to.
--
-- `public_club_invite` is the club equivalent: token-gated, read-only, and
-- limited to what the landing page renders (no roster, no exact venue, no
-- invite bookkeeping). Joining still requires an account - only the PREVIEW
-- is public.
--
-- ANON ALLOWLIST: this is a deliberate addition to the five functions in
-- supabase/public-rpc-allowlist.json; every other RPC stays revoked from anon
-- per rpc-anon-lockdown.sql.
--
-- NULL-SAFETY: the host exclusion uses `is distinct from`, not `<>`. With a
-- NULL auth.uid() (anon) `<>` yields NULL and the row would vanish - the whole
-- point here is that a signed-out visitor sees it.
--
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.public_club_invite(p_token uuid)
returns table (
  club_id uuid,
  club_title text,
  club_description text,
  city text,
  area text,
  category text,
  cadence text,
  next_vibe_id uuid,
  next_vibe_title text,
  next_vibe_starts_at timestamptz,
  next_vibe_timezone text
)
language sql security definer set search_path = public stable as $$
  select c.id, c.title, c.description, c.city, c.area, c.category, c.cadence,
         nv.id, nv.title, nv.starts_at, nv.timezone
  from public.club_founder_invites i
  join public.clubs c on c.id = i.club_id
  left join lateral (
    select v.id, v.title, v.starts_at, v.timezone
    from public.vibes v
    where v.club_id = c.id
      and v.status <> 'cancelled'
      and v.starts_at > now()
    order by v.starts_at asc
    limit 1
  ) nv on true
  where i.token = p_token
    and i.status not in ('revoked', 'paused')
    and i.expires_at > now()
    and c.status in ('forming', 'active');
$$;
revoke all on function public.public_club_invite(uuid) from public;
grant execute on function public.public_club_invite(uuid) to anon, authenticated;
