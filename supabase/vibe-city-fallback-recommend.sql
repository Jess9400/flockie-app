-- City fallback becomes a RECOMMENDATION, not an auto-shortlist.
-- Before: cold same-city people were inserted straight into the run as
-- 'shortlisted' (on the host's review list) without ever opting in.
-- Now: it sends a 'vibe_recommendation' notification (in-app + email) so they
-- can open the Vibe and click "I'm interested" themselves — no vibe_interests
-- row is created until THEY opt in. Deduped: at most one recommendation per
-- person per vibe, and total recommendations are capped to the algo budget so it
-- doesn't nudge the whole city. Same-city / eligibility / activity-vibe-check /
-- not-for-me / notifications-enabled filters unchanged from the live copy.
-- Idempotent. Safe to re-run.
create or replace function public.invite_city_fallback(p_vibe uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.vibes; v_pool int; v_recommended int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;  -- never recommend a started/finished Vibe

  -- People genuinely in the funnel...
  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','requested','standby','shortlisted','invited','confirmed');
  -- ...plus people we've already recommended (they didn't create a row, so count
  -- the notifications) — keeps total reach bounded to the spots available.
  select count(*) into v_recommended from public.notifications
    where type = 'vibe_recommendation' and data->>'vibe_id' = p_vibe::text;
  v_remaining := public._vibe_algo_remaining(p_vibe) - v_pool - v_recommended;
  if v_remaining <= 0 then return 0; end if;  -- enough reached already

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
      and not exists (select 1 from public.notifications n                -- recommend at most once per person per vibe
                      where n.user_id=p.id and n.type='vibe_recommendation'
                        and n.data->>'vibe_id' = p_vibe::text)
      and public.vibe_eligible(p.id, p_vibe)  -- host's gender + age prefs
    order by score desc nulls last, p.id
    limit v_remaining
  loop
    -- RECOMMEND ONLY — no vibe_interests row. They enter the run via "I'm interested".
    perform public.notify(c.id, 'vibe_recommendation', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'Tap to check it out — join if it''s your vibe.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $function$;
