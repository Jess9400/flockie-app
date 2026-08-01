-- Host edits a Vibe's description after creation (typos, updated plans).
-- Silent edit - no notification fan-out (unlike time/address changes, the
-- description isn't logistics people must re-check). Host-only, null-safe
-- guard + anon revoke per rpc-anon-lockdown.sql convention.
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.update_vibe_description(p_vibe uuid, p_description text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'description is required'; end if;
  if char_length(p_description) > 4000 then raise exception 'description is too long'; end if;

  update public.vibes set description = trim(p_description) where id = p_vibe;
end $$;
grant execute on function public.update_vibe_description(uuid, text) to authenticated;
revoke execute on function public.update_vibe_description(uuid, text) from public, anon;
