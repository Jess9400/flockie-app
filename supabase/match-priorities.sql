-- Per-user match weighting + hard dealbreaker filters. Run in the Supabase SQL
-- editor. Safe to re-run.
--
-- Two upgrades the matching algo needs to actually differentiate people:
--   1. WEIGHTS  — each user picks the 2-3 things that matter most to them.
--      Those dimensions count ~2x in THEIR ranking, so a budget-obsessed
--      traveler and a budget-agnostic one no longer get the same score.
--   2. FILTERS  — the dealbreakers we already collect (same-gender, sober)
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
-- Weights are taken from p_a (the viewer) — "what matters to ME when ranking
-- you." A prioritized dimension counts 2x; everything else counts 1x, then the
-- block is renormalized so the total still sums to 1.
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
  if wsum = 0 then return 50; end if; -- no shared data — neutral
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

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
    and exists (select 1 from unnest(coalesce(ct.destinations,'{}')) a
                join unnest(coalesce(me_t.destinations,'{}')) b on lower(a)=lower(b))
    and (greatest(ct.start_date, me_t.start_date) - least(ct.end_date, me_t.end_date)) <= 30
    and cp.onboarding_complete
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int, text, uuid) to authenticated;

-- ── 5. Activity discovery deck: add the same hard filter ─────────────────────
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

-- ── 6. Recompute persisted pair scores with the new formula ──────────────────
update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);
