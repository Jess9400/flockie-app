-- Perf: batch buddy_pair_score over many targets in ONE call, so pages that need
-- a score per person (My Trips join-requests) stop firing N separate RPC
-- round-trips. Same math as buddy_pair_score, one network hop. Run in the
-- Supabase SQL editor. Safe to re-run.
create or replace function public.buddy_pair_scores(p_a uuid, p_b uuid[])
returns table (user_id uuid, score numeric)
language sql security definer set search_path = public stable as $$
  select b as user_id, public.buddy_pair_score(p_a, b) as score
  from unnest(coalesce(p_b, '{}')) b;
$$;
grant execute on function public.buddy_pair_scores(uuid, uuid[]) to authenticated;
