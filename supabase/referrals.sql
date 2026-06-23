-- Personalized web referrals and signup attribution. Safe to re-run.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null unique references public.profiles(id) on delete cascade,
  source text not null default 'join_link',
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);

create index if not exists referrals_inviter_idx
  on public.referrals (inviter_id, created_at desc);

alter table public.referrals enable row level security;

drop policy if exists "referrals visible to participants" on public.referrals;
create policy "referrals visible to participants"
  on public.referrals for select
  to authenticated
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- Minimal public inviter data for /join/[inviterId].
create or replace function public.referral_target(p_inviter uuid)
returns table (
  id uuid,
  name text,
  photo text,
  city text,
  archetype text
)
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos[1], p.home_city, p.archetype
  from public.profiles p
  where p.id = p_inviter;
$$;
grant execute on function public.referral_target(uuid) to anon, authenticated;

-- Called after OAuth (or explicitly by an already signed-in visitor). Each new
-- user can be attributed once, and self-referrals are ignored.
create or replace function public.claim_referral(p_inviter uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  inserted_count int;
begin
  if auth.uid() is null or auth.uid() = p_inviter then
    return false;
  end if;

  if not exists (select 1 from public.profiles where id = p_inviter) then
    return false;
  end if;

  insert into public.referrals (inviter_id, invitee_id)
  values (p_inviter, auth.uid())
  on conflict (invitee_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end $$;
grant execute on function public.claim_referral(uuid) to authenticated;
