-- Stage 2 + 3: automatic, proximity-aware Vibe matching + same-city fallback.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- What this adds:
--  * Matching runs AUTOMATICALLY at the right time (no host click needed):
--      run_at = least( deadline (or start-24h if none), start-2h )
--    so far-out events rank ~24h before, today's events rank ~2h before.
--  * Confirm window is now PROXIMITY-AWARE: 24h, but never past (start-30min),
--    so invites for a same-day Vibe don't expire after the event.
--  * If natural interest can't fill the room, invite matched SAME-CITY users.

-- ── Dynamic confirm deadline: 24h, capped to just before the event ──────────
create or replace function public._vibe_confirm_deadline(p_starts timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select least(
    now() + interval '24 hours',
    greatest(now() + interval '30 minutes', p_starts - interval '30 minutes')
  );
$$;

-- ── When the algo should run for a Vibe (stable; no dependence on now()) ────
create or replace function public._vibe_run_at(p_starts timestamptz, p_deadline timestamptz)
returns timestamptz language sql immutable set search_path = public as $$
  select least(
    coalesce(p_deadline, p_starts - interval '24 hours'),
    p_starts - interval '2 hours'
  );
$$;

-- ── Backfill open spots from standby (uses the dynamic confirm window) ───────
create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_active int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select user_id from public.vibe_interests where vibe_id=p_vibe and status='standby'
    order by match_score desc nulls last limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
      where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;

-- ── Same-city fallback: when interest can't fill the room, invite matched
--    same-city flockies (like find-a-buddy). Only fires when the funnel is
--    short of capacity, never re-invites, and respects gender preference. ─────
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_pool int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;  -- never invite into a started/finished Vibe

  -- Everyone already in the funnel (interested counts — they'll be ranked).
  -- Cold invites only fill the GAP to capacity, so they never displace
  -- genuinely-interested people when this runs early (before ranking).
  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','invited','confirmed','standby');
  v_remaining := v.capacity - v_pool;
  if v_remaining <= 0 then return 0; end if;  -- enough in the funnel already

  for c in
    select p.id,
      ( 0.5
        + 0.5 * (case when array_length(v.event_vibe_tags,1) is null then 0.0 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      ) * 100 as score
    from public.profiles p
    where p.id <> v.host_id
      and coalesce(p.notifications_enabled, true)
      and array_length(coalesce(p.activities,'{}'), 1) is not null       -- did the activity vibe-check
      and p.home_city is not null and lower(p.home_city) = lower(v.city)  -- same city
      and not exists (select 1 from public.vibe_interests vi where vi.vibe_id=p_vibe and vi.user_id=p.id)
      and not exists (select 1 from public.vibe_feedback vf where vf.vibe_id=p_vibe and vf.user_id=p.id and vf.signal='not_for_me')
      and (v.gender_pref is null or v.gender_pref = 'any'
           or (v.gender_pref='women' and p.gender='woman')
           or (v.gender_pref='men' and p.gender='man'))
    order by score desc
    limit v_remaining
  loop
    insert into public.vibe_interests (vibe_id, user_id, status, match_score, invitation_sent_at, invitation_expires_at)
      values (p_vibe, c.id, 'invited', c.score, now(), public._vibe_confirm_deadline(v.starts_at))
      on conflict (vibe_id, user_id) do nothing;
    perform public.notify(c.id, 'vibe_invitation', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'There''s a spot for you — confirm to join.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.invite_city_fallback(uuid) to authenticated;

-- ── Core ranking (NO auth gate — callable by host RPC and by the scheduler) ─
create or replace function public._rank_vibe_core(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_active int; v_remaining int; v_invited int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return jsonb_build_object('invited',0,'standby',0); end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);

  for c in
    select vi.user_id,
      ( 0.35 * (case when v.required_skill_level is null then 0.7 else coalesce((
            select 1 - abs(((p.activity_skills ->> k)::int) - v.required_skill_level)::float / 4
            from jsonb_object_keys(coalesce(p.activity_skills,'{}'::jsonb)) k
            where lower(k) like '%'||lower(v.category)||'%' limit 1), 0.3) end)
      + 0.30 * (case when array_length(v.event_vibe_tags,1) is null then 0.5 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      + 0.20 * (case when p.planning is null or h.planning is null then 0.5 else 1 - (
            (abs(p.planning-h.planning)+abs(p.pace-h.pace)+abs(p.social_energy-h.social_energy)
            +abs(p.budget-h.budget)+abs(p.nightlife-h.nightlife)+abs(p.adventurousness-h.adventurousness))::float/24) end)
      + 0.10 * 0.8
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested'
    order by score desc
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining and c.score >= 60 then
      update public.vibe_interests set status='invited', match_score=c.score,
        invitation_sent_at=now(), invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
        where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_invitation', 'You''re invited to '||v.title,
              'Confirm your spot to unlock the location & chat.', jsonb_build_object('vibe_id', p_vibe));
      v_invited := v_invited + 1;
    else
      update public.vibe_interests set status='standby', match_score=c.score
        where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_standby', v.title||' is filling up',
              'You''re on standby — we''ll bump you in if a spot opens.', jsonb_build_object('vibe_id', p_vibe));
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status='ranking' where id=p_vibe and status <> 'cancelled';
  perform public.backfill_vibe(p_vibe);       -- top up from standby
  perform public.invite_city_fallback(p_vibe); -- still short? pull in same-city matches
  return jsonb_build_object('invited', v_invited, 'standby', v_standby);
end $$;
grant execute on function public._rank_vibe_core(uuid) to authenticated;

-- ── Host-facing rank_vibe: auth-gated wrapper around the core ───────────────
create or replace function public.rank_vibe(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  select host_id into v_host from public.vibes where id = p_vibe;
  if v_host is null then raise exception 'vibe not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can run matching'; end if;
  return public._rank_vibe_core(p_vibe);
end $$;
grant execute on function public.rank_vibe(uuid) to authenticated;

-- ── Scheduler: auto-run the initial ranking when each Vibe's run_at arrives ──
create or replace function public.auto_rank_due_vibes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.vibes
    where status = 'open'
      and starts_at > now()
      and now() >= public._vibe_run_at(starts_at, signup_deadline)
  loop
    perform public._rank_vibe_core(r.id);
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-auto-rank'); exception when others then null; end $$;
select cron.schedule('flockie-auto-rank', '*/5 * * * *', $$ select public.auto_rank_due_vibes(); $$);

-- ── Keep vibes topped up every 10 min ───────────────────────────────────────
--   * Ranked vibes: backfill from standby + same-city.
--   * Open vibes within 48h of their deadline: start same-city fallback early
--     so the city pool has lead time to see and confirm the invite.
create or replace function public.autofill_open_vibes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.vibes where status = 'ranking' and starts_at > now() loop
    perform public.backfill_vibe(r.id);
    perform public.invite_city_fallback(r.id);
  end loop;
  for r in
    select id from public.vibes
    where status = 'open'
      and starts_at > now()
      and now() >= coalesce(signup_deadline, starts_at - interval '24 hours') - interval '48 hours'
  loop
    perform public.invite_city_fallback(r.id);
  end loop;
end $$;
do $$ begin perform cron.unschedule('flockie-autofill'); exception when others then null; end $$;
select cron.schedule('flockie-autofill', '*/10 * * * *', $$ select public.autofill_open_vibes(); $$);
