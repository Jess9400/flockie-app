-- Canonical 1:1 Vibe matching. Run in the Supabase SQL editor.
-- Safe to re-run after vibe-review-stars.sql and vibe-v2-private-link.sql.
--
-- Cold start:
--   * 35% interests
--   * 25% activity style
--   * 20% preferred group size
--   * 10% reason for joining
--   * 10% adjustable Vibe traits
--
-- The raw onboarding fit is calibrated to a 55..90 display score. This is a
-- fit index, not a probability. It avoids presenting a lack of evidence as
-- incompatibility while still keeping genuinely weak pairs out of discovery.
--
-- Behavior gradually replaces onboarding evidence, up to 80% after both
-- people have at least 10 explicit Vibe choices. Only deliberate actions count:
-- self-expressed interest, confirmation, Not for me, and a Vibe review.
-- Automated invitations and passive browsing do not count.
--
-- Location, availability, safety rules, and hard dealbreakers stay outside the
-- percentage. Candidate RPCs use those as eligibility filters before scoring.

-- Distinguish a user's own interest from an algorithm-created shortlist.
alter table public.vibe_interests
  add column if not exists source text not null default 'algo';

alter table public.vibe_interests
  drop constraint if exists vibe_interests_source_check;
alter table public.vibe_interests
  add constraint vibe_interests_source_check
  check (source in ('algo', 'private', 'self'));

-- An algorithm-created row never starts as interested, so this safely records
-- the origin of existing fresh interest rows. Older rows already moved to
-- another status remain unchanged rather than being guessed.
update public.vibe_interests
set source = 'self'
where source = 'algo' and status = 'interested';

create index if not exists vibe_interests_user_source_status_vibe_idx
  on public.vibe_interests (user_id, source, status, vibe_id);
create index if not exists vibe_reviews_reviewer_rating_vibe_idx
  on public.vibe_reviews (reviewer_id, rating, vibe_id);

create or replace function public._buddy_interest_pair_fit(p_a text, p_b text)
returns numeric
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when p_a is null or p_b is null then 0
    when lower(p_a) = lower(p_b) then 1.00
    when array[lower(p_a), lower(p_b)] @> array['good_food', 'just_chilling'] then 0.65
    when array[lower(p_a), lower(p_b)] @> array['good_food', 'nightlife'] then 0.50
    when array[lower(p_a), lower(p_b)] @> array['good_food', 'deep_talks'] then 0.50
    when array[lower(p_a), lower(p_b)] @> array['good_food', 'board_games'] then 0.40
    when array[lower(p_a), lower(p_b)] @> array['live_music', 'nightlife'] then 0.80
    when array[lower(p_a), lower(p_b)] @> array['live_music', 'art_culture'] then 0.55
    when array[lower(p_a), lower(p_b)] @> array['live_music', 'creative_stuff'] then 0.75
    when array[lower(p_a), lower(p_b)] @> array['live_music', 'films_shows'] then 0.50
    when array[lower(p_a), lower(p_b)] @> array['getting_active', 'outdoors'] then 0.85
    when array[lower(p_a), lower(p_b)] @> array['getting_active', 'adventure'] then 0.80
    when array[lower(p_a), lower(p_b)] @> array['getting_active', 'nightlife'] then 0.35
    when array[lower(p_a), lower(p_b)] @> array['art_culture', 'creative_stuff'] then 0.90
    when array[lower(p_a), lower(p_b)] @> array['art_culture', 'films_shows'] then 0.70
    when array[lower(p_a), lower(p_b)] @> array['art_culture', 'deep_talks'] then 0.45
    when array[lower(p_a), lower(p_b)] @> array['nightlife', 'adventure'] then 0.35
    when array[lower(p_a), lower(p_b)] @> array['board_games', 'just_chilling'] then 0.70
    when array[lower(p_a), lower(p_b)] @> array['board_games', 'films_shows'] then 0.55
    when array[lower(p_a), lower(p_b)] @> array['board_games', 'deep_talks'] then 0.70
    when array[lower(p_a), lower(p_b)] @> array['outdoors', 'adventure'] then 0.90
    when array[lower(p_a), lower(p_b)] @> array['outdoors', 'just_chilling'] then 0.40
    when array[lower(p_a), lower(p_b)] @> array['just_chilling', 'films_shows'] then 0.70
    when array[lower(p_a), lower(p_b)] @> array['just_chilling', 'deep_talks'] then 0.75
    when array[lower(p_a), lower(p_b)] @> array['creative_stuff', 'films_shows'] then 0.65
    when array[lower(p_a), lower(p_b)] @> array['creative_stuff', 'deep_talks'] then 0.55
    when array[lower(p_a), lower(p_b)] @> array['films_shows', 'deep_talks'] then 0.60
    else 0
  end;
$$;

create or replace function public._buddy_style_pair_fit(p_a text, p_b text)
returns numeric
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when p_a is null or p_b is null then 0
    when lower(p_a) = lower(p_b) then 1.00
    when array[lower(p_a), lower(p_b)] @> array['chill', 'quiet'] then 0.90
    when array[lower(p_a), lower(p_b)] @> array['chill', 'creative'] then 0.65
    when array[lower(p_a), lower(p_b)] @> array['chill', 'social'] then 0.55
    when array[lower(p_a), lower(p_b)] @> array['chill', 'energetic'] then 0.25
    when array[lower(p_a), lower(p_b)] @> array['chill', 'party'] then 0.20
    when array[lower(p_a), lower(p_b)] @> array['social', 'energetic'] then 0.80
    when array[lower(p_a), lower(p_b)] @> array['social', 'party'] then 0.85
    when array[lower(p_a), lower(p_b)] @> array['social', 'quiet'] then 0.65
    when array[lower(p_a), lower(p_b)] @> array['social', 'creative'] then 0.60
    when array[lower(p_a), lower(p_b)] @> array['energetic', 'party'] then 0.95
    when array[lower(p_a), lower(p_b)] @> array['energetic', 'creative'] then 0.55
    when array[lower(p_a), lower(p_b)] @> array['energetic', 'quiet'] then 0.25
    when array[lower(p_a), lower(p_b)] @> array['party', 'creative'] then 0.45
    when array[lower(p_a), lower(p_b)] @> array['party', 'quiet'] then 0.20
    when array[lower(p_a), lower(p_b)] @> array['quiet', 'creative'] then 0.70
    else 0
  end;
$$;

create or replace function public._buddy_array_fit(
  p_a text[],
  p_b text[],
  p_kind text
)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  item_a text;
  item_b text;
  best numeric;
  total numeric := 0;
  compared int := 0;
begin
  if coalesce(cardinality(p_a), 0) = 0 or coalesce(cardinality(p_b), 0) = 0 then
    return null;
  end if;

  foreach item_a in array p_a loop
    best := 0;
    foreach item_b in array p_b loop
      best := greatest(
        best,
        case
          when p_kind = 'interest' then public._buddy_interest_pair_fit(item_a, item_b)
          else public._buddy_style_pair_fit(item_a, item_b)
        end
      );
    end loop;
    total := total + best;
    compared := compared + 1;
  end loop;

  foreach item_b in array p_b loop
    best := 0;
    foreach item_a in array p_a loop
      best := greatest(
        best,
        case
          when p_kind = 'interest' then public._buddy_interest_pair_fit(item_a, item_b)
          else public._buddy_style_pair_fit(item_a, item_b)
        end
      );
    end loop;
    total := total + best;
    compared := compared + 1;
  end loop;

  return case when compared = 0 then null else total / compared end;
end;
$$;

create or replace function public._buddy_goal_fit(p_a text, p_b text)
returns numeric
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when p_a is null or p_b is null then null
    when lower(p_a) = lower(p_b) then 1.00
    when array[lower(p_a), lower(p_b)] @> array['crew', 'friends'] then 0.85
    when array[lower(p_a), lower(p_b)] @> array['crew', 'doers'] then 0.70
    when array[lower(p_a), lower(p_b)] @> array['crew', 'out'] then 0.55
    when array[lower(p_a), lower(p_b)] @> array['friends', 'doers'] then 0.65
    when array[lower(p_a), lower(p_b)] @> array['friends', 'out'] then 0.75
    when array[lower(p_a), lower(p_b)] @> array['doers', 'out'] then 0.80
    else 0.50
  end;
$$;

create or replace function public._buddy_behavior_fit(p_a uuid, p_b uuid)
returns table (fit numeric, evidence int)
language sql
security definer
stable
set search_path = public
as $$
  with explicit_signals as (
    select
      vi.user_id,
      vi.vibe_id,
      case when vi.status = 'confirmed' then 2.0 else 1.0 end::numeric as weight
    from public.vibe_interests vi
    where vi.user_id in (p_a, p_b)
      and (
        vi.status = 'confirmed'
        or (
          vi.source = 'self'
          and vi.status in ('interested', 'shortlisted', 'standby', 'invited')
        )
      )

    union all

    select vf.user_id, vf.vibe_id, -2.0::numeric
    from public.vibe_feedback vf
    where vf.user_id in (p_a, p_b)
      and vf.signal = 'not_for_me'

    union all

    select
      vr.reviewer_id,
      vr.vibe_id,
      case
        when vr.rating >= 4 then 3.0
        when vr.rating <= 2 then -3.0
        else 0
      end::numeric
    from public.vibe_reviews vr
    where vr.reviewer_id in (p_a, p_b)
      and vr.rating is not null
      and vr.rating <> 3
  ),
  event_weights as (
    select user_id, vibe_id, sum(weight)::numeric as weight
    from explicit_signals
    group by user_id, vibe_id
    having sum(weight) <> 0
  ),
  features as (
    select
      ew.user_id,
      'category:' || lower(c.category) as token,
      ew.weight * 0.60 / c.category_count as weight
    from event_weights ew
    join public.vibes v on v.id = ew.vibe_id
    cross join lateral (
      select category, count(*) over ()::numeric as category_count
      from unnest(
        case
          when coalesce(cardinality(v.categories), 0) > 0 then v.categories
          else array[v.category]
        end
      ) category
      where nullif(trim(category), '') is not null
        and lower(category) <> 'other'
    ) c

    union all

    select
      ew.user_id,
      'tag:' || lower(t.tag) as token,
      ew.weight * 0.40 / t.tag_count as weight
    from event_weights ew
    join public.vibes v on v.id = ew.vibe_id
    cross join lateral (
      select tag, count(*) over ()::numeric as tag_count
      from unnest(coalesce(v.event_vibe_tags, '{}')) tag
      where nullif(trim(tag), '') is not null
    ) t
  ),
  vectors as (
    select user_id, token, sum(weight)::numeric as weight
    from features
    group by user_id, token
    having sum(weight) <> 0
  ),
  norms as (
    select user_id, sum(weight * weight)::numeric as norm_sq
    from vectors
    group by user_id
  ),
  dot_product as (
    select coalesce(sum(va.weight * vb.weight), 0)::numeric as dot
    from vectors va
    join vectors vb on vb.token = va.token
    where va.user_id = p_a and vb.user_id = p_b
  ),
  counts as (
    select
      count(distinct vibe_id) filter (where user_id = p_a)::int as count_a,
      count(distinct vibe_id) filter (where user_id = p_b)::int as count_b
    from event_weights
  )
  select
    case
      when na.norm_sq is null or nb.norm_sq is null
        or na.norm_sq <= 0 or nb.norm_sq <= 0 then null
      else greatest(
        0,
        least(1, ((d.dot / sqrt(na.norm_sq * nb.norm_sq)) + 1) / 2)
      )
    end as fit,
    case
      when na.norm_sq is null or nb.norm_sq is null then 0
      else least(c.count_a, c.count_b)
    end::int as evidence
  from counts c
  cross join dot_product d
  left join norms na on na.user_id = p_a
  left join norms nb on nb.user_id = p_b;
$$;

create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  component numeric;
  onboarding_total numeric := 0;
  onboarding_weight numeric := 0;
  onboarding_raw numeric;
  onboarding_score numeric;
  behavior_fit numeric;
  behavior_evidence int := 0;
  behavior_score numeric;
  behavior_weight numeric := 0;
  trait_similarity numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;

  if ra.id is null or rb.id is null then
    return 0;
  end if;

  component := public._buddy_array_fit(
    ra.vibe_interests,
    rb.vibe_interests,
    'interest'
  );
  if component is not null then
    onboarding_total := onboarding_total + 0.35 * component;
    onboarding_weight := onboarding_weight + 0.35;
  end if;

  component := public._buddy_array_fit(
    ra.activity_vibe,
    rb.activity_vibe,
    'style'
  );
  if component is not null then
    onboarding_total := onboarding_total + 0.25 * component;
    onboarding_weight := onboarding_weight + 0.25;
  end if;

  if ra.activity_social is not null and rb.activity_social is not null then
    component := greatest(
      0,
      least(1, 1 - abs(ra.activity_social - rb.activity_social)::numeric / 4)
    );
    onboarding_total := onboarding_total + 0.20 * component;
    onboarding_weight := onboarding_weight + 0.20;
  end if;

  component := public._buddy_goal_fit(ra.vibe_goal, rb.vibe_goal);
  if component is not null then
    onboarding_total := onboarding_total + 0.10 * component;
    onboarding_weight := onboarding_weight + 0.10;
  end if;

  if (ra.vibe_traits ->> 'spontaneity') ~ '^[0-9]+([.][0-9]+)?$'
    and (ra.vibe_traits ->> 'social') ~ '^[0-9]+([.][0-9]+)?$'
    and (ra.vibe_traits ->> 'energy') ~ '^[0-9]+([.][0-9]+)?$'
    and (rb.vibe_traits ->> 'spontaneity') ~ '^[0-9]+([.][0-9]+)?$'
    and (rb.vibe_traits ->> 'social') ~ '^[0-9]+([.][0-9]+)?$'
    and (rb.vibe_traits ->> 'energy') ~ '^[0-9]+([.][0-9]+)?$' then
    trait_similarity := greatest(
      0,
      least(
        1,
        1 - (
          abs((ra.vibe_traits ->> 'spontaneity')::numeric - (rb.vibe_traits ->> 'spontaneity')::numeric)
          + abs((ra.vibe_traits ->> 'social')::numeric - (rb.vibe_traits ->> 'social')::numeric)
          + abs((ra.vibe_traits ->> 'energy')::numeric - (rb.vibe_traits ->> 'energy')::numeric)
        ) / 300
      )
    );
    onboarding_total := onboarding_total + 0.10 * trait_similarity;
    onboarding_weight := onboarding_weight + 0.10;
  end if;

  if onboarding_weight > 0 then
    onboarding_raw := greatest(0, least(1, onboarding_total / onboarding_weight));
    onboarding_score := 55 + 35 * onboarding_raw;
  end if;

  select b.fit, b.evidence
  into behavior_fit, behavior_evidence
  from public._buddy_behavior_fit(p_a, p_b) b;

  if behavior_fit is not null and behavior_evidence > 0 then
    behavior_score := 55 + 40 * greatest(0, least(1, behavior_fit));
    behavior_weight := least(0.80, 0.80 * behavior_evidence::numeric / 10);
  end if;

  if onboarding_score is null and behavior_score is null then
    return 0;
  elsif onboarding_score is null then
    return round(behavior_score);
  elsif behavior_score is null then
    return round(onboarding_score);
  end if;

  return round(
    onboarding_score * (1 - behavior_weight)
    + behavior_score * behavior_weight
  );
end;
$$;

revoke all on function public._buddy_interest_pair_fit(text, text)
  from public, anon, authenticated;
revoke all on function public._buddy_style_pair_fit(text, text)
  from public, anon, authenticated;
revoke all on function public._buddy_array_fit(text[], text[], text)
  from public, anon, authenticated;
revoke all on function public._buddy_goal_fit(text, text)
  from public, anon, authenticated;
revoke all on function public._buddy_behavior_fit(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.buddy_pair_score(uuid, uuid)
  from public, anon;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);
