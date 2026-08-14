-- Club moderators (founder request 2026-08-14): the host can promote active
-- members to MODERATOR so the club isn't a single point of failure.
--
-- What a moderator can do: approve/decline membership requests and record
-- gathering attendance (and see the pending-request + attendance rows those
-- need). Host-only stays host-only: club settings/status/mode, founder
-- invites, promoting/demoting moderators, closing the club.
--
-- Access model: all functions SECURITY DEFINER with explicit search_path;
-- helpers + RPCs granted to authenticated only (anon revoked, and the
-- 2026-08-01 default-privilege change means new functions are born without
-- PUBLIC execute). set_club_member_role is host-gated with null-safe
-- `is distinct from`-free helpers (is_club_host already compares owner_id to
-- auth.uid() inside EXISTS, which is null-safe).
--
-- Supersedes: approve_club_membership + record_club_attendance + the two
-- own-or-host read policies (clubs-foundation.sql), decline_club_membership
-- (club-membership-decisions.sql). Run in the Supabase SQL editor. Safe to
-- re-run.

-- ── Role: allow 'moderator' ─────────────────────────────────────────────────
alter table public.club_memberships
  drop constraint if exists club_memberships_role_check;
alter table public.club_memberships
  add constraint club_memberships_role_check check (role in ('host', 'member', 'moderator'));

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.is_club_moderator(p_club uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.club_memberships
    where club_id = p_club
      and user_id = auth.uid()
      and role = 'moderator'
      and status in ('founding', 'regular')
  );
$$;
revoke all on function public.is_club_moderator(uuid) from public, anon;
grant execute on function public.is_club_moderator(uuid) to authenticated;

-- Host or moderator: the "can run the club day-to-day" check.
create or replace function public.is_club_manager(p_club uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_club_host(p_club) or public.is_club_moderator(p_club);
$$;
revoke all on function public.is_club_manager(uuid) from public, anon;
grant execute on function public.is_club_manager(uuid) to authenticated;

-- ── Managers can see pending requests + attendance rows ─────────────────────
drop policy if exists "club memberships own or host read" on public.club_memberships;
create policy "club memberships own or host read" on public.club_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_club_manager(club_id));

drop policy if exists "club attendance own or host read" on public.club_attendance;
create policy "club attendance own or host read" on public.club_attendance for select to authenticated
  using (user_id = auth.uid() or public.is_club_manager(club_id));

-- ── Membership decisions: host OR moderator ─────────────────────────────────
create or replace function public.approve_club_membership(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
begin
  if not public.is_club_manager(p_club) then
    raise exception 'only the club host or a moderator can approve membership';
  end if;

  select title into v_club_title
  from public.clubs
  where id = p_club;

  update public.club_memberships
  set status = 'regular', regular_since = now(), updated_at = now()
  where club_id = p_club and user_id = p_user and status = 'requested';

  if not found then
    raise exception 'a pending membership request is required';
  end if;

  perform public.notify(
    p_user,
    'club_membership_approved',
    'You''re a regular in ' || v_club_title,
    'Your membership was approved. See what''s next with the club.',
    jsonb_build_object('href', '/clubs/' || p_club)
  );
end;
$$;
revoke execute on function public.approve_club_membership(uuid, uuid) from public, anon;
grant execute on function public.approve_club_membership(uuid, uuid) to authenticated;

create or replace function public.decline_club_membership(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
begin
  if not public.is_club_manager(p_club) then
    raise exception 'only the club host or a moderator can decide membership requests';
  end if;

  select title into v_club_title
  from public.clubs
  where id = p_club;

  update public.club_memberships
  set status = 'declined', updated_at = now(), show_on_profile = false
  where club_id = p_club and user_id = p_user and status = 'requested';

  if not found then
    raise exception 'a pending membership request is required';
  end if;

  perform public.notify(
    p_user,
    'club_membership_declined',
    'Update on ' || v_club_title,
    'The host did not approve your regular membership request this time.',
    jsonb_build_object('href', '/clubs/' || p_club)
  );
end;
$$;
revoke execute on function public.decline_club_membership(uuid, uuid) from public, anon;
grant execute on function public.decline_club_membership(uuid, uuid) to authenticated;

-- ── Attendance recording: host OR moderator ─────────────────────────────────
create or replace function public.record_club_attendance(p_club uuid, p_vibe uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_club_manager(p_club) then
    raise exception 'only the club host or a moderator can record attendance';
  end if;
  if not exists (
    select 1 from public.vibes
    where id = p_vibe
      and club_id = p_club
      and status <> 'cancelled'
      and coalesce(ends_at, starts_at) <= now()
  ) then
    raise exception 'attendance can only be recorded after a completed club gathering';
  end if;
  if not exists (
    select 1 from public.vibe_interests
    where vibe_id = p_vibe and user_id = p_user and status = 'confirmed'
  ) and not exists (
    select 1 from public.vibes where id = p_vibe and host_id = p_user
  ) then
    raise exception 'only confirmed gathering participants can be recorded as attendees';
  end if;

  insert into public.club_attendance (club_id, vibe_id, user_id, recorded_by)
  values (p_club, p_vibe, p_user, auth.uid())
  on conflict (vibe_id, user_id) do nothing;
end;
$$;
revoke execute on function public.record_club_attendance(uuid, uuid, uuid) from public, anon;
grant execute on function public.record_club_attendance(uuid, uuid, uuid) to authenticated;

-- ── Promote/demote (host only) ──────────────────────────────────────────────
create or replace function public.set_club_member_role(p_club uuid, p_user uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can change member roles';
  end if;
  if p_role not in ('member', 'moderator') then
    raise exception 'role must be member or moderator';
  end if;
  if p_user = auth.uid() then
    raise exception 'the host role does not change';
  end if;

  update public.club_memberships
  set role = p_role, updated_at = now()
  where club_id = p_club and user_id = p_user
    and status in ('founding', 'regular');

  if not found then
    raise exception 'an active club membership is required';
  end if;

  if p_role = 'moderator' then
    select title into v_club_title from public.clubs where id = p_club;
    perform public.notify(
      p_user,
      'club_moderator',
      'You''re now a moderator of ' || v_club_title,
      'You can approve new members and record attendance for gatherings.',
      jsonb_build_object('href', '/clubs/' || p_club)
    );
  end if;
end;
$$;
revoke execute on function public.set_club_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_club_member_role(uuid, uuid, text) to authenticated;
