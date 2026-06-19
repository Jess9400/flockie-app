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

-- Travel-vibe compatibility between the caller and another user.
create or replace function public.compat_score(p_other uuid)
returns table (score int, my_name text, other_name text)
language sql security definer set search_path = public stable as $$
  select public.buddy_pair_score(auth.uid(), p_other)::int,
         (select display_name from public.profiles where id = auth.uid()),
         (select display_name from public.profiles where id = p_other);
$$;
grant execute on function public.compat_score(uuid) to authenticated;
