-- Confirm-spot windows tuned so spots turn over fast enough to fill, and the
-- confirmed list is people who are actually committed:
--   * short vibe (<24h out): 1h to confirm
--   * normal vibe (>=24h out): 6h to confirm (was 24h — too long; spots sat held)
-- Never past ~30 min before start. Unconfirmed spots cascade to standby via
-- backfill_vibe. confirm_vibe already rejects expired/over-fill. Idempotent.
create or replace function public._vibe_confirm_deadline(p_starts timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select case
    when p_starts - now() < interval '24 hours'
      then least(now() + interval '1 hour', p_starts)
    else least(now() + interval '6 hours', p_starts - interval '30 minutes')
  end;
$$;
