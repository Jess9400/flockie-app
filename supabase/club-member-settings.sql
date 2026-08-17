-- CLUB MEMBER SETTINGS (founder request 2026-08-17): members get their own
-- controls on the club page - leave the club, report it, toggle whether it
-- shows on their profile. Leaving and profile visibility already had RPCs
-- (leave_club, set_club_profile_visibility); this adds club REPORTING,
-- mirroring the existing user_reports pattern.
--
-- Reports are write-only for users (no select policy - reviewed with the
-- service role); one report per user per club (repeat taps are no-ops).
-- SECURITY DEFINER + explicit search_path, authenticated-only, anon revoked.
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.club_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'safety', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (club_id, reporter_id)
);
alter table public.club_reports enable row level security;
-- No select/insert policies on purpose: writes go through the RPC, reads
-- happen with the service role during review.

create or replace function public.report_club(p_club uuid, p_reason text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_reason not in ('spam', 'inappropriate', 'safety', 'other') then
    raise exception 'invalid reason';
  end if;
  if not exists (select 1 from public.clubs where id = p_club) then
    raise exception 'club not found';
  end if;
  if exists (select 1 from public.clubs where id = p_club and owner_id = auth.uid()) then
    raise exception 'you cannot report your own club';
  end if;

  insert into public.club_reports (club_id, reporter_id, reason, note)
  values (p_club, auth.uid(), p_reason, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (club_id, reporter_id) do update
    set reason = excluded.reason, note = excluded.note, created_at = now();
end;
$$;
revoke execute on function public.report_club(uuid, text, text) from public, anon;
grant execute on function public.report_club(uuid, text, text) to authenticated;
