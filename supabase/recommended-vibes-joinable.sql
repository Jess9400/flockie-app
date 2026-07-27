-- "Picked for you" now recommends still-joinable vibes, not just 'open':
--   * include reviewing/ranking/finalized (a vibe stays joinable after matching)
--   * but ONLY while it still has room (confirmed < capacity) - never push a full vibe
-- Everything else identical to live: eligibility gate, city, already-in/interested
-- exclusion (any status), not-for-me, match scoring. Idempotent.
create or replace function public.recommended_vibes(p_limit integer default 6)
 returns table(id uuid, host_id uuid, title text, category text, photos text[], city text, area text, country text, starts_at timestamp with time zone, capacity integer, event_vibe_tags text[], match_score integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with me as (select id, home_city from public.profiles where id = auth.uid())
  select
    v.id, v.host_id, v.title, v.category, v.photos, v.city, v.area, v.country,
    v.starts_at, v.capacity, v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status in ('open', 'reviewing', 'ranking', 'finalized')   -- still-joinable, not just open
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    -- already in / interested (any status) -> excluded
    and not exists (
      select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = m.id
    )
    and not exists (
      select 1 from public.vibe_feedback vf
      where vf.vibe_id = v.id and vf.user_id = m.id and vf.signal = 'not_for_me'
    )
    -- only while there's still room - don't recommend a full vibe
    and (select count(*) from public.vibe_interests vi2
         where vi2.vibe_id = v.id and vi2.status = 'confirmed') < v.capacity
    -- never recommend a vibe whose host prefs (gender/age) exclude the viewer
    and public.vibe_eligible(m.id, v.id)
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$function$;
