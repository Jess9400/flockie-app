-- Attach an EXISTING Vibe to one of the host's Clubs after the fact - the
-- "forgot to schedule it from the club page" case. Complements the create-form
-- club picker (which handles it at creation with no SQL - the clubs-foundation
-- trigger validates ownership on insert/update of vibes.club_id).
--
-- What attaching does:
--   * vibes.club_id is set (trigger re-validates host owns the club).
--   * Any attendance ALREADY recorded on the vibe (vibe_attendance - the
--     non-club book) is copied into club_attendance, which fires the existing
--     attendance→join-prompt trigger: attendees who aren't members yet get
--     invited to request membership, host approves - same consent flow as a
--     club-scheduled gathering.
--
-- Host-only, null-safe guard + anon revoke per rpc-anon-lockdown.sql.
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.attach_vibe_to_club(p_vibe uuid, p_club uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; c public.clubs; v_backfilled int;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if v.club_id is not null then raise exception 'already part of a club'; end if;

  select * into c from public.clubs where id = p_club;
  if c.id is null then raise exception 'club not found'; end if;
  if c.owner_id is distinct from auth.uid() then raise exception 'only your own club'; end if;
  if c.status not in ('forming', 'active') then raise exception 'club is not open for gatherings'; end if;

  update public.vibes set club_id = p_club where id = p_vibe;

  -- Move already-recorded attendance into the club book. The insert fires
  -- club_attendance_join_prompt for each non-member attendee.
  insert into public.club_attendance (club_id, vibe_id, user_id, recorded_by)
    select p_club, p_vibe, va.user_id, auth.uid()
    from public.vibe_attendance va
    where va.vibe_id = p_vibe
  on conflict do nothing;
  get diagnostics v_backfilled = row_count;

  return jsonb_build_object('backfilled_attendance', v_backfilled);
end $$;
grant execute on function public.attach_vibe_to_club(uuid, uuid) to authenticated;
revoke execute on function public.attach_vibe_to_club(uuid, uuid) from public, anon;
