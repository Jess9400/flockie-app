-- Profile privacy enforcement (phase 2 of 2).
-- Run in the Supabase SQL editor AFTER the profile privacy PR is deployed.
-- Safe to re-run.

do $$
begin
  if to_regclass('public.public_profiles') is null then
    raise exception
      'Run profile-privacy-prepare.sql before enforcing profile privacy.';
  end if;
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by authenticated users"
  on public.profiles;
drop policy if exists "users view own profile"
  on public.profiles;
create policy "users view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);
