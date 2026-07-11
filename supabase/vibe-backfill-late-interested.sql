-- Close the late-joiner gap. `recommended_vibes` keeps a vibe joinable after
-- matching (reviewing/ranking/finalized, while it has room), so a user can click
-- "I'm interested" AFTER the ranking run — but their row stays 'interested' and
-- nothing auto-promoted it: backfill only drew from the pre-ranked 'standby'
-- pool. So a ghost/decline could leave a spot open with a genuine late-joiner
-- waiting and never invited (unless the host noticed manually).
--
-- This makes backfill_vibe fall through to the late 'interested' pool ONLY after
-- the standby pool is exhausted and spots still remain. Purely additive: the
-- pre-deadline ranking flow, the standby priority, and confirmed spots are all
-- untouched — this only fires when a spot is genuinely open and no ranked
-- standby candidate is left to take it. Run in the Supabase SQL editor. Safe to
-- re-run. Supersedes the definition in vibe-v2-private-link.sql.

create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;

  -- Phase 1 (unchanged): promote the pre-ranked STANDBY pool first — these were
  -- ranked at match time and have priority for any freed spot.
  for c in
    select user_id from public.vibe_interests
    where vibe_id=p_vibe and status='standby' and coalesce(source,'algo') <> 'private'
    order by match_score desc nulls last limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at) where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
    v_remaining := v_remaining - 1;
  end loop;

  -- Phase 2 (NEW): only if standby didn't fill the room, promote genuine LATE
  -- joiners who expressed interest AFTER the ranking run (status still
  -- 'interested', never ranked). Ordered by match score when known, else FIFO by
  -- when they joined. They already passed the host's gender/age gate at insert
  -- (the vibe_interests INSERT policy calls vibe_eligible). Never displaces
  -- standby or a confirmed guest, because it runs only while v_remaining > 0.
  if v_remaining > 0 then
    for c in
      select user_id from public.vibe_interests
      where vibe_id=p_vibe and status='interested' and coalesce(source,'algo') <> 'private'
      order by match_score desc nulls last, created_at asc
      limit v_remaining
    loop
      update public.vibe_interests set status='invited', invitation_sent_at=now(),
        invitation_expires_at=public._vibe_confirm_deadline(v.starts_at) where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
              'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
      v_added := v_added + 1;
      v_remaining := v_remaining - 1;
    end loop;
  end if;

  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;
