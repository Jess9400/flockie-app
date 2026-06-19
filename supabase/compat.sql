-- "How compatible are we?" friend link. Run in the Supabase SQL editor.
-- Safe to re-run. (Reuses buddy_pair_score from buddy-match-context.sql.)

-- Public info about the inviter for the compatibility landing page.
create or replace function public.compat_target(p_id uuid)
returns table (id uuid, name text, photo text)
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos[1]
  from public.profiles p
  where p.id = p_id;
$$;
grant execute on function public.compat_target(uuid) to anon, authenticated;

-- Travel-vibe compatibility between the caller and another user, with the tags
-- they share (for a "you both love…" breakdown).
drop function if exists public.compat_score(uuid);
create or replace function public.compat_score(p_other uuid)
returns table (score int, my_name text, other_name text, highlights text[])
language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = auth.uid()),
       b as (select * from public.profiles where id = p_other)
  select
    public.buddy_pair_score(auth.uid(), p_other)::int,
    a.display_name,
    b.display_name,
    (select array(
       select x from (
         select unnest(coalesce(a.trip_vibe, '{}') || coalesce(a.travel_style, '{}') || coalesce(a.activity_vibe, '{}')) as x
         intersect
         select unnest(coalesce(b.trip_vibe, '{}') || coalesce(b.travel_style, '{}') || coalesce(b.activity_vibe, '{}'))
       ) t
       limit 4
     ))
  from a, b;
$$;
grant execute on function public.compat_score(uuid) to authenticated;
