-- Host edits a Vibe's address after creation (venue moved, typo, wrong pin).
-- update_vibe_where updates the exact location (private: shared only with
-- confirmed people via vibe_private_logistics) plus the public city/area/
-- country, and notifies everyone already in (invited/confirmed) - mirroring
-- update_vibe_when's "New time" flow. Run in the Supabase SQL editor.
-- Safe to re-run.

create or replace function public.update_vibe_where(
  p_vibe uuid,
  p_location_name text,
  p_lat float8,
  p_lng float8,
  p_city text,
  p_area text,
  p_country text
)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; r record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if coalesce(trim(p_city), '') = '' then raise exception 'city is required'; end if;

  update public.vibes
    set location_name = nullif(trim(coalesce(p_location_name, '')), ''),
        location_lat  = p_lat,
        location_lng  = p_lng,
        city          = trim(p_city),
        area          = nullif(trim(coalesce(p_area, '')), ''),
        country       = nullif(trim(coalesce(p_country, '')), '')
    where id = p_vibe;

  for r in select user_id from public.vibe_interests
           where vibe_id = p_vibe and status in ('invited','confirmed') loop
    perform public.notify(r.user_id, 'vibe_updated', 'New location for ' || v.title,
            'The host changed the address. Check the details.',
            jsonb_build_object('vibe_id', p_vibe));
  end loop;
end $$;
grant execute on function public.update_vibe_where(uuid, text, float8, float8, text, text, text) to authenticated;
revoke execute on function public.update_vibe_where(uuid, text, float8, float8, text, text, text) from public, anon;
