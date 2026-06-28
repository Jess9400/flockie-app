-- Vibe Matching v2: host private-link direct invites (manual accept).
-- Run AFTER vibe-v2-algo-share.sql. Safe to re-run.
--
-- Capacity is split: the algo fills its share; the host fills the rest via a
-- private link (joiners still do the activity vibe-check, but skip ranking — the
-- host accepts them manually). A `source` tag keeps the two tracks from colliding.

alter table public.vibe_interests
  add column if not exists source text not null default 'algo' check (source in ('algo', 'private'));

-- Algo's currently-available spots: its share (or, after the 12h roll-back,
-- whatever the host didn't fill privately), minus what the algo already holds.
create or replace function public._vibe_algo_remaining(p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare v public.vibes; v_algo_base int; v_private_held int; v_algo_held int; v_cap_for_algo int;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return 0; end if;
  v_algo_base := greatest(1, ceil(v.capacity * coalesce(v.algo_share, 100) / 100.0)::int);

  select count(*) into v_private_held from public.vibe_interests
    where vibe_id = p_vibe and source = 'private'
      and (status = 'confirmed'
           or (status = 'invited' and (invitation_expires_at is null or invitation_expires_at > now())));

  select count(*) into v_algo_held from public.vibe_interests
    where vibe_id = p_vibe and coalesce(source, 'algo') <> 'private'
      and ( status in ('shortlisted', 'confirmed')
            or (status = 'invited' and (invitation_expires_at is null or invitation_expires_at > now())) );

  if now() >= v.starts_at - interval '12 hours' then
    v_cap_for_algo := v.capacity - v_private_held;   -- roll-back: algo takes the host's unfilled spots
  else
    v_cap_for_algo := v_algo_base;
  end if;
  return greatest(v_cap_for_algo - v_algo_held, 0);
end $$;
grant execute on function public._vibe_algo_remaining(uuid) to authenticated;

-- ── Re-wire the three algo fillers to the new remaining-spots helper ────────
create or replace function public._rank_vibe_core(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_shortlisted int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return jsonb_build_object('shortlisted',0,'standby',0); end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);

  for c in
    select vi.user_id,
      ( 0.35 * (case when v.required_skill_level is null then 0.7 else coalesce((
            select 1 - abs(((case when (p.activity_skills ->> k) ~ '^[0-9]+$' then (p.activity_skills ->> k)::int end)) - v.required_skill_level)::float / 4
            from jsonb_object_keys(coalesce(p.activity_skills,'{}'::jsonb)) k
            where lower(k) like '%'||lower(v.category)||'%' limit 1), 0.3) end)
      + 0.30 * (case when array_length(v.event_vibe_tags,1) is null then 0.5 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      + 0.20 * (case when p.planning is null or h.planning is null then 0.5 else 1 - (
            (abs(p.planning-h.planning)+abs(p.pace-h.pace)+abs(p.social_energy-h.social_energy)
            +abs(p.budget-h.budget)+abs(p.nightlife-h.nightlife)+abs(p.adventurousness-h.adventurousness))::float/24) end)
      + 0.10 * public.vibe_review_fit(vi.user_id, p_vibe)
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested' and coalesce(vi.source,'algo') <> 'private'
    order by score desc
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining then
      update public.vibe_interests set status='shortlisted', match_score=c.score where vibe_id=p_vibe and user_id=c.user_id;
      v_shortlisted := v_shortlisted + 1;
    else
      update public.vibe_interests set status='standby', match_score=c.score where vibe_id=p_vibe and user_id=c.user_id;
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status='reviewing', shortlisted_at=now(), preview_rejects_used=0 where id=p_vibe and status <> 'cancelled';
  perform public.notify(v.host_id, 'vibe_review_ready', 'Your matched list for '||v.title||' is ready',
          'Review it — remove up to a few before invites go out, or send them now.', jsonb_build_object('vibe_id', p_vibe));
  return jsonb_build_object('shortlisted', v_shortlisted, 'standby', v_standby);
end $$;
grant execute on function public._rank_vibe_core(uuid) to authenticated;

create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select user_id from public.vibe_interests where vibe_id=p_vibe and status='standby' and coalesce(source,'algo') <> 'private'
    order by match_score desc nulls last limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at) where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;

-- SUPERSEDED: canonical invite_city_fallback is in supabase/vibe-auto-matching.sql
-- (live; has the #77 starts_at>now guard). Wrapped out 2026-06-28 — repo-only.
-- (The _rank_vibe_core + backfill_vibe above remain the canonical/live versions.)
/*
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select p.id,
      ( 0.4
        + 0.3 * (case when array_length(v.event_vibe_tags,1) is null then 0.0 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
        + 0.3 * public.vibe_review_fit(p.id, p_vibe)
      ) * 100 as score
    from public.profiles p
    where p.id <> v.host_id and coalesce(p.notifications_enabled, true)
      and array_length(coalesce(p.activities,'{}'), 1) is not null
      and p.home_city is not null and lower(p.home_city) = lower(v.city)
      and not exists (select 1 from public.vibe_interests vi where vi.vibe_id=p_vibe and vi.user_id=p.id)
      and not exists (select 1 from public.vibe_feedback vf where vf.vibe_id=p_vibe and vf.user_id=p.id and vf.signal='not_for_me')
      and (v.gender_pref is null or v.gender_pref = 'any'
           or (v.gender_pref='women' and p.gender='woman') or (v.gender_pref='men' and p.gender='man'))
      and (v.age_min is null or p.age is null or p.age >= v.age_min)
      and (v.age_max is null or p.age is null or p.age <= v.age_max)
    order by score desc limit v_remaining
  loop
    insert into public.vibe_interests (vibe_id, user_id, status, source, match_score, invitation_sent_at, invitation_expires_at)
      values (p_vibe, c.id, 'invited', 'algo', c.score, now(), public._vibe_confirm_deadline(v.starts_at))
      on conflict (vibe_id, user_id) do nothing;
    perform public.notify(c.id, 'vibe_invitation', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'There''s a spot for you — confirm to join.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.invite_city_fallback(uuid) to authenticated;
*/

-- ── Private requests: join via the host's link → pending host accept ────────
create or replace function public.request_private_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_exists text;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id = auth.uid() then raise exception 'you host this vibe'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  select status into v_exists from public.vibe_interests where vibe_id=p_vibe and user_id=auth.uid();
  if v_exists is not null then return; end if;   -- already in the funnel
  insert into public.vibe_interests (vibe_id, user_id, status, source)
    values (p_vibe, auth.uid(), 'requested', 'private');
  perform public.notify(v.host_id, 'vibe_private_request', 'Someone used your invite link for '||v.title,
          'Review and add them to your spots.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.request_private_vibe(uuid) to authenticated;

create or replace function public.host_accept_private(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_algo_base int; v_host_spots int; v_private_held int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can accept'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null or v_status <> 'requested' then raise exception 'no pending request from this person'; end if;

  v_algo_base := greatest(1, ceil(v.capacity * coalesce(v.algo_share,100) / 100.0)::int);
  v_host_spots := greatest(v.capacity - v_algo_base, 0);
  select count(*) into v_private_held from public.vibe_interests
    where vibe_id=p_vibe and source='private'
      and (status='confirmed' or (status='invited' and (invitation_expires_at is null or invitation_expires_at>now())));
  if v_private_held >= v_host_spots then raise exception 'your direct-invite spots are full'; end if;

  update public.vibe_interests set status='invited', source='private',
    invitation_sent_at=now(), invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
    where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_invitation', 'You''re invited to '||v.title,
          'The host added you directly — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.host_accept_private(uuid, uuid) to authenticated;

create or replace function public.host_reject_private(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can decline'; end if;
  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null or v_status <> 'requested' then raise exception 'no pending request'; end if;
  update public.vibe_interests set status='declined' where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_declined', v.title||' — not this time',
          'The host went a different way for their direct spots.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.host_reject_private(uuid, uuid) to authenticated;
