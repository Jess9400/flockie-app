-- Vibe ranking: same-city candidates get first dibs on the shortlist.
-- We don't gate events to a city, so out-of-city people can express interest —
-- but a same-city person should always outrank an out-of-city person for a spot,
-- with match score only breaking ties WITHIN each group. Everything else
-- (eligibility gate, scoring weights, review-fit, diversity, standby split) is
-- unchanged from the live definition. Idempotent (create or replace). Safe to re-run.
--
-- NOTE vs the pasted live copy: corrected `h.budt` -> `h.budget` in the budget
-- slider term (h.budt is not a real column).
create or replace function public._rank_vibe_core(p_vibe uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
      -- Guard EVERY slider: one NULL on either side used to turn the whole score
      -- NULL, and NULLs sorted FIRST — rank 1 shortlists.
      + 0.20 * (case when p.planning is null or h.planning is null
                       or p.pace is null or h.pace is null
                       or p.social_energy is null or h.social_energy is null
                       or p.budget is null or h.budget is null
                       or p.nightlife is null or h.nightlife is null
                       or p.adventurousness is null or h.adventurousness is null then 0.5 else 1 - (
            (abs(p.planning-h.planning)+abs(p.pace-h.pace)+abs(p.social_energy-h.social_energy)
            +abs(p.budget-h.budget)+abs(p.nightlife-h.nightlife)+abs(p.adventurousness-h.adventurousness))::float/24) end)
      + 0.10 * public.vibe_review_fit(vi.user_id, p_vibe)
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested' and coalesce(vi.source,'algo') <> 'private'
      and public.vibe_eligible(vi.user_id, p_vibe)  -- host's gender/age prefs
    -- Same-city first (both cities set + match, case/space-insensitive), then
    -- score, then a deterministic tiebreak. Anyone missing a city falls to the
    -- score-ordered group. NULLs never win.
    order by
      (v.city is not null and p.home_city is not null
        and lower(trim(p.home_city)) = lower(trim(v.city))) desc,
      score desc nulls last, vi.user_id
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
end $function$;
