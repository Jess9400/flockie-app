-- ONE PERMANENT INVITE LINK PER CLUB (founder decision 2026-08-20).
--
-- The 14-day window was the last way a link could die on its own, and it kept
-- surprising the host: a link shared in a group chat has no reason to stop
-- working three weeks later. Expiry is gone. A club has ONE link, it works
-- until the host explicitly PAUSES invitations, and pausing is reversible -
-- replacing "generate a new link", which silently broke every copy already
-- shared.
--
-- Storage note: `expires_at` is not null and every read path already compares
-- it against now(), so permanence is stored as 'infinity' rather than by
-- rewriting those comparisons. New links are born infinite via the default
-- below.
--
-- Supersedes the invite functions in club-invite-multiuse.sql. Run in the
-- Supabase SQL editor. Safe to re-run.

-- 1) 'paused' becomes a real state alongside the existing ones.
alter table public.club_founder_invites
  drop constraint if exists club_founder_invites_status_check;
alter table public.club_founder_invites
  add constraint club_founder_invites_status_check
  check (status in ('active', 'accepted', 'revoked', 'expired', 'paused'));

-- 2) Every link that is not deliberately dead becomes permanent, including
--    any that lapsed while the old rule was in force.
alter table public.club_founder_invites
  alter column expires_at set default 'infinity'::timestamptz;

update public.club_founder_invites
set expires_at = 'infinity'::timestamptz,
    status = case when status in ('accepted', 'expired') then 'active' else status end,
    accepted_by = case when status in ('accepted', 'expired') then null else accepted_by end,
    accepted_at = case when status in ('accepted', 'expired') then null else accepted_at end
where status <> 'revoked';

-- 3) Reads: a link is live unless it was paused or revoked.
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
    and i.status not in ('revoked', 'paused')
    and i.expires_at > now()
    and c.status in ('forming', 'active')
    and c.owner_id <> auth.uid();
$$;
revoke all on function public.club_founder_invite_detail(uuid) from public, anon;
grant execute on function public.club_founder_invite_detail(uuid) to authenticated;

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

  if not found or v_invite.status in ('revoked', 'paused') or v_invite.expires_at <= now() then
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

  delete from public.club_join_votes
  where club_id = v_invite.club_id and candidate_id = auth.uid();

  update public.club_founder_invites
  set accepted_count = accepted_count + 1
  where token = v_invite.token;

  return v_invite.club_id;
end;
$$;
revoke all on function public.accept_club_founder_invite(uuid) from public, anon;
grant execute on function public.accept_club_founder_invite(uuid) to authenticated;

-- 4) Get-or-create returns THE link, paused or not, so the panel can show its
--    state. It never resumes on its own - that is the host's decision.
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

  select token into v_token
  from public.club_founder_invites
  where club_id = p_club and status <> 'revoked'
  order by created_at desc
  limit 1;

  if v_token is not null then
    update public.club_founder_invites
    set expires_at = 'infinity'::timestamptz
    where token = v_token;
    return v_token;
  end if;

  insert into public.club_founder_invites (club_id, created_by, expires_at)
  values (p_club, auth.uid(), 'infinity'::timestamptz)
  returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.create_club_founder_invite(uuid) from public, anon;
grant execute on function public.create_club_founder_invite(uuid) to authenticated;

-- 5) Pause / resume, the reversible replacement for revoking.
create or replace function public.set_club_invites_paused(p_club uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can pause invitations';
  end if;

  update public.club_founder_invites
  set status = case when p_paused then 'paused' else 'active' end
  where club_id = p_club
    and status <> 'revoked';
end;
$$;
revoke all on function public.set_club_invites_paused(uuid, boolean) from public, anon;
grant execute on function public.set_club_invites_paused(uuid, boolean) to authenticated;
