-- CLUB GUEST INVITES (founder call 2026-08-17). Club gatherings are
-- invite-only; members get a LIFETIME quota of "bring a guest" invites per
-- club: paid members 3, free members 1 (upgrading later simply unlocks the
-- remaining 2 - the allowance is 3 for anyone who has ever paid). An invite
-- is a one-time link tied to one gathering; redeeming it confirms the guest
-- straight into the gathering (chat + location, auto-confirm model). Quota
-- counts at CREATION (v1: an unshared link still spends it).
--
-- Access model: table has NO direct writes (RPC-only); reads limited to the
-- inviter and the club host. Functions SECURITY DEFINER with explicit
-- search_path, authenticated-only execute, anon revoked. Requires
-- club-socio-tier.sql + vibe-auto-confirm-invites.sql (_auto_confirm_member)
-- + club-gatherings-privacy.sql. Run in the Supabase SQL editor. Safe to
-- re-run.

create table if not exists public.club_guest_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists club_guest_invites_inviter_idx
  on public.club_guest_invites (club_id, inviter_id);
-- One guest per member PER GATHERING, regardless of remaining lifetime quota.
create unique index if not exists club_guest_invites_one_per_gathering
  on public.club_guest_invites (vibe_id, inviter_id);
alter table public.club_guest_invites enable row level security;

drop policy if exists "guest invites inviter or host read" on public.club_guest_invites;
create policy "guest invites inviter or host read" on public.club_guest_invites for select to authenticated
  using (inviter_id = auth.uid() or public.is_club_host(club_id));

-- Lifetime allowance per member per club: 3 once they have EVER paid, else 1.
create or replace function public._club_guest_allowance(p_club uuid, p_user uuid)
returns int
language sql security definer set search_path = public stable as $$
  select case when exists (
    select 1 from public.club_memberships
    where club_id = p_club and user_id = p_user
      and status in ('founding', 'regular')
      and (tier = 'paid' or paid_until is not null)
  ) then 3
  when exists (
    select 1 from public.club_memberships
    where club_id = p_club and user_id = p_user and status in ('founding', 'regular')
  ) then 1
  else 0 end;
$$;
revoke all on function public._club_guest_allowance(uuid, uuid) from public, anon, authenticated;

-- ── Member creates a one-time guest invite for an upcoming gathering ────────
create or replace function public.create_club_guest_invite(p_vibe uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_allowance int; v_used int; v_invite uuid;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.club_id is null then raise exception 'not a club gathering'; end if;
  if v.status = 'cancelled' or v.starts_at <= now() then
    raise exception 'this gathering is not open for guests';
  end if;

  v_allowance := public._club_guest_allowance(v.club_id, auth.uid());
  if v_allowance = 0 then raise exception 'club members only'; end if;
  select count(*) into v_used from public.club_guest_invites
    where club_id = v.club_id and inviter_id = auth.uid();
  if v_used >= v_allowance then
    raise exception 'no guest invites left for this club';
  end if;
  if exists (
    select 1 from public.club_guest_invites
    where vibe_id = p_vibe and inviter_id = auth.uid()
  ) then
    raise exception 'one guest per gathering - you already invited someone to this one';
  end if;

  insert into public.club_guest_invites (club_id, vibe_id, inviter_id)
  values (v.club_id, p_vibe, auth.uid())
  returning id into v_invite;

  return jsonb_build_object('invite_id', v_invite, 'remaining', v_allowance - v_used - 1);
end;
$$;
revoke execute on function public.create_club_guest_invite(uuid) from public, anon;
grant execute on function public.create_club_guest_invite(uuid) to authenticated;

-- ── Guest redeems: confirmed straight into the gathering ────────────────────
create or replace function public.redeem_club_guest_invite(p_invite uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare gi public.club_guest_invites; v public.vibes; v_confirmed int; v_inviter text; v_guest text;
begin
  select * into gi from public.club_guest_invites where id = p_invite for update;
  if gi.id is null then raise exception 'invite not found'; end if;
  if gi.redeemed_by is not null then raise exception 'this invite was already used'; end if;
  if gi.inviter_id = auth.uid() then raise exception 'you cannot redeem your own invite'; end if;

  select * into v from public.vibes where id = gi.vibe_id;
  if v.status = 'cancelled' or v.starts_at <= now() then
    raise exception 'this gathering already happened';
  end if;
  if exists (
    select 1 from public.vibe_interests
    where vibe_id = gi.vibe_id and user_id = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'you are already in this gathering';
  end if;
  select count(*) into v_confirmed from public.vibe_interests
    where vibe_id = gi.vibe_id and status = 'confirmed';
  if v_confirmed >= v.capacity then raise exception 'this gathering is full'; end if;

  perform public._auto_confirm_member(gi.vibe_id, auth.uid());
  update public.club_guest_invites
  set redeemed_by = auth.uid(), redeemed_at = now()
  where id = p_invite;

  v_inviter := coalesce((select display_name from public.profiles where id = gi.inviter_id), 'A member');
  v_guest := coalesce((select display_name from public.profiles where id = auth.uid()), 'Your guest');
  perform public.notify(auth.uid(), 'vibe_confirmed',
    'You''re in for ' || v.title,
    v_inviter || ' invited you. Vibing Chat and the meeting spot are unlocked.',
    jsonb_build_object('vibe_id', gi.vibe_id));
  perform public.notify(gi.inviter_id, 'club_guest_joined',
    v_guest || ' accepted your invite',
    'They''re confirmed for ' || v.title || '. Introduce them at the gathering!',
    jsonb_build_object('vibe_id', gi.vibe_id));

  return jsonb_build_object('vibe_id', gi.vibe_id);
end;
$$;
revoke execute on function public.redeem_club_guest_invite(uuid) from public, anon;
grant execute on function public.redeem_club_guest_invite(uuid) to authenticated;
