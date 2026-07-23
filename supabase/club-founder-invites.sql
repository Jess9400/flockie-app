-- Flockie Clubs — founding member invite links
-- Run this AFTER clubs-foundation.sql and club-detail-access.sql.
-- Safe to re-run. Each link is private, single-use, and expires after 14 days.

create table if not exists public.club_founder_invites (
  token uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null))
);

create index if not exists club_founder_invites_club_status_idx
  on public.club_founder_invites(club_id, status, expires_at);

alter table public.club_founder_invites enable row level security;

drop policy if exists "club founder invites host read" on public.club_founder_invites;
create policy "club founder invites host read" on public.club_founder_invites for select to authenticated
  using (public.is_club_host(club_id));

create or replace function public.create_club_founder_invite(p_club uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can create founding invitations';
  end if;
  if not exists (
    select 1 from public.clubs
    where id = p_club and status in ('forming', 'active')
  ) then
    raise exception 'this club is not accepting founding invitations';
  end if;
  if (
    select count(*) from public.club_founder_invites
    where club_id = p_club and status = 'active' and expires_at > now()
  ) >= 10 then
    raise exception 'revoke or use an existing founding invitation before creating another';
  end if;

  update public.club_founder_invites
  set status = 'expired'
  where club_id = p_club and status = 'active' and expires_at <= now();

  insert into public.club_founder_invites (club_id, created_by)
  values (p_club, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;
revoke all on function public.create_club_founder_invite(uuid) from public, anon;
grant execute on function public.create_club_founder_invite(uuid) to authenticated;

create or replace function public.revoke_club_founder_invite(p_token uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.club_founder_invites i
  set status = 'revoked'
  from public.clubs c
  where i.token = p_token
    and i.club_id = c.id
    and c.owner_id = auth.uid()
    and i.status = 'active';

  if not found then
    raise exception 'an active founding invitation from one of your clubs is required';
  end if;
end;
$$;
revoke all on function public.revoke_club_founder_invite(uuid) from public, anon;
grant execute on function public.revoke_club_founder_invite(uuid) to authenticated;

-- Safe preview for the signed-in recipient. A token is intentionally required;
-- this function never lists invites or Club members.
create or replace function public.club_founder_invite_detail(p_token uuid)
returns table (
  club_id uuid,
  club_title text,
  club_description text,
  city text,
  area text,
  category text,
  cadence text,
  expires_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select c.id, c.title, c.description, c.city, c.area, c.category, c.cadence, i.expires_at
  from public.club_founder_invites i
  join public.clubs c on c.id = i.club_id
  where i.token = p_token
    and i.status = 'active'
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
begin
  select * into v_invite
  from public.club_founder_invites
  where token = p_token
  for update;

  if not found or v_invite.status <> 'active' or v_invite.expires_at <= now() then
    raise exception 'this founding invitation is no longer available';
  end if;
  if v_invite.created_by = auth.uid() then
    raise exception 'the club host cannot accept their own invitation';
  end if;
  if not exists (
    select 1 from public.clubs
    where id = v_invite.club_id and status in ('forming', 'active')
  ) then
    raise exception 'this club is not accepting founding members';
  end if;

  insert into public.club_memberships (club_id, user_id, role, status, invited_by, invited_at, joined_at, updated_at)
  values (v_invite.club_id, auth.uid(), 'member', 'founding', v_invite.created_by, v_invite.created_at, now(), now())
  on conflict (club_id, user_id) do update
    set role = 'member', status = 'founding', invited_by = excluded.invited_by,
        invited_at = excluded.invited_at, joined_at = now(), updated_at = now(), show_on_profile = false
    where public.club_memberships.status in ('left', 'declined', 'removed');

  if not found then
    raise exception 'you already have an active club membership or request';
  end if;

  update public.club_founder_invites
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where token = v_invite.token;

  return v_invite.club_id;
end;
$$;
revoke all on function public.accept_club_founder_invite(uuid) from public, anon;
grant execute on function public.accept_club_founder_invite(uuid) to authenticated;
