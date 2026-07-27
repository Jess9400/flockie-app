-- Flockie Clubs - host membership decision
-- Run after clubs-foundation.sql. Safe to re-run.

create or replace function public.decline_club_membership(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can decide membership requests';
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
revoke all on function public.decline_club_membership(uuid, uuid) from public, anon;
grant execute on function public.decline_club_membership(uuid, uuid) to authenticated;
