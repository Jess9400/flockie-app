-- Vibes-only 1:1 matching. Run in the Supabase SQL editor. Safe to re-run.
--
-- `buddy_pair_score` deliberately ignores the retired personality quiz,
-- archetype, and travel preferences. It uses only signals collected by the
-- Vibes-only onboarding: raw interests, activity categories, vibe tags,
-- preferred group feel, and the three adjustable Vibe sliders.

create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  shared int;
  combined int;
  similarity numeric;
  total numeric := 0;
  weight numeric := 0;
  trait_similarity numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;

  if ra.id is null or rb.id is null then
    return 50;
  end if;

  -- Raw onboarding interests also cover things like board games, films, and
  -- deep talks that do not map to a legacy activity category.
  if coalesce(array_length(ra.vibe_interests, 1), 0) > 0
    and coalesce(array_length(rb.vibe_interests, 1), 0) > 0 then
    select count(*) into shared
    from unnest(ra.vibe_interests) interest
    where interest = any(rb.vibe_interests);
    select cardinality(array(
      select distinct unnest(ra.vibe_interests || rb.vibe_interests)
    )) into combined;
    similarity := case when combined > 0 then shared::numeric / combined else 0 end;
    total := total + 0.35 * similarity;
    weight := weight + 0.35;
  end if;

  -- Mapped activity categories keep event-specific interests useful too.
  if coalesce(array_length(ra.activities,1),0) > 0 and coalesce(array_length(rb.activities,1),0) > 0 then
    select count(*) into shared from unnest(ra.activities) activity where activity = any(rb.activities);
    select cardinality(array(select distinct unnest(ra.activities || rb.activities))) into combined;
    similarity := case when combined > 0 then shared::numeric / combined else 0 end;
    total := total + 0.20 * similarity;
    weight := weight + 0.20;
  end if;

  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into shared from unnest(ra.activity_vibe) tag where tag = any(rb.activity_vibe);
    select cardinality(array(select distinct unnest(ra.activity_vibe || rb.activity_vibe))) into combined;
    similarity := case when combined > 0 then shared::numeric / combined else 0 end;
    total := total + 0.20 * similarity;
    weight := weight + 0.20;
  end if;

  if ra.activity_social is not null and rb.activity_social is not null then
    total := total + 0.10 * (1 - abs(ra.activity_social - rb.activity_social)::numeric / 4);
    weight := weight + 0.10;
  end if;

  -- The three draggable Vibe sliders are the current personality signal.
  if (ra.vibe_traits ->> 'spontaneity') ~ '^[0-9]+([.][0-9]+)?$'
    and (ra.vibe_traits ->> 'social') ~ '^[0-9]+([.][0-9]+)?$'
    and (ra.vibe_traits ->> 'energy') ~ '^[0-9]+([.][0-9]+)?$'
    and (rb.vibe_traits ->> 'spontaneity') ~ '^[0-9]+([.][0-9]+)?$'
    and (rb.vibe_traits ->> 'social') ~ '^[0-9]+([.][0-9]+)?$'
    and (rb.vibe_traits ->> 'energy') ~ '^[0-9]+([.][0-9]+)?$' then
    trait_similarity := 1 - (
      abs((ra.vibe_traits ->> 'spontaneity')::numeric - (rb.vibe_traits ->> 'spontaneity')::numeric)
      + abs((ra.vibe_traits ->> 'social')::numeric - (rb.vibe_traits ->> 'social')::numeric)
      + abs((ra.vibe_traits ->> 'energy')::numeric - (rb.vibe_traits ->> 'energy')::numeric)
    ) / 300;
    total := total + 0.15 * trait_similarity;
    weight := weight + 0.15;
  end if;

  -- Sparse profiles are neutral, not a false 0% incompatibility.
  if weight = 0 then return 50; end if;
  return round(100 * (total / weight));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);
