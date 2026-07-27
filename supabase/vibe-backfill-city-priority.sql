-- Vibe backfill: when a spot opens up (a confirmed attendee drops), invite from
-- the standby list SAME-CITY FIRST - mirrors the shortlist priority in
-- _rank_vibe_core (see vibe-ranking-city-priority.sql). Score breaks ties within
-- each group; anyone missing a city falls to the score-ordered group. Everything
-- else (algo-share host-spot accounting via _vibe_algo_remaining, the private-spot
-- exclusion, confirm deadline, invite + notify) is unchanged from the live copy.
-- Idempotent (create or replace). Safe to re-run.
create or replace function public.backfill_vibe(p_vibe uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select vi.user_id
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    where vi.vibe_id=p_vibe and vi.status='standby' and coalesce(vi.source,'algo') <> 'private'
    -- Same-city first (both cities set + match, case/space-insensitive), then score.
    order by
      (v.city is not null and p.home_city is not null
        and lower(trim(p.home_city)) = lower(trim(v.city))) desc,
      vi.match_score desc nulls last
    limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at) where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in - confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $function$;
