-- recommended_vibes(p_limit): "Picked for you" on the Home screen.
-- Returns upcoming, open Vibes in the caller's home city that they neither host
-- nor have already shown interest in, ranked by a simple compatibility score.
--
-- Score (0-100): 0.5 * skill-fit + 0.5 * style-fit.
--   skill-fit  : 1 if the vibe has no required_skill_level, else how close the
--                caller's matching activity skill is to the requirement.
--   style-fit  : Jaccard overlap between the vibe's event_vibe_tags and the
--                caller's preferred event/travel style tags.
--
-- Run this whole block in the Supabase SQL editor.

drop function if exists public.recommended_vibes(int);

create or replace function public.recommended_vibes(p_limit int default 6)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  photos text[],
  city text,
  location_name text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  match_score int
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select
      p.id,
      p.home_city,
      coalesce(p.activity_vibe, '{}')::text[] as my_tags
    from profiles p
    where p.id = auth.uid()
  )
  select
    v.id,
    v.host_id,
    v.title,
    v.category,
    v.photos,
    v.city,
    v.location_name,
    v.starts_at,
    v.capacity,
    v.event_vibe_tags,
    round(
      100 * (
        0.5 * (case when v.required_skill_level is null then 1.0 else 0.6 end)
        + 0.5 * (
          case
            when coalesce(array_length(v.event_vibe_tags, 1), 0) = 0
              or coalesce(array_length(m.my_tags, 1), 0) = 0
            then 0.5
            else (
              cardinality(
                array(select unnest(v.event_vibe_tags) intersect select unnest(m.my_tags))
              )::numeric
              / nullif(
                cardinality(
                  array(select unnest(v.event_vibe_tags) union select unnest(m.my_tags))
                ), 0)
            )
          end
        )
      )
    )::int as match_score
  from vibes v
  cross join me m
  where v.status = 'open'
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    and not exists (
      select 1 from vibe_interests vi
      where vi.vibe_id = v.id and vi.user_id = m.id
    )
  order by match_score desc, v.starts_at asc
  limit p_limit;
$$;

grant execute on function public.recommended_vibes(int) to authenticated;

-- Match % between the caller and specific Vibes (for the "X% your vibe" badge on
-- Vibe cards while browsing). Same scoring as recommended_vibes.
drop function if exists public.vibe_match_scores(uuid[]);
create or replace function public.vibe_match_scores(p_ids uuid[])
returns table (vibe_id uuid, score int)
language sql security definer set search_path = public stable as $$
  with me as (
    select coalesce(activity_vibe, '{}')::text[] as my_tags
    from public.profiles where id = auth.uid()
  )
  select
    v.id,
    round(
      100 * (
        0.5 * (case when v.required_skill_level is null then 1.0 else 0.6 end)
        + 0.5 * (
          case
            when coalesce(array_length(v.event_vibe_tags, 1), 0) = 0
              or coalesce(array_length(m.my_tags, 1), 0) = 0
            then 0.5
            else (
              cardinality(array(select unnest(v.event_vibe_tags) intersect select unnest(m.my_tags)))::numeric
              / nullif(cardinality(array(select unnest(v.event_vibe_tags) union select unnest(m.my_tags))), 0)
            )
          end
        )
      )
    )::int as score
  from public.vibes v
  cross join me m
  where v.id = any(p_ids);
$$;
grant execute on function public.vibe_match_scores(uuid[]) to authenticated;
