-- Two vibe-flow fixes.
-- (1) Late opt-ins no longer stranded: backfill now pulls open spots from BOTH
--     standby AND late 'interested' people (same-city first), not just standby —
--     so someone who clicks "I'm interested" after the rank already ran (common
--     now that the city fallback RECOMMENDS people who opt in whenever) still gets
--     pulled into an open spot instead of sitting in limbo.
-- (3) Confirm deadline can never land after the event starts (ultra-short vibes).
-- Idempotent. Safe to re-run.

-- ── (3) Confirm deadline: cap at starts_at so it's never after the event ──────
create or replace function public._vibe_confirm_deadline(p_starts timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select least(
    p_starts,                                                   -- never after the event starts
    now() + interval '24 hours',
    greatest(now() + interval '30 minutes', p_starts - interval '30 minutes')
  );
$$;

-- ── (1) Backfill open spots from standby + late 'interested' (same-city first) ─
create or replace function public.backfill_vibe(p_vibe uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;  -- never invite into a started/finished Vibe
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select vi.user_id
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    where vi.vibe_id = p_vibe
      and vi.status in ('standby','interested')             -- late opt-ins included, not just standby
      and coalesce(vi.source,'algo') <> 'private'
      and public.vibe_eligible(vi.user_id, p_vibe)          -- safe for the newly-included interested pool
    -- Same-city first, then score. Late 'interested' rows may have a null score;
    -- they sort after ranked standby within their city group (nulls last).
    order by
      (v.city is not null and p.home_city is not null
        and lower(trim(p.home_city)) = lower(trim(v.city))) desc,
      vi.match_score desc nulls last
    limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at) where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $function$;
