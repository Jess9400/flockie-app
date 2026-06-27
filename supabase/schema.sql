-- Flockie MVP schema (Phase 1: profiles + vibe check)
-- Run in the Supabase SQL Editor. Safe to re-run.

-- Geolocation support (used by Vibe Buddy "near me" later)
create extension if not exists postgis;

-- Profiles / vibe check
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  age int check (age is null or (age >= 18 and age <= 120)),
  gender text,
  relationship_status text,
  bio text,
  video_url text,
  photos text[] default '{}',
  hobbies text[] default '{}',
  favorite_activities text[] default '{}',
  places_visited text[] default '{}',
  outdoor_person boolean,
  night_owl boolean,
  planning_style text,
  preferred_season text,
  mbti text,
  social_visibility text not null default 'connections'
    check (social_visibility in ('members', 'connections', 'private')),
  home_city text,
  location geography(point),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security
alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "users view own profile" on public.profiles;
create policy "users view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Storage buckets for photos and intro videos
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media"
  on storage.objects for select
  using (bucket_id in ('avatars', 'videos'));

drop policy if exists "users upload own media" on storage.objects;
create policy "users upload own media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'videos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own media" on storage.objects;
create policy "users update own media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'videos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own media" on storage.objects;
create policy "users delete own media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'videos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
