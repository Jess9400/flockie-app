-- Flockie Clubs - lifecycle controls
-- Run this AFTER clubs-foundation.sql and then re-run club-detail-access.sql.
-- Safe to re-run. Pausing and closing a Club never cancel a scheduled Vibe.

alter table public.clubs
  add column if not exists paused_from text check (paused_from in ('forming', 'active'));

create or replace function public.set_club_status(p_club uuid, p_status text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_current text;
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can change this club';
  end if;
  if p_status not in ('active', 'paused', 'closed', 'resume') then
    raise exception 'invalid club status';
  end if;

  select status into v_current
  from public.clubs
  where id = p_club
  for update;

  if not found then
    raise exception 'club not found';
  end if;

  if p_status = 'active' then
    if v_current <> 'forming' then
      raise exception 'this club is already active or closed';
    end if;
    if not exists (
      select 1 from public.vibes
      where club_id = p_club
        and status <> 'cancelled'
        and coalesce(ends_at, starts_at) <= now()
    ) then
      raise exception 'complete the first club gathering before activating this club';
    end if;
  elsif p_status = 'paused' then
    if v_current not in ('forming', 'active') then
      raise exception 'only a forming or active club can be paused';
    end if;
  elsif p_status = 'resume' then
    if v_current <> 'paused' then
      raise exception 'only a paused club can be resumed';
    end if;
  elsif p_status = 'closed' and v_current not in ('forming', 'active', 'paused') then
    raise exception 'this club is already closed';
  end if;

  if p_status = 'paused' then
    update public.clubs
    set status = 'paused', paused_from = v_current, updated_at = now()
    where id = p_club;
  elsif p_status = 'resume' then
    update public.clubs
    set status = coalesce(paused_from, 'forming'), paused_from = null, updated_at = now()
    where id = p_club;
    select status into p_status from public.clubs where id = p_club;
  else
    update public.clubs
    set status = p_status, paused_from = null, updated_at = now()
    where id = p_club;
  end if;

  return p_status;
end;
$$;
revoke all on function public.set_club_status(uuid, text) from public, anon;
grant execute on function public.set_club_status(uuid, text) to authenticated;
