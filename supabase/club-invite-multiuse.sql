-- CLUB INVITES GO MULTI-USE (founder report 2026-08-17). The founding invite
-- link was single-use, but the real usage is one link shared with the whole
-- previous-vibe group - the first click consumed it and everyone else saw
-- "expired". Now a link admits ANYONE who has it until its 14-day expiry (or
-- revocation), clicking twice is a graceful no-op, and the landing page shows
-- the club's NEXT GATHERING like a vibe invitation does.
--
-- HARDENED 2026-08-20 (founder report: "invalid after a few people join").
-- Only an explicit revoke or a real expiry may kill a link. The 'accepted'
-- and 'expired' STATUS FLAGS are no longer trusted by any read path: a legacy
-- single-use definition (or a partially applied run) writing status =
-- 'accepted' used to lock every later joiner out of a link that was still
-- perfectly valid. Validity is now the timestamp plus "not revoked", nothing
-- else. The data fix below resurrects links killed that way.
--
-- Access model unchanged: token links, authenticated-only RPCs, anon revoked.
-- Supersedes accept_club_founder_invite, club_founder_invite_detail and
-- create_club_founder_invite (club-founder-invites.sql). Run in the Supabase
-- SQL editor. Safe to re-run.

alter table public.club_founder_invites
  add column if not exists accepted_count int not null default 0;

-- Resurrect links killed by the single-use rule or by the stale-expiry sweep.
-- Revoked links stay dead: that kill is deliberate. Anything touched in the
-- last 30 days gets a fresh 14-day window so already-sent links work again.
update public.club_founder_invites
set status = 'active',
    accepted_by = null,
    accepted_at = null,
    accepted_count = greatest(accepted_count, 1),
    expires_at = greatest(expires_at, now() + interval '14 days')
where status in ('accepted', 'expired')
  and created_at > now() - interval '30 days';

-- ── Detail for the landing page: club + the NEXT gathering ──────────────────
drop function if exists public.club_founder_invite_detail(uuid);

create or replace function public.club_founder_invite_detail(p_token uuid)
returns table (
  club_id uuid,
  club_title text,
  club_description text,
  city text,
  area text,
  category text,
  cadence text,
  expires_at timestamptz,
  next_vibe_id uuid,
  next_vibe_title text,
  next_vibe_starts_at timestamptz,
  next_vibe_timezone text
)
language sql security definer set search_path = public stable as $$
  select c.id, c.title, c.description, c.city, c.area, c.category, c.cadence, i.expires_at,
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
    and i.status <> 'revoked'
    and i.expires_at > now()
    and c.status in ('forming', 'active')
    and c.owner_id <> auth.uid();
$$;
revoke all on function public.club_founder_invite_detail(uuid) from public, anon;
grant execute on function public.club_founder_invite_detail(uuid) to authenticated;

-- ── Accept: multi-use, idempotent per person ────────────────────────────────
create or replace function public.accept_club_founder_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invite public.club_founder_invites%rowtype;
  v_existing text;
begin
  select * into v_invite
  from public.club_founder_invites
  where token = p_token
  for update;

  if not found or v_invite.status = 'revoked' or v_invite.expires_at <= now() then
    raise exception 'this invitation is no longer available';
  end if;
  if v_invite.created_by = auth.uid() then
    raise exception 'the club host cannot accept their own invitation';
  end if;
  if not exists (
    select 1 from public.clubs
    where id = v_invite.club_id and status in ('forming', 'active')
  ) then
    raise exception 'this club is not accepting new members';
  end if;

  -- Clicking again after joining is a no-op, not an error.
  select status into v_existing from public.club_memberships
  where club_id = v_invite.club_id and user_id = auth.uid();
  if v_existing in ('founding', 'regular') then
    return v_invite.club_id;
  end if;

  insert into public.club_memberships (club_id, user_id, role, status, invited_by, invited_at, joined_at, updated_at)
  values (v_invite.club_id, auth.uid(), 'member', 'founding', v_invite.created_by, v_invite.created_at, now(), now())
  on conflict (club_id, user_id) do update
    set role = 'member', status = 'founding', invited_by = excluded.invited_by,
        invited_at = excluded.invited_at, joined_at = now(), updated_at = now(), show_on_profile = false
    where public.club_memberships.status in ('left', 'declined', 'removed', 'invited', 'requested');

  if not found then
    raise exception 'membership could not be updated';
  end if;

  -- A pending vote for this person is moot once the invite admits them.
  delete from public.club_join_votes
  where club_id = v_invite.club_id and candidate_id = auth.uid();

  -- Counter only. Status stays 'active': accepting must never consume a link.
  update public.club_founder_invites
  set accepted_count = accepted_count + 1
  where token = v_invite.token;

  return v_invite.club_id;
end;
$$;
revoke all on function public.accept_club_founder_invite(uuid) from public, anon;
grant execute on function public.accept_club_founder_invite(uuid) to authenticated;

-- ── ONE canonical link per club (founder report 2026-08-17 night) ───────────
-- The panel used to mint a new link on every tap (up to 10 concurrent) and
-- shared copies kept dying. Now create is GET-OR-CREATE: a live unexpired
-- link is returned as-is with its 14-day validity ROLLED FORWARD, so the link
-- the host already shared keeps working. Revoke still kills a compromised
-- link; the next create mints a fresh one. Supersedes the version in
-- club-founder-invites.sql.
create or replace function public.create_club_founder_invite(p_club uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can create invitations';
  end if;
  if not exists (
    select 1 from public.clubs
    where id = p_club and status in ('forming', 'active')
  ) then
    raise exception 'this club is not accepting invitations';
  end if;

  -- Any non-revoked, unexpired link is THE link (status flags are not trusted).
  select token into v_token
  from public.club_founder_invites
  where club_id = p_club
    and status <> 'revoked'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_token is not null then
    update public.club_founder_invites
    set status = 'active',
        accepted_by = null,
        accepted_at = null,
        expires_at = now() + interval '14 days'
    where token = v_token;
    return v_token;
  end if;

  insert into public.club_founder_invites (club_id, created_by)
  values (p_club, auth.uid())
  returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.create_club_founder_invite(uuid) from public, anon;
grant execute on function public.create_club_founder_invite(uuid) to authenticated;
