-- Vibe Matching v2: host algo-share (50/75/100%) + roll-back near the event.
-- Run AFTER vibe-v2-preview-reject.sql. Safe to re-run.
--
-- algo_share = how much of capacity the algorithm fills. The remaining spots are
-- the host's (to fill via private link — separate feature). If the host hasn't
-- filled them by 12h before the event, the algo rolls back and fills the room.

alter table public.vibes
  add column if not exists algo_share int not null default 100 check (algo_share in (50, 75, 100)),
  add column if not exists interest_window_hours int;

-- How many spots the algo may fill right now (rolls back to full capacity ~12h out).
create or replace function public._vibe_algo_budget(p_capacity int, p_algo_share int, p_starts timestamptz)
returns int language sql stable set search_path = public as $$
  select case
    when now() >= p_starts - interval '12 hours' then p_capacity
    else greatest(1, ceil(p_capacity * coalesce(p_algo_share, 100) / 100.0)::int)
  end;
$$;

-- ── Shortlist sizing now respects the algo share ─────────────────────────────
create or replace function public._rank_vibe_core(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_budget int; v_confirmed int; v_active int; v_remaining int; v_shortlisted int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return jsonb_build_object('shortlisted',0,'standby',0); end if;

  v_budget := public._vibe_algo_budget(v.capacity, v.algo_share, v.starts_at);
  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status in ('invited','shortlisted')
      and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v_budget - v_confirmed - v_active, 0);

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
      + 0.10 * public.vibe_review_fit(vi.user_id, p_vibe)
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested'
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

-- ── Backfill respects the algo budget ───────────────────────────────────────
create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_budget int; v_confirmed int; v_active int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_budget := public._vibe_algo_budget(v.capacity, v.algo_share, v.starts_at);
  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v_budget - v_confirmed - v_active, 0);
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

-- ── Same-city fallback respects the algo budget ─────────────────────────────
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_budget int; v_pool int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;

  v_budget := public._vibe_algo_budget(v.capacity, v.algo_share, v.starts_at);
  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','shortlisted','invited','confirmed','standby');
  v_remaining := v_budget - v_pool;
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
    where p.id <> v.host_id
      and coalesce(p.notifications_enabled, true)
      and array_length(coalesce(p.activities,'{}'), 1) is not null
      and p.home_city is not null and lower(p.home_city) = lower(v.city)
      and not exists (select 1 from public.vibe_interests vi where vi.vibe_id=p_vibe and vi.user_id=p.id)
      and not exists (select 1 from public.vibe_feedback vf where vf.vibe_id=p_vibe and vf.user_id=p.id and vf.signal='not_for_me')
      and (v.gender_pref is null or v.gender_pref = 'any'
           or (v.gender_pref='women' and p.gender='woman')
           or (v.gender_pref='men' and p.gender='man'))
      and (v.age_min is null or p.age is null or p.age >= v.age_min)
      and (v.age_max is null or p.age is null or p.age <= v.age_max)
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
