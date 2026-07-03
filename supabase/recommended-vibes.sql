-- Vibe match scoring + "Picked for you". Run the whole file in the Supabase SQL
-- editor AFTER vibe-eligibility-enforce.sql (recommended_vibes filters through
-- vibe_eligible). Safe to re-run.
--
-- vibe_match(user, vibe) -> 0-100, how well an open Vibe fits a user's profile:
--   0.35 category fit   — does the Vibe's category match something you do?
--   0.25 vibe-tag fit   — event tags (chill/social/party…) vs your activity vibe
--   0.12 skill fit      — required skill vs your skill in that activity
--   0.13 social fit     — how social the event reads vs your activity-social pref
--   0.15 review fit     — do you tend to recommend Vibes like this? (vibe_review_fit)
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

  -- category / activity fit — best match of the user's activities against ANY of
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
