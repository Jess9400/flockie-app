-- New screenshot-derived traits + their matching terms. Run in the Supabase SQL
-- editor after match-priorities.sql. Safe to re-run.
--
-- Adds three columns and folds them into the activity side of the pair score:
--   social_style        1..5   "walking into a room of strangers" (extroversion)
--   activity_motivation text    why you go out: people | activity | company
--   initiator           text    starts | joins the plan (matched complementarily)

alter table public.profiles
  add column if not exists social_style int check (social_style between 1 and 5),
  add column if not exists activity_motivation text check (activity_motivation in ('people','activity','company')),
  add column if not exists initiator text check (initiator in ('starter','joiner'));

-- Re-create the weighted pair score with the three new activity signals added.
-- (Same body as match-priorities.sql, plus the social_style / motivation /
-- initiator terms in the activity block.)
create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  prio text[];
  aprio text[];
  s numeric := 0; w numeric := 0; ww numeric; inter int; uni int; tagj numeric;
  slider numeric; tag_w numeric; trip_sim numeric; trip_w numeric := 0;
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
  cos numeric; pers_sim numeric; pers_w numeric := 0;
  a_inter int; a_uni int; parts numeric := 0; pw numeric := 0; pwi numeric;
  act_sim numeric; act_w numeric := 0;
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
    tag_w := case when 'interests' = any(prio) then 0.5 else 0.4 end;
    trip_sim := (1 - tag_w) * slider + tag_w * tagj;
    trip_w := 0.35;
  elsif uni > 0 then
    trip_sim := inter::numeric / uni;
    trip_w := 0.35;
  end if;

  -- ----- Personality: 6-dim cosine, rescaled -----
  if ra.vibe_scores is not null and rb.vibe_scores is not null then
    foreach d in array dims loop
      av := coalesce((ra.vibe_scores ->> d)::float, 0);
      bv := coalesce((rb.vibe_scores ->> d)::float, 0);
      dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
    end loop;
    if na > 0 and nb > 0 then
      cos := dot / (sqrt(na) * sqrt(nb));
      pers_sim := greatest(0, least(1, (cos - 0.55) / 0.45));
      pers_w := 0.40;
    end if;
  end if;

  -- ----- Activity: interests + vibe + social + intensity + new traits --------
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
  -- room-of-strangers extroversion: closer = better
  if ra.social_style is not null and rb.social_style is not null then
    parts := parts + (1 - abs(ra.social_style - rb.social_style)/4.0); pw := pw + 1;
  end if;
  -- motivation: same reason for going out scores best
  if ra.activity_motivation is not null and rb.activity_motivation is not null then
    parts := parts + (case when ra.activity_motivation = rb.activity_motivation then 1 else 0.5 end); pw := pw + 1;
  end if;
  -- initiator: a starter pairs best with a joiner (complementary)
  if ra.initiator is not null and rb.initiator is not null then
    parts := parts + (case when ra.initiator <> rb.initiator then 1.0
                           when ra.initiator = 'joiner' then 0.8 else 0.6 end); pw := pw + 1;
  end if;
  if pw > 0 then
    act_sim := parts / pw;
    act_w := 0.25;
  end if;

  wsum := pers_w + trip_w + act_w;
  if wsum = 0 then return 50; end if;
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);
