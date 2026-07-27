-- ════════════════════════════════════════════════════════════════════════════
-- deploy-2026-07-02.sql - tombstone-followup batch. Run on prod in this order.
-- Idempotent (CREATE OR REPLACE / DROP ... IF EXISTS). Safe to re-run.
--
-- Contains ONLY what must run on prod for this batch:
--   1. vibe_match  - adds the 0.15 review-fit term (rescaled the other 4 weights).
--   2. invite_city_fallback - the age+gender eligibility version (via vibe_eligible)
--      with the #77 starts_at>now() guard. (Unchanged this batch; re-affirmed here
--      so the deploy is self-contained.)
--   3. DROP the legacy buddy functions defused in buddy-matching.sql.
--
-- DEPENDENCIES that must already exist on prod (from earlier merged work):
--   • vibe_review_fit         (supabase/vibe-review-preferences.sql) - for #1
--   • vibe_eligible           (supabase/vibe-eligibility-enforce.sql) - for #2
--   • _vibe_algo_remaining, _vibe_confirm_deadline, notify, backfill_vibe - for #2
-- If those are NOT yet on prod, run vibe-eligibility-enforce.sql and
-- vibe-review-preferences.sql FIRST (see the run order in the deploy notes).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. vibe_match: 0.40/0.30/0.15/0.15 → 0.35/0.25/0.12/0.13 + 0.15 review-fit ──
create or replace function public.vibe_match(p_user uuid, p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare
  pr public.profiles%rowtype;
  v public.vibes%rowtype;
  cat_fit numeric; tag_fit numeric; skill_fit numeric; social_fit numeric; review_fit numeric;
  n_tags int; n_match int; event_social int; matched_skill int;
begin
  select * into pr from public.profiles where id = p_user;
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return null; end if;

  -- category / activity fit
  if coalesce(array_length(pr.activities, 1), 0) = 0 or v.category is null or v.category = 'other' then
    cat_fit := 0.5;
  elsif exists (select 1 from unnest(pr.activities) a where lower(a) like '%' || lower(v.category) || '%') then
    cat_fit := 1.0;
  else
    cat_fit := 0.2;
  end if;

  -- vibe-tag fit (event tags appearing in the user's activity-vibe phrases)
  n_tags := coalesce(array_length(v.event_vibe_tags, 1), 0);
  if n_tags = 0 or coalesce(array_length(pr.activity_vibe, 1), 0) = 0 then
    tag_fit := 0.5;
  else
    select count(*) into n_match
    from unnest(v.event_vibe_tags) tg
    where lower(array_to_string(pr.activity_vibe, ' ')) like '%' || lower(tg) || '%';
    tag_fit := n_match::numeric / n_tags;
  end if;

  -- skill fit
  if v.required_skill_level is null then
    skill_fit := 1.0;
  else
    select case when (pr.activity_skills->>a) ~ '^[0-9]+$' then (pr.activity_skills->>a)::int end into matched_skill
    from unnest(pr.activities) a
    where lower(a) like '%' || lower(v.category) || '%' and pr.activity_skills ? a
    limit 1;
    if matched_skill is null then
      skill_fit := 0.5;
    else
      skill_fit := 1 - abs(v.required_skill_level - matched_skill)::numeric / 4;
    end if;
  end if;

  -- social fit
  event_social := case
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('party', 'social', 'energetic')) then 5
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('quiet', 'chill')) then 2
    else 3
  end;
  if pr.activity_social is null then
    social_fit := 0.5;
  else
    social_fit := 1 - abs(event_social - pr.activity_social)::numeric / 4;
  end if;

  -- review fit: do this user's past positive reviews lean toward this category /
  -- these tags? vibe_review_fit returns 0..1 (0.5 neutral when no reviews yet).
  review_fit := public.vibe_review_fit(p_user, p_vibe);

  return round(100 * (0.35 * cat_fit + 0.25 * tag_fit + 0.12 * skill_fit + 0.13 * social_fit + 0.15 * review_fit));
end $$;
grant execute on function public.vibe_match(uuid, uuid) to authenticated;

-- Per-vibe match for the "X% your vibe" badge on cards.
drop function if exists public.vibe_match_scores(uuid[]);
create or replace function public.vibe_match_scores(p_ids uuid[])
returns table (vibe_id uuid, score int)
language sql security definer set search_path = public stable as $$
  select v.id, public.vibe_match(auth.uid(), v.id)
  from public.vibes v
  where v.id = any(p_ids);
$$;
grant execute on function public.vibe_match_scores(uuid[]) to authenticated;

-- ── 2. invite_city_fallback: eligibility (age+gender) + #77 starts_at guard ─────
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_pool int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;  -- never invite into a started/finished Vibe

  -- Same remaining-spots helper as _rank_vibe_core: shortlisted/invited/confirmed
  -- holds and the host's private share are all accounted for inside
  -- _vibe_algo_remaining. Then subtract everyone still WAITING in the funnel
  -- (interested/requested/standby - they'll be ranked / host-reviewed), so cold
  -- candidates never displace genuinely-interested people when this runs early.
  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','requested','standby');
  v_remaining := public._vibe_algo_remaining(p_vibe) - v_pool;
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
      and public.vibe_eligible(p.id, p_vibe)  -- host's gender + age prefs (age filter restored)
    order by score desc nulls last, p.id
    limit v_remaining
  loop
    -- Cold candidates join as 'shortlisted' (NOT a direct invite): they go
    -- through the host's pre-invite review + commit_vibe_matching exactly like
    -- the candidates _rank_vibe_core shortlists.
    insert into public.vibe_interests (vibe_id, user_id, status, source, match_score)
      values (p_vibe, c.id, 'shortlisted', 'algo', c.score)
      on conflict (vibe_id, user_id) do nothing;
    perform public.notify(c.id, 'vibe_shortlisted', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'You''re in the running - we''ll notify you if a spot is yours.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.invite_city_fallback(uuid) to authenticated;

-- ── 3. Drop the legacy buddy functions (defused in buddy-matching.sql) ──────────
-- Flat 0.6/0.4 weights, no hard-block, NULL-score bug; unused by the client
-- (verified: all buddy_swipe callers pass 3 args; only buddy_candidates_trip used).
drop function if exists public.buddy_city_count();
drop function if exists public.buddy_candidates(int);
drop function if exists public.buddy_swipe(uuid, boolean);
