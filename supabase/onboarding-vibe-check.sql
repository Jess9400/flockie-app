-- Additive migration for the profile-build + five-question vibe onboarding.
alter table public.profiles
  add column if not exists birthday date,
  add column if not exists vibe_scores jsonb,
  add column if not exists archetype text check (
    archetype is null or archetype in ('culture', 'social', 'night', 'food', 'adventure', 'wellness')
  ),
  add column if not exists vibe_completed_at timestamptz;

create table if not exists public.vibe_responses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  answered_at timestamptz not null default now(),
  unique (profile_id, question_id)
);

alter table public.vibe_responses enable row level security;

drop policy if exists "users read own vibe responses" on public.vibe_responses;
create policy "users read own vibe responses"
  on public.vibe_responses for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "users insert own vibe responses" on public.vibe_responses;
create policy "users insert own vibe responses"
  on public.vibe_responses for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "users update own vibe responses" on public.vibe_responses;
create policy "users update own vibe responses"
  on public.vibe_responses for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
