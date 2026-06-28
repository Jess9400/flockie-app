-- Stage 3: a user's positive Vibe reviews feed back into matching.
-- Run in the Supabase SQL editor AFTER vibe-extra-fields.sql. Safe to re-run.
--
-- Signal: a review with recommend = true (a 👍 / "rated it well") means "more
-- like this". vibe_review_fit(user, vibe) returns 0..1 for how much a vibe's
-- category/tags match what that user has liked before. It's folded into:
--   * vibe_match        — "Picked for you" + the "% your vibe" badge
--   * _rank_vibe_core   — the host's ranked invitations
--   * invite_city_fallback — same-city cold invites (also adds an age filter)

create or replace function public.vibe_review_fit(p_user uuid, p_vibe uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare v_cat text; v_tags text[]; n_liked int; cat_liked numeric; tag_liked numeric; n_tags int; n_match int;
begin
  select category, event_vibe_tags into v_cat, v_tags from public.vibes where id = p_vibe;

  select count(*) into n_liked from public.vibe_reviews r where r.reviewer_id = p_user and r.recommend;
  if n_liked = 0 then return 0.5; end if;  -- neutral for users with no positive reviews yet

  cat_liked := case when exists (
    select 1 from public.vibe_reviews r join public.vibes rv on rv.id = r.vibe_id
    where r.reviewer_id = p_user and r.recommend
      and rv.category is not null and lower(rv.category) = lower(coalesce(v_cat, ''))
  ) then 1 else 0 end;

  n_tags := coalesce(array_length(v_tags, 1), 0);
  if n_tags = 0 then
    tag_liked := 0;
  else
    select count(distinct tg) into n_match
    from unnest(v_tags) tg
    where exists (
      select 1 from public.vibe_reviews r join public.vibes rv on rv.id = r.vibe_id
      where r.reviewer_id = p_user and r.recommend and tg = any(coalesce(rv.event_vibe_tags, '{}'))
    );
    tag_liked := n_match::numeric / n_tags;
  end if;

  return least(1.0, 0.6 * cat_liked + 0.4 * tag_liked);
end $$;
grant execute on function public.vibe_review_fit(uuid, uuid) to authenticated;

-- ── vibe_match: add a 0.15 review-fit term (re-weights the others) ──────────
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

  if coalesce(array_length(pr.activities, 1), 0) = 0 or v.category is null or v.category = 'other' then
    cat_fit := 0.5;
  elsif exists (select 1 from unnest(pr.activities) a where lower(a) like '%' || lower(v.category) || '%') then
    cat_fit := 1.0;
  else
    cat_fit := 0.2;
  end if;

  n_tags := coalesce(array_length(v.event_vibe_tags, 1), 0);
  if n_tags = 0 or coalesce(array_length(pr.activity_vibe, 1), 0) = 0 then
    tag_fit := 0.5;
  else
    select count(*) into n_match
    from unnest(v.event_vibe_tags) tg
    where lower(array_to_string(pr.activity_vibe, ' ')) like '%' || lower(tg) || '%';
    tag_fit := n_match::numeric / n_tags;
  end if;

  if v.required_skill_level is null then
    skill_fit := 1.0;
  else
    select (pr.activity_skills->>a)::int into matched_skill
    from unnest(pr.activities) a
    where lower(a) like '%' || lower(v.category) || '%' and pr.activity_skills ? a
    limit 1;
    if matched_skill is null then skill_fit := 0.5;
    else skill_fit := 1 - abs(v.required_skill_level - matched_skill)::numeric / 4; end if;
  end if;

  event_social := case
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('party', 'social', 'energetic')) then 5
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('quiet', 'chill')) then 2
    else 3
  end;
  if pr.activity_social is null then social_fit := 0.5;
  else social_fit := 1 - abs(event_social - pr.activity_social)::numeric / 4; end if;

  review_fit := public.vibe_review_fit(p_user, p_vibe);

  return round(100 * (0.35 * cat_fit + 0.25 * tag_fit + 0.12 * skill_fit + 0.13 * social_fit + 0.15 * review_fit));
end $$;
grant execute on function public.vibe_match(uuid, uuid) to authenticated;

-- SUPERSEDED: canonical _rank_vibe_core is in supabase/vibe-v2-private-link.sql
-- (live shortlist→host-review flow). This older copy auto-invited. Wrapped out
-- 2026-06-28 — repo-only, no DB change. (vibe_review_fit above stays active.)
/*
-- ── _rank_vibe_core: fold review-fit into the host's ranking ────────────────
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
  perform public.backfill_vibe(p_vibe);
  perform public.invite_city_fallback(p_vibe);
  return jsonb_build_object('invited', v_invited, 'standby', v_standby);
end $$;
grant execute on function public._rank_vibe_core(uuid) to authenticated;
*/

-- ── invite_city_fallback: rank by review-fit too, and respect the age range ─
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_pool int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;

  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','invited','confirmed','standby');
  v_remaining := v.capacity - v_pool;
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
