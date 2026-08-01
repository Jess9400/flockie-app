-- P0 (2026-08-01): RPCs were executable by the ANON role.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so our
-- `grant execute ... to authenticated` never actually restricted anything -
-- the anon key could call every RPC too. Combined with the widespread
-- null-unsafe host guard `if v.host_id <> auth.uid() then raise` (NULL for
-- anon → condition is NULL → no raise), an UNAUTHENTICATED caller could e.g.
-- cancel_vibe / update_vibe_when / update_vibe_where on ANY vibe.
--
-- Fix, two layers:
--   1) Null-safe guards (`is distinct from`) on the vibe host-edit RPCs.
--   2) Revoke PUBLIC/anon execute from every public-schema function that has
--      an explicit `authenticated` grant and NO explicit `anon` grant - i.e.
--      exactly our authenticated-only RPCs. Deliberately-public functions
--      (public_vibe etc., which carry an explicit anon grant) are untouched,
--      as are PostGIS/system functions (no authenticated entry in their ACL).
--      service_role is granted explicitly so server routes keep working.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- Going forward: every new SECURITY DEFINER RPC must use `is distinct from`
-- for identity guards AND `revoke execute on function ... from public, anon`.

-- ── (1) Null-safe host guards ────────────────────────────────────────────────

create or replace function public.cancel_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; r record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host'; end if;
  update public.vibes set status = 'cancelled' where id = p_vibe;
  for r in select user_id from public.vibe_interests
           where vibe_id = p_vibe and status in ('invited','confirmed','standby') loop
    perform public.notify(r.user_id, 'vibe_cancelled', 'Cancelled: ' || v.title,
            'The host cancelled this Vibe.', jsonb_build_object('vibe_id', p_vibe));
  end loop;
end $$;

create or replace function public.update_vibe_when(p_vibe uuid, p_starts timestamptz, p_ends timestamptz, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; r record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id is distinct from auth.uid() then raise exception 'only the host'; end if;
  update public.vibes
    set starts_at = p_starts, ends_at = p_ends,
        signup_deadline = coalesce(p_deadline, signup_deadline)
    where id = p_vibe;
  for r in select user_id from public.vibe_interests
           where vibe_id = p_vibe and status in ('invited','confirmed') loop
    perform public.notify(r.user_id, 'vibe_updated', 'New time for ' || v.title,
            'The host changed the date or time. Check the details.', jsonb_build_object('vibe_id', p_vibe));
  end loop;
end $$;

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

  if p_capacity > v.capacity and v.status = 'ranking' then
    perform public.backfill_vibe(p_vibe);
    perform public.invite_city_fallback(p_vibe);
  end if;
end $$;

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

-- ── (2) Lock down every authenticated-only RPC ──────────────────────────────
-- Selection: explicit `authenticated=` entry in the ACL (our grant convention)
-- and no explicit `anon=` entry (those are meant to be public: public_vibe...).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proacl::text like '%authenticated=%'
      and p.proacl::text not like '%anon=%'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- Verify afterwards (should return 0 rows):
--   select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proacl::text like '%authenticated=%'
--     and p.proacl::text not like '%anon=%'
--     and has_function_privilege('anon', p.oid, 'execute');
