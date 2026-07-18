-- Soften buddy_hard_block: a sober person and a social drinker are perfectly
-- compatible for a coffee / hike / activity, so "Sober events only" vs
-- "Drinking is fine" should NOT hard-exclude two people from ever seeing each
-- other in discovery. Keep only the genuine same-gender preference as a hard
-- rule; drop the sober↔drinking pair.
--
-- Run in the Supabase SQL editor. Idempotent / safe to re-run.

create or replace function public.buddy_hard_block(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b)
  select
    -- Same-gender requirement on either side. Only enforceable when both
    -- genders are known; "prefer not to say" (null) is never auto-excluded.
    ( ( 'I prefer same-gender travel partners' = any(coalesce(a.dealbreakers, '{}'))
        or 'I prefer same-gender travel partners' = any(coalesce(b.dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(a.activity_dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(b.activity_dealbreakers, '{}')) )
      and a.gender is not null and b.gender is not null
      and a.gender <> b.gender )
  from a, b;
$$;
grant execute on function public.buddy_hard_block(uuid, uuid) to authenticated;
