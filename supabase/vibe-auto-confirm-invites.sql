-- AUTO-CONFIRM INVITES (founder decision 2026-08-05): kill the confirm step.
--
-- Before: matching/backfill/host-approval put people in status 'invited' with
-- an expiry; they had to tap Confirm to become 'confirmed'. In practice people
-- forgot, seats sat held, and rooms went underfilled even with willing guests.
--
-- After: anyone the matching selects (or the host approves) is CONFIRMED
-- immediately - chat, exact location, and the "You're in" email all unlock at
-- once. Attendance confirmation becomes an OPTIONAL soft RSVP
-- (vibe_interests.attendance_confirmed_at, set by confirm_attendance()) shown
-- to the host as a planning signal, never a gate. "I'm interested" is now a
-- real commitment (consistent with the post-matching one-tap join in
-- vibe-express-interest-autoconfirm.sql).
--
-- Legacy 'invited' rows keep working: confirm_vibe/expiry/InterestButton paths
-- are untouched; new invitations simply no longer create that state.
--
-- Supersedes: commit_vibe_matching (vibe-v2-preview-reject.sql),
-- backfill_vibe (vibe-flow-fixes.sql), host_invite_interest +
-- host_make_room_invite_interest (host-controls.sql), leave_vibe promotion
-- (vibe-lifecycle.sql). Run in the Supabase SQL editor. Safe to re-run.

-- ── Soft-RSVP column ─────────────────────────────────────────────────────────
alter table public.vibe_interests
  add column if not exists attendance_confirmed_at timestamptz;

-- ── Internal: confirm one member with full side effects ─────────────────────
-- Row → confirmed, chat ensured, "joined" system message. Callers send their
-- own contextual notification (type 'vibe_confirmed' → localized email with
-- the maps link via the pg_net pipeline).
create or replace function public._auto_confirm_member(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  update public.vibe_interests
    set status = 'confirmed', confirmed_at = now(),
        invitation_sent_at = now(), invitation_expires_at = null
    where vibe_id = p_vibe and user_id = p_user;
  insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;
  v_name := coalesce((select display_name from public.profiles where id = p_user), 'Someone');
  perform public.vibe_system_msg(p_vibe, v_name || ' joined the chat');
end $$;
revoke execute on function public._auto_confirm_member(uuid, uuid) from public, anon, authenticated;

-- ── Matching commit: shortlist → confirmed (was → invited) ──────────────────
create or replace function public.commit_vibe_matching(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; c record; v_confirmed int := 0;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null or v.status <> 'reviewing' then return 0; end if;

  for c in select user_id from public.vibe_interests where vibe_id=p_vibe and status='shortlisted' loop
    perform public._auto_confirm_member(p_vibe, c.user_id);
    perform public.notify(c.user_id, 'vibe_confirmed', 'You''re in for ' || v.title,
            'You matched! Vibing Chat and the meeting spot are unlocked - tap to see the details.',
            jsonb_build_object('vibe_id', p_vibe));
    v_confirmed := v_confirmed + 1;
  end loop;

  update public.vibes set status='ranking' where id=p_vibe;
  perform public.backfill_vibe(p_vibe);
  perform public.invite_city_fallback(p_vibe);
  return v_confirmed;
end $$;
revoke execute on function public.commit_vibe_matching(uuid) from public, anon, authenticated;

-- ── Backfill: standby + late interested → confirmed directly ────────────────
-- Same selection logic as vibe-flow-fixes.sql (same-city first, eligibility,
-- private-source exclusion, never into a started vibe).
create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select vi.user_id
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    where vi.vibe_id = p_vibe
      and vi.status in ('standby','interested')
      and coalesce(vi.source,'algo') <> 'private'
      and public.vibe_eligible(vi.user_id, p_vibe)
    order by
      (v.city is not null and p.home_city is not null
        and lower(trim(p.home_city)) = lower(trim(v.city))) desc,
      vi.match_score desc nulls last
    limit v_remaining
  loop
    perform public._auto_confirm_member(p_vibe, c.user_id);
    perform public.notify(c.user_id, 'vibe_confirmed', 'A spot opened up: ' || v.title,
            'You''re in! Vibing Chat and the meeting spot are unlocked.',
            jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
revoke execute on function public.backfill_vibe(uuid) from public, anon, authenticated;

-- ── Host approves someone from the interested/standby list → in directly ────
create or replace function public.host_invite_interest(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_confirmed int; v_active int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host can approve interests'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;

  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null then raise exception 'interest not found'; end if;
  if v_status not in ('interested','standby') then raise exception 'only interested or standby users can be approved'; end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  if greatest(v.capacity - v_confirmed - v_active, 0) <= 0 then
    raise exception 'vibe is full';
  end if;

  perform public._auto_confirm_member(p_vibe, p_user);
  perform public.notify(p_user, 'vibe_confirmed', 'You''re in for ' || v.title,
          'The host added you. Vibing Chat and the meeting spot are unlocked.',
          jsonb_build_object('vibe_id', p_vibe));
end $$;
revoke execute on function public.host_invite_interest(uuid, uuid) from public, anon;
grant execute on function public.host_invite_interest(uuid, uuid) to authenticated;

create or replace function public.host_make_room_invite_interest(p_vibe uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_confirmed int; v_active int; v_new_capacity int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host can make room'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;

  select status into v_status from public.vibe_interests
    where vibe_id=p_vibe and user_id=p_user
    for update;
  if v_status is null then raise exception 'interest not found'; end if;
  if v_status not in ('interested','standby') then raise exception 'only interested or standby users can be approved'; end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  if greatest(v.capacity - v_confirmed - v_active, 0) > 0 then
    raise exception 'room is already available; approve normally';
  end if;

  v_new_capacity := greatest(v.capacity + 1, v_confirmed + v_active + 1);
  update public.vibes set capacity=v_new_capacity where id=p_vibe;

  perform public._auto_confirm_member(p_vibe, p_user);
  perform public.notify(p_user, 'vibe_confirmed', 'The host made room for you at ' || v.title,
          'You''re in! Vibing Chat and the meeting spot are unlocked.',
          jsonb_build_object('vibe_id', p_vibe));

  return jsonb_build_object('capacity', v_new_capacity);
end $$;
revoke execute on function public.host_make_room_invite_interest(uuid, uuid) from public, anon;
grant execute on function public.host_make_room_invite_interest(uuid, uuid) to authenticated;

-- ── Leaving frees a seat → backfill auto-confirms the replacement ───────────
-- (Replaces the inline standby-promotion in vibe-lifecycle.sql with the full
-- backfill: city-first ordering, late-interested pool, start-time guard.)
create or replace function public.leave_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_name text;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;

  select status into v_status from public.vibe_interests
    where vibe_id = p_vibe and user_id = auth.uid();

  update public.vibe_interests set status = 'declined'
    where vibe_id = p_vibe and user_id = auth.uid();

  v_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  perform public.vibe_system_msg(p_vibe, v_name || ' left the chat');

  if v_status in ('confirmed', 'invited') then
    perform public.backfill_vibe(p_vibe);
  end if;
end $$;
revoke execute on function public.leave_vibe(uuid) from public, anon;
grant execute on function public.leave_vibe(uuid) to authenticated;

-- ── Soft RSVP: optional attendance confirmation (planning signal, not a gate) ─
create or replace function public.confirm_attendance(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.vibe_interests
    set attendance_confirmed_at = now()
    where vibe_id = p_vibe and user_id = auth.uid() and status = 'confirmed';
  if not found then raise exception 'you are not confirmed for this vibe'; end if;
end $$;
revoke execute on function public.confirm_attendance(uuid) from public, anon;
grant execute on function public.confirm_attendance(uuid) to authenticated;
