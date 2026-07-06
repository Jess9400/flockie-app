-- (2) Scale the host review window by lead time instead of a flat 6h.
-- After the shortlist is built (status='reviewing'), the host gets a window to
-- prune a few before invites auto-commit. 6h is fine for a planned vibe but
-- stalls a same-day one, so:
--   * vibe ranked >= 24h before start  -> 6h review window
--   * vibe ranked  < 24h before start  -> 30 min (get invites out fast)
-- Both still capped to start - 2h, and the host can Commit manually to skip it.
-- Idempotent. Safe to re-run.
create or replace function public.auto_commit_due_reviews()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.vibes
    where status = 'reviewing'
      and now() >= least(
        coalesce(shortlisted_at, now())
          + (case when starts_at - coalesce(shortlisted_at, now()) >= interval '24 hours'
                  then interval '6 hours'
                  else interval '30 minutes' end),
        starts_at - interval '2 hours'
      )
  loop
    perform public.commit_vibe_matching(r.id);
  end loop;
end $$;
