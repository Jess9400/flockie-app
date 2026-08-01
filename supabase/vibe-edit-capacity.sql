-- Let the host change the number of spots on a live Vibe (was fixed at creation;
-- Settings only allowed editing timing + cancel). Host-only. Guards:
--   * 2..100 range (same as creation)
--   * can't drop below the number already CONFIRMED (they're locked in)
-- If seats are ADDED to an already-matched ('ranking') Vibe, fill them right away
-- (standby -> late interested -> city fallback) instead of waiting for the next
-- autofill tick. Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.update_vibe_capacity(p_vibe uuid, p_capacity int)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int;
begin
  select * into v from public.vibes where id = p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host can edit spots'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if p_capacity < 2 or p_capacity > 100 then
    raise exception 'spots must be between 2 and 100';
  end if;

  select count(*) into v_confirmed from public.vibe_interests
    where vibe_id = p_vibe and status = 'confirmed';
  if p_capacity < v_confirmed then
    raise exception 'can''t set spots below the % already confirmed', v_confirmed;
  end if;

  update public.vibes set capacity = p_capacity where id = p_vibe;

  -- Seats were added to a Vibe that already ran matching → fill the new room now
  -- rather than waiting up to 10 min for autofill. (v.capacity is the OLD value,
  -- captured before the update above.) Both helpers are no-ops when there's no
  -- room or nobody to pull, so this is safe.
  if p_capacity > v.capacity and v.status = 'ranking' then
    perform public.backfill_vibe(p_vibe);
    perform public.invite_city_fallback(p_vibe);
  end if;
end $$;
grant execute on function public.update_vibe_capacity(uuid, int) to authenticated;
