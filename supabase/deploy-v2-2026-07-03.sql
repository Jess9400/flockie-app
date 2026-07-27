-- ════════════════════════════════════════════════════════════════════════════
-- deploy-v2-2026-07-03.sql  (v2 - fixed vibe_directory column position)
-- Pending prod SQL for the V2 batch + Taisiya's #175. Run the WHOLE file once.
-- Idempotent. Order matters: dest-gin-index.sql defines lower_array() first.
-- ════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- [1] dest-gin-index.sql
-- ═══════════════════════════════════════════════════════════════════

-- Perf: make destination-overlap matching index-usable (before growth).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- buddy_dest_count / buddy_candidates_trip test "do these two trips share a
-- destination (case-insensitive)?" via unnest(...) join on lower() - which can't
-- use an index (sequential scan over all active trips). This adds an IMMUTABLE
-- lowercased-array helper + a GIN index on it, and the two functions are rewritten
-- (in their own files) to use `lower_array(a) && lower_array(b)` - a provably
-- equivalent array-overlap test the GIN index can serve. Also trims elements, so
-- "Paris " and "paris" match (same hardening as the home_city fix).

create or replace function public.lower_array(arr text[])
returns text[] language sql immutable set search_path = public as $$
  select coalesce(array(select lower(trim(x)) from unnest(arr) x where trim(x) <> ''), '{}');
$$;

create index if not exists trips_destinations_lower_gin
  on public.trips using gin (public.lower_array(destinations));


-- ═══════════════════════════════════════════════════════════════════
-- [2] buddy-candidates-v2.sql
-- ═══════════════════════════════════════════════════════════════════

-- Buddy matching, consolidated + per-post targeting. Lets "Find a match" pick a
-- specific trip/activity to swipe on (p_trip). Run in the Supabase SQL editor.
-- Safe to re-run. (Replaces the inline buddy_candidates_trip / buddy_dest_count.)

drop function if exists public.buddy_dest_count();
drop function if exists public.buddy_dest_count(text);
drop function if exists public.buddy_dest_count(text, uuid);

-- How many OTHER users have an overlapping post (same kind + destination)?
create or replace function public.buddy_dest_count(p_kind text default 'trip', p_trip uuid default null)
returns int language sql security definer set search_path = public stable as $$
  with me_t as (
    select * from public.trips
    where user_id = auth.uid() and status = 'active'
      and (id = p_trip or (p_trip is null and kind = p_kind))
    order by created_at desc limit 1
  )
  select count(distinct t.user_id)::int
  from public.trips t cross join me_t
  where t.user_id <> auth.uid() and t.status = 'active' and t.kind = me_t.kind
    and coalesce(t.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    -- shared destination (case/space-insensitive); && uses the GIN index on
    -- lower_array(destinations) - see supabase/dest-gin-index.sql
    and public.lower_array(t.destinations) && public.lower_array(me_t.destinations);
$$;
grant execute on function public.buddy_dest_count(text, uuid) to authenticated;

-- SUPERSEDED 2026-06-28: older buddy_candidates_trip - flat weights and NO
-- buddy_hard_block dealbreaker/block filter (could surface hard-blocked users).
-- Canonical version (priority-weighted + buddy_hard_block) is in
-- match-priorities.sql, which has its own drops+create. Wrapped (drops INCLUDED)
-- so re-running this file can't drop the live function or downgrade the deck.
-- (buddy_dest_count above remains ACTIVE.)
/*
drop function if exists public.buddy_candidates_trip(int);
drop function if exists public.buddy_candidates_trip(int, text);
drop function if exists public.buddy_candidates_trip(int, text, uuid);

-- Ranked candidates for a specific post (p_trip) or the latest active of p_kind.
create or replace function public.buddy_candidates_trip(
  p_limit int default 30, p_kind text default 'trip', p_trip uuid default null
)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (
    select * from public.trips
    where user_id = auth.uid() and status = 'active'
      and (id = p_trip or (p_trip is null and kind = p_kind))
    order by created_at desc limit 1
  ),
  me_p as (select * from public.profiles where id = auth.uid())
  select cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
         ct.title, ct.destinations, ct.start_date, ct.end_date, ct.trip_type,
    ( (
        0.25 * (
          with sh as (select count(*)::float n from unnest(coalesce(ct.trip_type,'{}')) x
                      where x = any(coalesce(me_t.trip_type,'{}')))
          select case when cardinality(coalesce(me_t.trip_type,'{}'))=0 and cardinality(coalesce(ct.trip_type,'{}'))=0
                      then 0.5
                      else (select n from sh) / greatest(
                        cardinality(coalesce(me_t.trip_type,'{}')) + cardinality(coalesce(ct.trip_type,'{}')) - (select n from sh), 1) end
        )
      + 0.15 * (1 - abs(coalesce(ct.pace, cp.pace, 3) - coalesce(me_t.pace, me_p.pace, 3))::float / 4)
      + 0.15 * (1 - abs(coalesce(ct.budget, cp.budget, 3) - coalesce(me_t.budget, me_p.budget, 3))::float / 4)
      + 0.10 * (case when cp.planning is null or me_p.planning is null then 0.5
                     else 1 - abs(cp.planning - me_p.planning)::float / 4 end)
      + 0.10 * (case when cp.social_energy is null or me_p.social_energy is null then 0.5
                     else 1 - abs(cp.social_energy - me_p.social_energy)::float / 4 end)
      + 0.15 * (case when cp.planning is null or me_p.planning is null then 0.5
                     else 1 - ((abs(cp.planning-me_p.planning)+abs(cp.pace-me_p.pace)
                       +abs(cp.social_energy-me_p.social_energy)+abs(cp.budget-me_p.budget)
                       +abs(cp.nightlife-me_p.nightlife)+abs(cp.adventurousness-me_p.adventurousness))::float/24) end)
      ) / 0.90 ) * 100 as score
  from public.trips ct
  join public.profiles cp on cp.id = ct.user_id
  cross join me_t cross join me_p
  where ct.user_id <> auth.uid()
    and ct.status = 'active'
    and ct.kind = me_t.kind
    and coalesce(ct.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    and exists (select 1 from unnest(coalesce(ct.destinations,'{}')) a
                join unnest(coalesce(me_t.destinations,'{}')) b on lower(a)=lower(b))
    and (greatest(ct.start_date, me_t.start_date) - least(ct.end_date, me_t.end_date)) <= 30
    and cp.onboarding_complete
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int, text, uuid) to authenticated;
*/


-- ═══════════════════════════════════════════════════════════════════
-- [3] match-priorities.sql
-- ═══════════════════════════════════════════════════════════════════

-- Per-user match weighting + hard dealbreaker filters. Run in the Supabase SQL
-- editor. Safe to re-run.
--
-- Two upgrades the matching algo needs to actually differentiate people:
--   1. WEIGHTS  - each user picks the 2-3 things that matter most to them.
--      Those dimensions count ~2x in THEIR ranking, so a budget-obsessed
--      traveler and a budget-agnostic one no longer get the same score.
--   2. FILTERS  - the dealbreakers we already collect (same-gender, sober)
--      now hard-exclude incompatible candidates instead of being dead data.
-- Also rescales the personality cosine, which structurally lands ~0.7-0.95 for
-- everyone, so scores spread across a usable range.

-- ── 1. Priority columns (the "weight question" answers) ──────────────────────
alter table public.profiles
  add column if not exists match_priorities text[] default '{}',      -- trip dims
  add column if not exists activity_priorities text[] default '{}';   -- activity dims

-- ── 2. Hard dealbreaker filter ───────────────────────────────────────────────
-- True when a pair should be hidden from each other entirely. Only the
-- dealbreakers with a clear partner-facing meaning are enforced; self-
-- descriptors (dietary, private bathroom…) stay soft.
create or replace function public.buddy_hard_block(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b)
  select
    -- Same-gender requirement on either side. Only enforceable when both
    -- genders are known; "prefer not to say" (null) is never auto-excluded.
    ( ( 'I prefer same-gender travel partners' = any(coalesce(a.dealbreakers, '{}'))
        or 'I prefer same-gender travel partners' = any(coalesce(b.dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(a.activity_dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(b.activity_dealbreakers, '{}')) )
      and a.gender is not null and b.gender is not null
      and a.gender <> b.gender )
    or
    -- Sober-only vs. drinks-are-fine is a real conflict for activity meetups.
    ( ( 'Sober events only' = any(coalesce(a.activity_dealbreakers, '{}'))
          and 'Drinking is fine' = any(coalesce(b.activity_dealbreakers, '{}')) )
      or ( 'Sober events only' = any(coalesce(b.activity_dealbreakers, '{}'))
          and 'Drinking is fine' = any(coalesce(a.activity_dealbreakers, '{}')) ) )
  from a, b;
$$;
grant execute on function public.buddy_hard_block(uuid, uuid) to authenticated;

-- ── 3. Weighted pair score ───────────────────────────────────────────────────
-- Weights are taken from p_a (the viewer) - "what matters to ME when ranking
-- you." A prioritized dimension counts 2x; everything else counts 1x, then the
-- block is renormalized so the total still sums to 1.
-- SUPERSEDED: canonical buddy_pair_score is in supabase/vibe-traits.sql (adds
-- social_style / activity_motivation / initiator). Wrapped out 2026-06-28 so
-- re-running this file can't downgrade the live engine. (buddy_hard_block and
-- buddy_candidates_trip below remain active.)
/*
create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  prio text[];   -- viewer's trip priorities
  aprio text[];  -- viewer's activity priorities
  -- trip
  s numeric := 0; w numeric := 0; ww numeric; inter int; uni int; tagj numeric;
  slider numeric; tag_w numeric; trip_sim numeric; trip_w numeric := 0;
  -- personality
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
  cos numeric; pers_sim numeric; pers_w numeric := 0;
  -- activity
  a_inter int; a_uni int; parts numeric := 0; pw numeric := 0; pwi numeric;
  act_sim numeric; act_w numeric := 0;
  -- blend
  total numeric; wsum numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;
  prio  := coalesce(ra.match_priorities, '{}');
  aprio := coalesce(ra.activity_priorities, '{}');

  -- ----- Trip vibe: priority-weighted sliders (60%) + trip_vibe Jaccard (40%) -
  if ra.planning is not null and rb.planning is not null then
    ww := case when 'planning' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.planning - rb.planning)/4.0); w := w + ww; end if;
  if ra.pace is not null and rb.pace is not null then
    ww := case when 'pace' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.pace - rb.pace)/4.0); w := w + ww; end if;
  if ra.social_energy is not null and rb.social_energy is not null then
    ww := case when 'social_energy' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.social_energy - rb.social_energy)/4.0); w := w + ww; end if;
  if ra.budget is not null and rb.budget is not null then
    ww := case when 'budget' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.budget - rb.budget)/4.0); w := w + ww; end if;
  if ra.nightlife is not null and rb.nightlife is not null then
    ww := case when 'nightlife' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.nightlife - rb.nightlife)/4.0); w := w + ww; end if;
  if ra.adventurousness is not null and rb.adventurousness is not null then
    ww := case when 'adventurousness' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.adventurousness - rb.adventurousness)/4.0); w := w + ww; end if;

  select count(*) into inter from unnest(coalesce(ra.trip_vibe,'{}')) t where t = any(coalesce(rb.trip_vibe,'{}'));
  select cardinality(array(select distinct unnest(coalesce(ra.trip_vibe,'{}') || coalesce(rb.trip_vibe,'{}')))) into uni;

  if w > 0 then
    slider := s / w;
    tagj := case when uni > 0 then inter::numeric / uni else 0.5 end;
    -- "Shared interests" as a priority pulls the tag overlap up to a 50/50 split.
    tag_w := case when 'interests' = any(prio) then 0.5 else 0.4 end;
    trip_sim := (1 - tag_w) * slider + tag_w * tagj;
    trip_w := 0.35;
  elsif uni > 0 then
    trip_sim := inter::numeric / uni;
    trip_w := 0.35;
  end if;

  -- ----- Personality: 6-dim cosine, rescaled so the typical band spreads -----
  if ra.vibe_scores is not null and rb.vibe_scores is not null then
    foreach d in array dims loop
      av := coalesce((ra.vibe_scores ->> d)::float, 0);
      bv := coalesce((rb.vibe_scores ->> d)::float, 0);
      dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
    end loop;
    if na > 0 and nb > 0 then
      cos := dot / (sqrt(na) * sqrt(nb));
      -- 0.55 -> 0, 1.0 -> 1; clamps the all-positive cosine into a real range.
      pers_sim := greatest(0, least(1, (cos - 0.55) / 0.45));
      pers_w := 0.40;
    end if;
  end if;

  -- ----- Activity: priority-weighted over its sub-signals --------------------
  if coalesce(array_length(ra.activities,1),0) > 0 and coalesce(array_length(rb.activities,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activities) t where t = any(rb.activities);
    select cardinality(array(select distinct unnest(ra.activities || rb.activities))) into a_uni;
    pwi := case when 'interests' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activity_vibe) t where t = any(rb.activity_vibe);
    select cardinality(array(select distinct unnest(ra.activity_vibe || rb.activity_vibe))) into a_uni;
    pwi := case when 'vibe' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if ra.activity_social is not null and rb.activity_social is not null then
    pwi := case when 'social' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_social - rb.activity_social)/4.0); pw := pw + pwi;
  end if;
  if ra.activity_intensity is not null and rb.activity_intensity is not null then
    pwi := case when 'intensity' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_intensity - rb.activity_intensity)/4.0); pw := pw + pwi;
  end if;
  if pw > 0 then
    act_sim := parts / pw;
    act_w := 0.25;
  end if;

  -- ----- Weighted blend over the components both people have ------------------
  wsum := pers_w + trip_w + act_w;
  if wsum = 0 then return 50; end if; -- no shared data - neutral
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;
*/

-- ── 4. Trip candidate deck: priority-weighted per-dimension score + filter ───
drop function if exists public.buddy_candidates_trip(int);
drop function if exists public.buddy_candidates_trip(int, text);
drop function if exists public.buddy_candidates_trip(int, text, uuid);
create or replace function public.buddy_candidates_trip(
  p_limit int default 30, p_kind text default 'trip', p_trip uuid default null
)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (
    select * from public.trips
    where user_id = auth.uid() and status = 'active'
      and (id = p_trip or (p_trip is null and kind = p_kind))
    order by created_at desc limit 1
  ),
  me_p as (select * from public.profiles where id = auth.uid())
  select cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
         ct.title, ct.destinations, ct.start_date, ct.end_date, ct.trip_type,
    -- Priority-weighted average of the per-dimension similarities. Each weight
    -- is 2 when the viewer flagged that dimension as a priority, else 1. Inline
    -- arithmetic (not a VALUES list) so the me_t/ct/cp correlation is plain and
    -- portable. Denominator is the sum of the 7 weights, always >= 7.
    ( 100 * (
        score_w.w_interests * sim.s_interests
      + score_w.w_pace      * sim.s_pace
      + score_w.w_budget    * sim.s_budget
      + score_w.w_planning  * sim.s_planning
      + score_w.w_social    * sim.s_social
      + score_w.w_night     * sim.s_night
      + score_w.w_adv       * sim.s_adv
      ) / (
        score_w.w_interests + score_w.w_pace + score_w.w_budget + score_w.w_planning
      + score_w.w_social + score_w.w_night + score_w.w_adv
      ) )::float8 as score
  from public.trips ct
  join public.profiles cp on cp.id = ct.user_id
  cross join me_t cross join me_p
  -- per-dimension similarities (0..1)
  cross join lateral (
    select
      ( case when cardinality(coalesce(me_t.trip_type,'{}'))=0 and cardinality(coalesce(ct.trip_type,'{}'))=0 then 0.5
             else (select count(*)::float from unnest(coalesce(ct.trip_type,'{}')) x where x = any(coalesce(me_t.trip_type,'{}')))
                  / greatest(cardinality(coalesce(me_t.trip_type,'{}')) + cardinality(coalesce(ct.trip_type,'{}'))
                    - (select count(*)::float from unnest(coalesce(ct.trip_type,'{}')) x where x = any(coalesce(me_t.trip_type,'{}'))), 1) end ) as s_interests,
      ( 1 - abs(coalesce(ct.pace, cp.pace, 3) - coalesce(me_t.pace, me_p.pace, 3))::float / 4 ) as s_pace,
      ( 1 - abs(coalesce(ct.budget, cp.budget, 3) - coalesce(me_t.budget, me_p.budget, 3))::float / 4 ) as s_budget,
      ( case when cp.planning is null or me_p.planning is null then 0.5 else 1 - abs(cp.planning - me_p.planning)::float / 4 end ) as s_planning,
      ( case when cp.social_energy is null or me_p.social_energy is null then 0.5 else 1 - abs(cp.social_energy - me_p.social_energy)::float / 4 end ) as s_social,
      ( case when cp.nightlife is null or me_p.nightlife is null then 0.5 else 1 - abs(cp.nightlife - me_p.nightlife)::float / 4 end ) as s_night,
      ( case when cp.adventurousness is null or me_p.adventurousness is null then 0.5 else 1 - abs(cp.adventurousness - me_p.adventurousness)::float / 4 end ) as s_adv
  ) sim
  -- viewer's priority weights (2 = flagged as "matters most", else 1)
  cross join lateral (
    select
      case when 'interests'     = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_interests,
      case when 'pace'          = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_pace,
      case when 'budget'        = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_budget,
      case when 'planning'      = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_planning,
      case when 'social_energy' = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_social,
      case when 'nightlife'     = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_night,
      case when 'adventurousness' = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_adv
  ) score_w
  where ct.user_id <> auth.uid()
    and ct.status = 'active'
    and ct.kind = me_t.kind
    and coalesce(ct.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    -- shared destination (case/space-insensitive); && uses the GIN index on
    -- lower_array(destinations) - see supabase/dest-gin-index.sql
    and public.lower_array(ct.destinations) && public.lower_array(me_t.destinations)
    and (greatest(ct.start_date, me_t.start_date) - least(ct.end_date, me_t.end_date)) <= 30
    and cp.onboarding_complete
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
    -- reciprocity: don't resurface people who already swiped no on the viewer
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=cp.id and s.target_id=auth.uid() and not s.liked)
  order by score desc nulls last, cp.id
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int, text, uuid) to authenticated;

-- ── 5. Activity discovery deck: add the same hard filter ─────────────────────
-- SUPERSEDED: canonical activity_candidates is in
-- supabase/activity-candidate-decisions.sql (adds the per-activity decision +
-- swipe exclusions). Wrapped out 2026-06-28 to prevent re-run downgrade.
/*
drop function if exists public.activity_candidates(uuid, int);
create or replace function public.activity_candidates(p_trip uuid, p_limit int default 30)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (select * from public.trips where id = p_trip and user_id = auth.uid()),
       me_p as (select * from public.profiles where id = auth.uid())
  select
    cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
    null::text as title,
    array[cp.home_city]::text[] as destinations,
    null::date as start_date,
    null::date as end_date,
    null::text[] as trip_type,
    ( 100 * (
        0.5 * (public.buddy_pair_score(auth.uid(), cp.id) / 100.0)
        + 0.5 * (
          case
            when coalesce(array_length(cp.activity_vibe, 1), 0) = 0
              or coalesce(array_length(me_p.activity_vibe, 1), 0) = 0
            then 0.5
            else cardinality(array(select unnest(cp.activity_vibe) intersect select unnest(me_p.activity_vibe)))::numeric
                 / nullif(cardinality(array(select unnest(cp.activity_vibe) union select unnest(me_p.activity_vibe))), 0)
          end
        )
      ) )::float8 as score
  from public.profiles cp
  cross join me_t
  cross join me_p
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    and coalesce(array_length(cp.activities, 1), 0) > 0
    and lower(coalesce(cp.home_city, '')) = lower(coalesce(me_t.destination, ''))
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.activity_id = p_trip
        and d.candidate_id = cp.id
    )
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id = auth.uid() and s.target_id = cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.activity_candidates(uuid, int) to authenticated;
*/

-- ── 6. Recompute persisted pair scores with the new formula ──────────────────
update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);


-- ═══════════════════════════════════════════════════════════════════
-- [4] vibe-location-privacy-prepare.sql
-- ═══════════════════════════════════════════════════════════════════

-- Vibe location privacy, phase 1 of 2.
-- Run BEFORE deploying the matching app PR. This phase is additive and does
-- not yet remove the legacy broad read policy.

begin;

alter table public.vibes
  add column if not exists country text,
  add column if not exists area text,
  add column if not exists activity_url text,
  add column if not exists gender_pref text default 'any';

create or replace view public.vibe_directory
with (security_barrier = true, security_invoker = false)
as
select
  v.id,
  v.host_id,
  v.title,
  v.description,
  v.category,
  v.photos,
  v.country,
  v.city,
  v.area,
  v.starts_at,
  v.ends_at,
  v.signup_deadline,
  v.capacity,
  v.event_vibe_tags,
  v.required_skill_level,
  v.dealbreaker_rules,
  v.diversity_floor_enabled,
  v.what_to_bring,
  v.language,
  v.age_min,
  v.age_max,
  v.gender_pref,
  v.status,
  v.created_at,
  -- appended at the END so `create or replace view` accepts it (it can only
  -- add columns, never reorder/rename existing ones).
  v.categories
from public.vibes v;

revoke all on public.vibe_directory from public, anon, authenticated;
grant select on public.vibe_directory to authenticated;

create or replace function public.vibe_private_logistics(p_vibe uuid)
returns table (
  location_name text,
  location_lat float8,
  location_lng float8,
  activity_url text
)
language sql security definer set search_path = public stable as $$
  select v.location_name, v.location_lat, v.location_lng, v.activity_url
  from public.vibes v
  where v.id = p_vibe
    and (
      v.host_id = auth.uid()
      or exists (
        select 1
        from public.vibe_interests i
        where i.vibe_id = v.id
          and i.user_id = auth.uid()
          and i.status = 'confirmed'
      )
    );
$$;
revoke all on function public.vibe_private_logistics(uuid) from public, anon;
grant execute on function public.vibe_private_logistics(uuid) to authenticated;

drop function if exists public.public_vibe(uuid);
create function public.public_vibe(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  photos text[],
  city text,
  area text,
  country text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  status text,
  host_name text,
  host_photo text,
  confirmed_count int
)
language sql security definer set search_path = public stable as $$
  select
    v.id, v.title, v.description, v.category, v.photos,
    v.city, v.area, v.country, v.starts_at, v.capacity,
    v.event_vibe_tags, v.status,
    h.display_name as host_name,
    h.photos[1] as host_photo,
    (
      select count(*)::int
      from public.vibe_interests vi
      where vi.vibe_id = v.id and vi.status = 'confirmed'
    ) as confirmed_count
  from public.vibes v
  left join public.profiles h on h.id = v.host_id
  where v.id = p_id;
$$;
revoke all on function public.public_vibe(uuid) from public;
grant execute on function public.public_vibe(uuid) to anon, authenticated;

-- SUPERSEDED 2026-06-28: duplicate recommended_vibes (functionally identical to
-- the canonical copy in recommended-vibes.sql). Wrapped (drop INCLUDED) so this
-- privacy-prepare migration is re-runnable without touching the live function.
-- (vibe_directory / vibe_private_logistics / public_vibe above remain ACTIVE.)
/*
drop function if exists public.recommended_vibes(int);
create function public.recommended_vibes(p_limit int default 6)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  photos text[],
  city text,
  area text,
  country text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  match_score int
)
language sql security definer set search_path = public stable as $$
  with me as (
    select id, home_city
    from public.profiles
    where id = auth.uid()
  )
  select
    v.id, v.host_id, v.title, v.category, v.photos,
    v.city, v.area, v.country, v.starts_at, v.capacity,
    v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status = 'open'
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    and not exists (
      select 1
      from public.vibe_interests vi
      where vi.vibe_id = v.id and vi.user_id = m.id
    )
    and not exists (
      select 1
      from public.vibe_feedback vf
      where vf.vibe_id = v.id
        and vf.user_id = m.id
        and vf.signal = 'not_for_me'
    )
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$$;
revoke all on function public.recommended_vibes(int) from public, anon;
grant execute on function public.recommended_vibes(int) to authenticated;
*/

commit;


-- ═══════════════════════════════════════════════════════════════════
-- [5] recommended-vibes.sql
-- ═══════════════════════════════════════════════════════════════════

-- Vibe match scoring + "Picked for you". Run the whole file in the Supabase SQL
-- editor AFTER vibe-eligibility-enforce.sql (recommended_vibes filters through
-- vibe_eligible). Safe to re-run.
--
-- vibe_match(user, vibe) -> 0-100, how well an open Vibe fits a user's profile:
--   0.35 category fit   - does the Vibe's category match something you do?
--   0.25 vibe-tag fit   - event tags (chill/social/party…) vs your activity vibe
--   0.12 skill fit      - required skill vs your skill in that activity
--   0.13 social fit     - how social the event reads vs your activity-social pref
--   0.15 review fit     - do you tend to recommend Vibes like this? (vibe_review_fit)
-- Used by both the "X% your vibe" card badge and the "Picked for you" ranking.
-- The review-fit term (2026-07-02) was ported from the tombstoned copy in
-- vibe-review-preferences.sql; the other four weights were rescaled from
-- 0.40/0.30/0.15/0.15 so the five still sum to 1.0.

create or replace function public.vibe_match(p_user uuid, p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare
  pr public.profiles%rowtype;
  v public.vibes%rowtype;
  cat_fit numeric; tag_fit numeric; skill_fit numeric; social_fit numeric; review_fit numeric;
  n_tags int; n_match int; event_social int; matched_skill int;
  v_cats text[];
begin
  select * into pr from public.profiles where id = p_user;
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return null; end if;

  -- category / activity fit - best match of the user's activities against ANY of
  -- the Vibe's categories (multi-select), falling back to the single primary
  -- `category` for older vibes. 'other' is dropped as it carries no signal.
  v_cats := array(
    select c
    from unnest(coalesce(nullif(v.categories, '{}'), array[v.category])) c
    where c is not null and c <> 'other'
  );
  if coalesce(array_length(pr.activities, 1), 0) = 0 or coalesce(array_length(v_cats, 1), 0) = 0 then
    cat_fit := 0.5;
  elsif exists (
    select 1
    from unnest(pr.activities) a
    cross join unnest(v_cats) c
    where lower(a) like '%' || lower(c) || '%'
  ) then
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

-- "Picked for you": upcoming open Vibes in your city you don't host / haven't
-- shown interest in, ranked by vibe_match.
drop function if exists public.recommended_vibes(int);
create or replace function public.recommended_vibes(p_limit int default 6)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  photos text[],
  city text,
  area text,
  country text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  match_score int
)
language sql security definer set search_path = public stable as $$
  with me as (select id, home_city from public.profiles where id = auth.uid())
  select
    v.id, v.host_id, v.title, v.category, v.photos, v.city, v.area, v.country,
    v.starts_at, v.capacity, v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status = 'open'
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    and not exists (
      select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = m.id
    )
    and not exists (
      select 1 from public.vibe_feedback vf
      where vf.vibe_id = v.id and vf.user_id = m.id and vf.signal = 'not_for_me'
    )
    -- never recommend a vibe whose host prefs (gender/age) exclude the viewer
    and public.vibe_eligible(m.id, v.id)
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$$;
grant execute on function public.recommended_vibes(int) to authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- [6] vibe-tomorrow-reminder.sql
-- ═══════════════════════════════════════════════════════════════════

-- "Your Vibe is tomorrow" reminder. Hourly pg_cron: for each upcoming Vibe that
-- starts in ~20-28h, notify every CONFIRMED attendee once, then stamp the Vibe
-- so it never fires again. The wide 20-28h window guarantees at least one hourly
-- tick lands inside it; the `starting_soon_reminded_at` stamp guarantees exactly
-- one reminder per Vibe. Emailed via the existing notifications trigger
-- (vibe_starting_soon is in the EMAILABLE map). Run in the Supabase SQL editor.
-- Safe to re-run.

alter table public.vibes add column if not exists starting_soon_reminded_at timestamptz;

create or replace function public.send_vibe_tomorrow_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare r record; m record;
begin
  for r in
    select * from public.vibes
    where starting_soon_reminded_at is null
      and status <> 'cancelled'
      and starts_at >= now() + interval '20 hours'
      and starts_at <= now() + interval '28 hours'
  loop
    for m in
      select user_id from public.vibe_interests
      where vibe_id = r.id and status = 'confirmed'
    loop
      perform public.notify(
        m.user_id, 'vibe_starting_soon',
        'Your Vibe is tomorrow: ' || r.title,
        'It kicks off soon - open the chat to coordinate with your group.',
        jsonb_build_object('vibe_id', r.id, 'href', '/vibes/' || r.id || '/chat'));
    end loop;
    update public.vibes set starting_soon_reminded_at = now() where id = r.id;
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-vibe-tomorrow'); exception when others then null; end $$;
select cron.schedule('flockie-vibe-tomorrow', '0 * * * *', $$ select public.send_vibe_tomorrow_reminders(); $$);


-- ═══════════════════════════════════════════════════════════════════
-- [7] unread-message-email.sql
-- ═══════════════════════════════════════════════════════════════════

-- "New messages while you were away" nudge (throttled). Runs every 15 min and
-- inserts ONE `unread_messages` notification per (recipient, chat) that is
-- emailed via the existing notifications trigger (unread_messages is in the
-- EMAILABLE map). Run in the Supabase SQL editor. Safe to re-run.
--
-- THROTTLE / ANTI-SPAM DESIGN (deliberately conservative - under-notify rather
-- than spam a live conversation):
--   1. Unread is measured against chat_reads.last_read_at (the per-(user,chat)
--      read cursor written by mark_chat_read). Messages the user sent are never
--      counted as unread against themselves.
--   2. We only fire when the NEWEST unread message is already >15 min old. That
--      means the chat has gone quiet for 15 min, so we never email mid-thread
--      while people are actively typing.
--   3. We only fire for recipients who are AWAY: auth.users.last_sign_in_at is
--      older than 1 hour (no recent fresh session). Someone who just signed in
--      would have seen the badge, so we skip them.
--   4. Hard dedupe: skip if ANY unread_messages notification for that
--      (user, chat) was created in the last 4 hours. So a chat can nudge a given
--      user at most once every 4h no matter how many messages arrive - never
--      per-message.
-- Membership: vibe chats -> host + confirmed attendees; buddy chats -> both
-- sides of the match. chat_reads.chat_id spans both chat tables.

create or replace function public.send_unread_message_emails()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    with vibe_members as (
      -- host + every confirmed attendee is a member of the vibe's chat
      select vc.id as chat_id, v.id as vibe_id, v.title as vibe_title, mem.user_id as recipient
      from public.vibing_chats vc
      join public.vibes v on v.id = vc.vibe_id and v.status <> 'cancelled'
      join lateral (
        select v.host_id as user_id
        union
        select vi.user_id from public.vibe_interests vi
        where vi.vibe_id = v.id and vi.status = 'confirmed'
      ) mem on true
    ),
    buddy_members as (
      select bc.id as chat_id, mem.user_id as recipient
      from public.buddy_chats bc
      join public.buddy_matches bm on bm.id = bc.match_id
      join lateral (
        select bm.user_a as user_id union select bm.user_b
      ) mem on true
    ),
    vibe_unread as (
      select vm.recipient, vm.chat_id, vm.vibe_id, vm.vibe_title, true as is_vibe,
             count(*) as n_unread, max(msg.created_at) as latest_unread
      from vibe_members vm
      left join public.chat_reads cr on cr.user_id = vm.recipient and cr.chat_id = vm.chat_id
      join public.vibing_messages msg
        on msg.chat_id = vm.chat_id
       and msg.sender_id <> vm.recipient
       and msg.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
      group by vm.recipient, vm.chat_id, vm.vibe_id, vm.vibe_title
    ),
    buddy_unread as (
      select bm.recipient, bm.chat_id, null::uuid as vibe_id, null::text as vibe_title, false as is_vibe,
             count(*) as n_unread, max(msg.created_at) as latest_unread
      from buddy_members bm
      left join public.chat_reads cr on cr.user_id = bm.recipient and cr.chat_id = bm.chat_id
      join public.buddy_messages msg
        on msg.chat_id = bm.chat_id
       and msg.sender_id <> bm.recipient
       and msg.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
      group by bm.recipient, bm.chat_id
    ),
    all_unread as (
      select * from vibe_unread
      union all
      select * from buddy_unread
    )
    select au.recipient, au.chat_id, au.vibe_id, au.vibe_title, au.is_vibe, au.n_unread
    from all_unread au
    join auth.users u on u.id = au.recipient
    where au.latest_unread < now() - interval '15 minutes'          -- chat went quiet
      and u.last_sign_in_at < now() - interval '1 hour'             -- recipient is away
      and not exists (                                             -- 4h per-chat throttle
        select 1 from public.notifications n
        where n.user_id = au.recipient
          and n.type = 'unread_messages'
          and (n.data ->> 'chat_id') = au.chat_id::text
          and n.created_at > now() - interval '4 hours'
      )
  loop
    perform public.notify(
      r.recipient, 'unread_messages',
      case when r.is_vibe then 'New messages in ' || coalesce(r.vibe_title, 'your Vibe')
           else 'You have new messages' end,
      'You have ' || r.n_unread || ' unread message'
        || case when r.n_unread = 1 then '' else 's' end || ' waiting - jump back in.',
      jsonb_build_object(
        'chat_id', r.chat_id,
        'href', case when r.is_vibe then '/vibes/' || r.vibe_id || '/chat'
                     else '/buddies/' || r.chat_id end));
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-unread-messages'); exception when others then null; end $$;
select cron.schedule('flockie-unread-messages', '*/15 * * * *', $$ select public.send_unread_message_emails(); $$);


-- ═══════════════════════════════════════════════════════════════════
-- [8] weekly-digest.sql
-- ═══════════════════════════════════════════════════════════════════

-- Weekly "Vibes near you" digest (Tier-3, opt-outable). Once a week, for each
-- eligible user, pick their top upcoming Vibes this week and insert ONE
-- `weekly_digest` notification, emailed via the existing notifications trigger
-- (weekly_digest is in the EMAILABLE map). Run in the Supabase SQL editor.
-- Safe to re-run.
--
-- OPT-OUT: there is no separate marketing-consent flag in `profiles` today, so
-- we gate on the two existing switches:
--   * email_notifications  - the email opt-out honoured by /api/email/notify.
--   * notifications_enabled - the master in-app switch enforced by notify().
-- Users with EITHER turned off get neither the in-app card nor the email. When a
-- dedicated marketing opt-in is added later, AND it into the WHERE below.
--
-- ONE email per user per week: the weekly cadence plus a 6-day NOT EXISTS guard
-- (so a manual re-run within the week can't double-send).

create or replace function public.send_weekly_digest()
returns void language plpgsql security definer set search_path = public as $$
declare u record; titles text[]; n int;
begin
  for u in
    select p.id, p.home_city
    from public.profiles p
    join auth.users au on au.id = p.id
    where coalesce(p.email_notifications, true)
      and coalesce(p.notifications_enabled, true)
      and p.home_city is not null
      and au.email is not null
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'weekly_digest'
          and n.created_at > now() - interval '6 days'
      )
  loop
    -- Top upcoming open Vibes in the user's city this week that they don't host,
    -- haven't engaged with, and aren't excluded from - ranked by vibe_match.
    -- (Mirrors recommended_vibes(), but keyed to u.id instead of auth.uid().)
    select array_agg(t.title order by t.rn), max(t.rn)
      into titles, n
    from (
      select v.title,
             row_number() over (order by public.vibe_match(u.id, v.id) desc nulls last, v.starts_at asc) as rn
      from public.vibes v
      where v.status = 'open'
        and v.starts_at > now()
        and v.starts_at < now() + interval '7 days'
        and v.host_id <> u.id
        and lower(v.city) = lower(u.home_city)
        and not exists (
          select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = u.id
        )
        and not exists (
          select 1 from public.vibe_feedback vf
          where vf.vibe_id = v.id and vf.user_id = u.id and vf.signal = 'not_for_me'
        )
        and public.vibe_eligible(u.id, v.id)
      order by public.vibe_match(u.id, v.id) desc nulls last, v.starts_at asc
      limit 3
    ) t;

    if n is not null and n > 0 then
      perform public.notify(
        u.id, 'weekly_digest',
        n || ' Vibe' || case when n = 1 then '' else 's' end
          || ' in ' || u.home_city || ' this week',
        'Picked for you: ' || array_to_string(titles, ', ') || '.',
        jsonb_build_object('href', '/vibes', 'count', n));
    end if;
  end loop;
end $$;

-- Thursdays 15:00 UTC (late-morning US / evening EU - a "plan your week" nudge).
do $$ begin perform cron.unschedule('flockie-weekly-digest'); exception when others then null; end $$;
select cron.schedule('flockie-weekly-digest', '0 15 * * 4', $$ select public.send_weekly_digest(); $$);


-- ═══════════════════════════════════════════════════════════════════
-- [9] onboarding-vibe-check.sql
-- ═══════════════════════════════════════════════════════════════════

-- Additive migration for the profile-build + five-question vibe onboarding.
alter table public.profiles
  add column if not exists birthday date,
  add column if not exists vibe_scores jsonb,
  add column if not exists archetype text check (
    archetype is null or archetype in ('culture', 'social', 'night', 'food', 'adventure', 'wellness')
  ),
  add column if not exists vibe_completed_at timestamptz;

create table if not exists public.vibe_responses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  answered_at timestamptz not null default now(),
  unique (profile_id, question_id)
);

alter table public.vibe_responses enable row level security;

drop policy if exists "users read own vibe responses" on public.vibe_responses;
create policy "users read own vibe responses"
  on public.vibe_responses for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "users insert own vibe responses" on public.vibe_responses;
create policy "users insert own vibe responses"
  on public.vibe_responses for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "users update own vibe responses" on public.vibe_responses;
create policy "users update own vibe responses"
  on public.vibe_responses for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Without this, restartVibeCheck's delete silently removes 0 rows (RLS deny is
-- not an error), so "Retake quiz" re-completes from the old answers.
drop policy if exists "users delete own vibe responses" on public.vibe_responses;
create policy "users delete own vibe responses"
  on public.vibe_responses for delete
  to authenticated
  using (auth.uid() = profile_id);
