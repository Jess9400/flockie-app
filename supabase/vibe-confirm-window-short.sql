-- Short vibes fill better: cut the confirm window to 1h for vibes <24h out, so an
-- unclaimed spot cascades to the next standby / city-fallback opt-in fast enough
-- to still fill (backfill_vibe frees the spot once invitation_expires_at passes).
-- Normal vibes unchanged (up to 24h, by ~30m before start). Never past start.
-- Idempotent.
create or replace function public._vibe_confirm_deadline(p_starts timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select case
    when p_starts - now() < interval '24 hours'
      then least(now() + interval '1 hour', p_starts)
    else least(now() + interval '24 hours', greatest(now() + interval '30 minutes', p_starts - interval '30 minutes'))
  end;
$$;
