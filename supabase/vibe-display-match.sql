-- Card-only Vibe match display. This intentionally does NOT replace
-- public.vibe_match(), which remains the conservative ranking score used by
-- recommendation ordering and the host's matching flow.
--
-- The display score normalizes across direct signals that are actually known
-- for both the viewer and the Vibe. A user with no reviews is not penalized,
-- and an event with no category/tag detail shows as a "new pick" instead of a
-- misleading percentage.

create or replace function public.vibe_display_match(p_user uuid, p_vibe uuid)
returns table (
  score int,
  state text,
  signal_count int,
  category_fit int,
  tag_fit int,
  social_fit int,
  skill_fit int,
  review_fit int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  pr public.profiles%rowtype;
  v public.vibes%rowtype;
  v_categories text[];
  category_value numeric;
  tag_value numeric;
  social_value numeric;
  skill_value numeric;
  review_value numeric;
  category_weight numeric := 0;
  tag_weight numeric := 0;
  social_weight numeric := 0;
  skill_weight numeric := 0;
  review_weight numeric := 0;
  total_weight numeric;
  event_social int;
  matching_skill int;
  tag_count int;
  tag_matches int;
  positive_reviews int;
  known_count int := 0;
begin
  if auth.uid() is distinct from p_user then
    raise exception 'You can only view your own Vibe display match';
  end if;

  select * into pr from public.profiles where id = p_user;
  select * into v from public.vibes where id = p_vibe;
  if pr.id is null or v.id is null then
    return;
  end if;

  v_categories := array(
    select category
    from unnest(coalesce(nullif(v.categories, '{}'), array[v.category])) category
    where category is not null and category <> 'other'
  );

  -- Category is only scored when both sides give us a real activity signal.
  if coalesce(array_length(pr.activities, 1), 0) > 0
    and coalesce(array_length(v_categories, 1), 0) > 0 then
    category_value := case when exists (
      select 1
      from unnest(pr.activities) activity
      cross join unnest(v_categories) category
      where lower(activity) like '%' || lower(category) || '%'
    ) then 1.0 else 0.2 end;
    category_weight := 0.45;
    known_count := known_count + 1;
  end if;

  -- Tags describe the feel of the event. No tags means no claim about fit.
  tag_count := coalesce(array_length(v.event_vibe_tags, 1), 0);
  if coalesce(array_length(pr.activity_vibe, 1), 0) > 0 and tag_count > 0 then
    select count(*) into tag_matches
    from unnest(v.event_vibe_tags) tag
    where lower(array_to_string(pr.activity_vibe, ' ')) like '%' || lower(tag) || '%';
    tag_value := tag_matches::numeric / tag_count;
    tag_weight := 0.30;
    known_count := known_count + 1;
  end if;

  -- Group/social fit requires an explicit event vibe tag and a viewer preference.
  if pr.activity_social is not null and tag_count > 0 then
    event_social := case
      when exists (select 1 from unnest(v.event_vibe_tags) tag where tag in ('party', 'social', 'energetic')) then 5
      when exists (select 1 from unnest(v.event_vibe_tags) tag where tag in ('quiet', 'chill')) then 2
      else 3
    end;
    social_value := 1 - abs(event_social - pr.activity_social)::numeric / 4;
    social_weight := 0.15;
    known_count := known_count + 1;
  end if;

  -- Skill matters only when the event requires one and the viewer supplied one.
  if v.required_skill_level is not null then
    select case
      when (pr.activity_skills ->> activity) ~ '^[0-9]+$'
        then (pr.activity_skills ->> activity)::int
    end into matching_skill
    from unnest(coalesce(pr.activities, '{}')) activity
    cross join unnest(v_categories) category
    where lower(activity) like '%' || lower(category) || '%'
      and pr.activity_skills ? activity
    limit 1;

    if matching_skill is not null then
      skill_value := 1 - abs(v.required_skill_level - matching_skill)::numeric / 4;
      skill_weight := 0.05;
      known_count := known_count + 1;
    end if;
  end if;

  -- Reviews become a small, earned signal only after the person has feedback.
  select count(*) into positive_reviews
  from public.vibe_reviews
  where reviewer_id = p_user and recommend;
  if positive_reviews > 0 then
    review_value := public.vibe_review_fit(p_user, p_vibe);
    review_weight := 0.05;
    known_count := known_count + 1;
  end if;

  if known_count < 2 then
    return query select null::int, 'new_pick'::text, known_count,
      null::int, null::int, null::int, null::int, null::int;
    return;
  end if;

  total_weight := category_weight + tag_weight + social_weight + skill_weight + review_weight;

  return query select
    round(100 * (
      coalesce(category_value, 0) * category_weight
      + coalesce(tag_value, 0) * tag_weight
      + coalesce(social_value, 0) * social_weight
      + coalesce(skill_value, 0) * skill_weight
      + coalesce(review_value, 0) * review_weight
    ) / total_weight)::int,
    'scored'::text,
    known_count,
    case when category_weight > 0 then round(100 * category_value)::int end,
    case when tag_weight > 0 then round(100 * tag_value)::int end,
    case when social_weight > 0 then round(100 * social_value)::int end,
    case when skill_weight > 0 then round(100 * skill_value)::int end,
    case when review_weight > 0 then round(100 * review_value)::int end;
end;
$$;

grant execute on function public.vibe_display_match(uuid, uuid) to authenticated;

create or replace function public.vibe_display_match_scores(p_ids uuid[])
returns table (vibe_id uuid, score int, state text)
language sql
security definer
set search_path = public
stable
as $$
  select v.id, match.score, match.state
  from public.vibes v
  cross join lateral public.vibe_display_match(auth.uid(), v.id) match
  where v.id = any(p_ids);
$$;

grant execute on function public.vibe_display_match_scores(uuid[]) to authenticated;
