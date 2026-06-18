-- Vibe check v2 migration. Run in Supabase SQL Editor. Safe to re-run.

-- Drop the old vibe columns we no longer use
alter table public.profiles
  drop column if exists hobbies,
  drop column if exists favorite_activities,
  drop column if exists places_visited,
  drop column if exists outdoor_person,
  drop column if exists night_owl,
  drop column if exists planning_style,
  drop column if exists preferred_season,
  drop column if exists mbti,
  drop column if exists bio;

-- Add the new structured vibe-check columns
alter table public.profiles
  add column if not exists planning int check (planning between 1 and 5),
  add column if not exists pace int check (pace between 1 and 5),
  add column if not exists social_energy int check (social_energy between 1 and 5),
  add column if not exists budget int check (budget between 1 and 5),
  add column if not exists nightlife int check (nightlife between 1 and 5),
  add column if not exists adventurousness int check (adventurousness between 1 and 5),
  add column if not exists trip_vibe text[] default '{}',
  add column if not exists travel_style text[] default '{}',
  add column if not exists dealbreakers text[] default '{}',
  add column if not exists one_liner text,
  add column if not exists vouch_token uuid not null default gen_random_uuid();

-- Activity vibe check (for local activity/event matching)
alter table public.profiles
  add column if not exists activities text[] default '{}',
  add column if not exists activity_skills jsonb default '{}'::jsonb,
  add column if not exists activity_social int check (activity_social between 1 and 5),
  add column if not exists activity_intensity int check (activity_intensity between 1 and 5),
  add column if not exists activity_vibe text[] default '{}',
  add column if not exists activity_dealbreakers text[] default '{}',
  add column if not exists activity_one_liner text;

-- Friend vouches (optional social proof). One row per friend submission.
create table if not exists public.vouches (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles (id) on delete cascade,
  friend_name text,
  planning int check (planning between 1 and 5),
  pace int check (pace between 1 and 5),
  social_energy int check (social_energy between 1 and 5),
  budget int check (budget between 1 and 5),
  nightlife int check (nightlife between 1 and 5),
  adventurousness int check (adventurousness between 1 and 5),
  trip_vibe text[] default '{}',
  travel_style text[] default '{}',
  dealbreakers text[] default '{}',
  one_liner text,
  extra_note text,
  created_at timestamptz not null default now()
);

alter table public.vouches enable row level security;

-- The subject can read vouches written about them. No direct client writes;
-- friends submit through the security-definer function below.
drop policy if exists "read own vouches" on public.vouches;
create policy "read own vouches"
  on public.vouches for select
  to authenticated
  using (auth.uid() = subject_id);

-- Resolve a vouch link token -> the subject's display name (for the friend page)
create or replace function public.get_vouch_subject(p_token uuid)
returns text
language sql security definer set search_path = public as $$
  select display_name from public.profiles where vouch_token = p_token;
$$;

-- A friend (unauthenticated) submits a vouch via their unique link token
create or replace function public.submit_vouch(
  p_token uuid,
  p_friend_name text,
  p_planning int,
  p_pace int,
  p_social_energy int,
  p_budget int,
  p_nightlife int,
  p_adventurousness int,
  p_trip_vibe text[],
  p_travel_style text[],
  p_dealbreakers text[],
  p_one_liner text,
  p_extra_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_subject uuid;
begin
  select id into v_subject from public.profiles where vouch_token = p_token;
  if v_subject is null then
    raise exception 'invalid token';
  end if;

  insert into public.vouches (
    subject_id, friend_name, planning, pace, social_energy, budget, nightlife,
    adventurousness, trip_vibe, travel_style, dealbreakers, one_liner, extra_note
  ) values (
    v_subject, p_friend_name, p_planning, p_pace, p_social_energy, p_budget,
    p_nightlife, p_adventurousness, coalesce(p_trip_vibe, '{}'),
    coalesce(p_travel_style, '{}'), coalesce(p_dealbreakers, '{}'),
    p_one_liner, p_extra_note
  );
end;
$$;

grant execute on function public.get_vouch_subject(uuid) to anon, authenticated;
grant execute on function public.submit_vouch(
  uuid, text, int, int, int, int, int, int, text[], text[], text[], text, text
) to anon, authenticated;
