-- Club media library (founder request 2026-08-16): a members-only space per
-- club for photos, videos, and files. Host and MODERATORS upload and delete;
-- every active member can view. Unlike the public avatars/videos buckets,
-- club-media is PRIVATE - members get short-lived signed URLs, so leaving the
-- club (or the club closing) cuts access.
--
-- Path convention: club-media/<club_id>/<uuid>-<filename>. The helper below
-- extracts the club id from the path defensively (bad paths -> null -> every
-- policy check fails closed).
--
-- Access model: table + storage policies gate on the club-moderators.sql
-- helpers (is_club_member / is_club_manager / is_club_host); helper function
-- SECURITY DEFINER with explicit search_path, authenticated-only execute.
-- Requires club-moderators.sql live. Run in the Supabase SQL editor. Safe to
-- re-run.

-- ── Private bucket (50 MB per file) ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('club-media', 'club-media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- ── Path → club id, failing closed on garbage ───────────────────────────────
create or replace function public._club_media_club(p_name text)
returns uuid
language plpgsql security definer set search_path = public immutable as $$
begin
  return ((storage.foldername(p_name))[1])::uuid;
exception when others then
  return null;
end;
$$;
revoke all on function public._club_media_club(text) from public, anon;
grant execute on function public._club_media_club(text) to authenticated;

-- ── Metadata table (what the gallery lists) ─────────────────────────────────
create table if not exists public.club_media (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('photo', 'video', 'file')),
  title text check (char_length(title) <= 140),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists club_media_club_idx on public.club_media (club_id, created_at desc);
alter table public.club_media enable row level security;

drop policy if exists "club media member read" on public.club_media;
create policy "club media member read" on public.club_media for select to authenticated
  using (public.is_club_member(club_id));

drop policy if exists "club media manager insert" on public.club_media;
create policy "club media manager insert" on public.club_media for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_club_manager(club_id));

drop policy if exists "club media manager delete" on public.club_media;
create policy "club media manager delete" on public.club_media for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_club_host(club_id));

-- ── Storage object policies for the club-media bucket ───────────────────────
drop policy if exists "club media storage upload" on storage.objects;
create policy "club media storage upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'club-media'
    and public.is_club_manager(public._club_media_club(name))
  );

drop policy if exists "club media storage read" on storage.objects;
create policy "club media storage read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'club-media'
    and public.is_club_member(public._club_media_club(name))
  );

drop policy if exists "club media storage delete" on storage.objects;
create policy "club media storage delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'club-media'
    and (owner = auth.uid() or public.is_club_host(public._club_media_club(name)))
  );
