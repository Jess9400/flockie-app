-- Host edits a Vibe's photos after creation (founder request 2026-08-18:
-- change the cover of a club gathering from the gathering settings sheet).
-- Silent edit like the description - photos are not logistics, no fan-out.
-- The first photo is the cover everywhere (cards, chat header, pins).
-- Host-only, null-safe guard + anon revoke per rpc-anon-lockdown.sql
-- convention. Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.update_vibe_photos(p_vibe uuid, p_photos text[])
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if p_photos is null or array_length(p_photos, 1) is null then
    raise exception 'at least one photo is required';
  end if;
  if array_length(p_photos, 1) > 5 then raise exception 'too many photos'; end if;

  update public.vibes set photos = p_photos where id = p_vibe;
end $$;
grant execute on function public.update_vibe_photos(uuid, text[]) to authenticated;
revoke execute on function public.update_vibe_photos(uuid, text[]) from public, anon;
