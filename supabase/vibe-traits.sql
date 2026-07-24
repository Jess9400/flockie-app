-- Vibes-only 1:1 matching. Run in the Supabase SQL editor. Safe to re-run.
--
-- `buddy_pair_score` deliberately ignores the retired personality quiz,
-- archetype, and travel preferences. It uses direct interests, Vibe styles,
-- preferred group size, and the three adjustable Vibe sliders.

create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  shared int;
  size_a int;
  size_b int;
  similarity numeric;
  total numeric := 0;
  weight numeric := 0;
  trait_similarity numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;

  if ra.id is null or rb.id is null then
    return 0;
  end if;

  if coalesce(array_length(ra.vibe_interests, 1), 0) > 0
    and coalesce(array_length(rb.vibe_interests, 1), 0) > 0 then
    select count(*) into shared
    from unnest(ra.vibe_interests) interest
    where interest = any(rb.vibe_interests);
    size_a := cardinality(ra.vibe_interests);
    size_b := cardinality(rb.vibe_interests);
    similarity := case when size_a + size_b > 0 then (2 * shared)::numeric / (size_a + size_b) else 0 end;
    total := total + 0.60 * similarity;
    weight := weight + 0.60;
  end if;

  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into shared from unnest(ra.activity_vibe) tag where tag = any(rb.activity_vibe);
    size_a := cardinality(ra.activity_vibe);
    size_b := cardinality(rb.activity_vibe);
    similarity := case when size_a + size_b > 0 then (2 * shared)::numeric / (size_a + size_b) else 0 end;
    total := total + 0.25 * similarity;
    weight := weight + 0.25;
  end if;

  if ra.activity_social is not null and rb.activity_social is not null then
    total := total + 0.10 * (1 - abs(ra.activity_social - rb.activity_social)::numeric / 2);
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
    total := total + 0.05 * trait_similarity;
    weight := weight + 0.05;
  end if;

  if weight = 0 then return 0; end if;
  return round(100 * (total / weight));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;

update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);
