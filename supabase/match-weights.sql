-- 3-form weighted compatibility: personality vibe quiz + trip vibe + activity
-- vibe. Replaces the trip-only buddy_pair_score. Only the forms BOTH people
-- have filled count, then weights are renormalized --- so a missing form doesn't
-- unfairly tank the score. Run in the Supabase SQL editor. Safe to re-run.
--
-- Weights (of the components present): Personality 0.40 -- Trip 0.35 -- Activity 0.25.

create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  -- trip
  s numeric := 0; n int := 0; slider numeric; inter int; uni int; tagj numeric;
  trip_sim numeric; trip_w numeric := 0;
  -- personality
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
  pers_sim numeric; pers_w numeric := 0;
  -- activity
  a_inter int; a_uni int; parts numeric := 0; parts_n int := 0; si numeric := 0; si_n int := 0;
  act_sim numeric; act_w numeric := 0;
  -- blend
  total numeric; wsum numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;

  -- ------ Trip vibe: 6 sliders (60%) + trip_vibe tag Jaccard (40%) ------
  if ra.planning is not null and rb.planning is not null then s := s + (1 - abs(ra.planning - rb.planning)/4.0); n := n+1; end if;
  if ra.pace is not null and rb.pace is not null then s := s + (1 - abs(ra.pace - rb.pace)/4.0); n := n+1; end if;
  if ra.social_energy is not null and rb.social_energy is not null then s := s + (1 - abs(ra.social_energy - rb.social_energy)/4.0); n := n+1; end if;
  if ra.budget is not null and rb.budget is not null then s := s + (1 - abs(ra.budget - rb.budget)/4.0); n := n+1; end if;
  if ra.nightlife is not null and rb.nightlife is not null then s := s + (1 - abs(ra.nightlife - rb.nightlife)/4.0); n := n+1; end if;
  if ra.adventurousness is not null and rb.adventurousness is not null then s := s + (1 - abs(ra.adventurousness - rb.adventurousness)/4.0); n := n+1; end if;

  select count(*) into inter from unnest(coalesce(ra.trip_vibe,'{}')) t where t = any(coalesce(rb.trip_vibe,'{}'));
  select cardinality(array(select distinct unnest(coalesce(ra.trip_vibe,'{}') || coalesce(rb.trip_vibe,'{}')))) into uni;

  if n > 0 then
    slider := s / n;
    tagj := case when uni > 0 then inter::numeric / uni else 0.5 end;
    trip_sim := 0.6 * slider + 0.4 * tagj;
    trip_w := 0.35;
  elsif uni > 0 then
    trip_sim := inter::numeric / uni;
    trip_w := 0.35;
  end if;

  -- ------ Personality: cosine similarity of the 6-dim vibe_scores ------
  if ra.vibe_scores is not null and rb.vibe_scores is not null then
    foreach d in array dims loop
      av := coalesce((ra.vibe_scores ->> d)::float, 0);
      bv := coalesce((rb.vibe_scores ->> d)::float, 0);
      dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
    end loop;
    if na > 0 and nb > 0 then
      pers_sim := dot / (sqrt(na) * sqrt(nb));
      pers_w := 0.40;
    end if;
  end if;

  -- ------ Activity: activities Jaccard + activity_vibe Jaccard + social/intensity ------
  if coalesce(array_length(ra.activities,1),0) > 0 and coalesce(array_length(rb.activities,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activities) t where t = any(rb.activities);
    select cardinality(array(select distinct unnest(ra.activities || rb.activities))) into a_uni;
    parts := parts + (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); parts_n := parts_n + 1;
  end if;
  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activity_vibe) t where t = any(rb.activity_vibe);
    select cardinality(array(select distinct unnest(ra.activity_vibe || rb.activity_vibe))) into a_uni;
    parts := parts + (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); parts_n := parts_n + 1;
  end if;
  if ra.activity_social is not null and rb.activity_social is not null then si := si + (1 - abs(ra.activity_social - rb.activity_social)/4.0); si_n := si_n + 1; end if;
  if ra.activity_intensity is not null and rb.activity_intensity is not null then si := si + (1 - abs(ra.activity_intensity - rb.activity_intensity)/4.0); si_n := si_n + 1; end if;
  if si_n > 0 then parts := parts + si / si_n; parts_n := parts_n + 1; end if;
  if parts_n > 0 then
    act_sim := parts / parts_n;
    act_w := 0.25;
  end if;

  -- ------ Weighted blend over the components both people have ------
  wsum := pers_w + trip_w + act_w;
  if wsum = 0 then return 50; end if; -- no shared data --- neutral
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;

grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

-- Recompute persisted match scores with the new formula.
update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);

-- ------ Personality cosine helper (reused by the vibe-room ranking) ------
-- 6-dim cosine similarity of two vibe_scores blobs (0..1), or null if missing.
create or replace function public.vibe_cosine(a jsonb, b jsonb)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
begin
  if a is null or b is null then return null; end if;
  foreach d in array dims loop
    av := coalesce((a ->> d)::float, 0);
    bv := coalesce((b ->> d)::float, 0);
    dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
  end loop;
  if na = 0 or nb = 0 then return null; end if;
  return dot / (sqrt(na) * sqrt(nb));
end $$;
grant execute on function public.vibe_cosine(jsonb, jsonb) to authenticated;

-- ------ rank_vibe: now also weights the personality vibe (candidate --- host) ------
-- Weights: skill 0.30 -- event-vibe tags 0.25 -- personality 0.20 -- trip sliders
-- 0.15 -- base 0.05 -- diversity 0.05.
create or replace function public.rank_vibe(p_vibe uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v public.vibes;
  v_confirmed int;
  v_remaining int;
  v_invited int := 0;
  v_standby int := 0;
  c record;
  rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can run matching'; end if;

  select count(*) into v_confirmed
    from public.vibe_interests where vibe_id = p_vibe and status = 'confirmed';
  v_remaining := greatest(v.capacity - v_confirmed, 0);

  for c in
    select vi.user_id,
      (
        0.30 * (
          case when v.required_skill_level is null then 0.7
          else coalesce((
            select max(1 - abs(((p.activity_skills ->> k)::int) - v.required_skill_level)::float / 4)
            from jsonb_object_keys(coalesce(p.activity_skills, '{}'::jsonb)) as k
            where lower(k) like '%' || lower(v.category) || '%'
          ), 0.3) end
        )
        + 0.25 * (
          case when array_length(v.event_vibe_tags, 1) is null then 0.5
          else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags, 1)
            from unnest(v.event_vibe_tags) t
            where exists (
              select 1 from unnest(coalesce(p.trip_vibe,'{}') || coalesce(p.activity_vibe,'{}')) uv
              where lower(uv) like '%' || lower(t) || '%'
            )
          ), 0.0) end
        )
        + 0.20 * coalesce(public.vibe_cosine(p.vibe_scores, h.vibe_scores), 0.5)
        + 0.15 * (
          case when p.planning is null or h.planning is null then 0.5
          else 1 - (
            (abs(p.planning - h.planning) + abs(p.pace - h.pace)
             + abs(p.social_energy - h.social_energy) + abs(p.budget - h.budget)
             + abs(p.nightlife - h.nightlife) + abs(p.adventurousness - h.adventurousness)
            )::float / 24
          ) end
        )
        + 0.05 * 0.8
        + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      )
      * (case when p.ghost_penalty_until is not null and p.ghost_penalty_until > now() then 0.85 else 1 end)
      * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id = p_vibe and vi.status = 'interested'
    order by score desc
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining then
      update public.vibe_interests
        set status = 'invited', match_score = c.score,
            invitation_sent_at = now(), invitation_expires_at = now() + interval '24 hours'
        where vibe_id = p_vibe and user_id = c.user_id;
      insert into public.notifications (user_id, type, title, body, data)
        values (c.user_id, 'vibe_invitation', 'You''re invited to ' || v.title,
                'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
      v_invited := v_invited + 1;
    else
      update public.vibe_interests
        set status = 'standby', match_score = c.score
        where vibe_id = p_vibe and user_id = c.user_id;
      insert into public.notifications (user_id, type, title, body, data)
        values (c.user_id, 'vibe_standby', v.title || ' filled with a specific vibe',
                'Here are events that match yours better.', jsonb_build_object('vibe_id', p_vibe));
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status = 'ranking' where id = p_vibe;
  return jsonb_build_object('invited', v_invited, 'standby', v_standby);
end $$;
grant execute on function public.rank_vibe(uuid) to authenticated;
