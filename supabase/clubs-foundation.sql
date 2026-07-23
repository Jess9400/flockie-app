-- Flockie Clubs foundation. Run in the Supabase SQL Editor after this PR is merged.
-- Safe to re-run. This is additive: it does not change Buddy, travel, or Vibe matching.

-- A Club is an ongoing group. A club gathering remains a normal Vibe so it
-- continues to use the proven Vibe invite, confirmation, location, and chat rules.
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 600),
  cover_photo text,
  city text not null check (char_length(trim(city)) between 2 and 80),
  area text check (char_length(area) <= 100),
  category text check (char_length(category) <= 60),
  cadence text not null default 'weekly'
    check (cadence in ('weekly', 'biweekly', 'monthly')),
  status text not null default 'forming'
    check (status in ('forming', 'active', 'paused', 'closed')),
  openness text not null default 'discoverable'
    check (openness in ('discoverable', 'invite_only')),
  newcomer_policy text not null default 'host_approval'
    check (newcomer_policy in ('host_approval', 'club_only')),
  operating_mode text not null default 'host_run'
    check (operating_mode in ('host_run', 'flockie_assisted')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  paused_at timestamptz
);
create index if not exists clubs_city_status_idx on public.clubs (city, status, created_at desc);
create index if not exists clubs_owner_idx on public.clubs (owner_id, created_at desc);

-- Existing Vibe events can optionally belong to a Club. A deleted Club leaves
-- its historical Vibes intact as ordinary one-off events.
alter table public.vibes
  add column if not exists club_id uuid references public.clubs(id) on delete set null;
create index if not exists vibes_club_starts_idx on public.vibes (club_id, starts_at);

-- A Vibe cannot be attached to someone else's Club. This keeps the Club
-- directory, attendance record, and future Club chat tied to the same host.
create or replace function public.enforce_vibe_club_owner()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.club_id is not null and not exists (
    select 1 from public.clubs
    where id = new.club_id and owner_id = new.host_id
  ) then
    raise exception 'only the club host can create a club gathering';
  end if;
  return new;
end;
$$;
drop trigger if exists vibes_club_owner_guard on public.vibes;
create trigger vibes_club_owner_guard
before insert or update of club_id, host_id on public.vibes
for each row execute function public.enforce_vibe_club_owner();

-- "Founding" is an invited early builder; "regular" is earned only after a
-- recorded attendance and a membership request/approval. Neither is public by default.
create table if not exists public.club_memberships (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  status text not null check (status in ('invited', 'founding', 'requested', 'regular', 'left', 'declined', 'removed')),
  show_on_profile boolean not null default false,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  regular_since timestamptz,
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_memberships_user_idx on public.club_memberships (user_id, status, updated_at desc);
create index if not exists club_memberships_club_idx on public.club_memberships (club_id, status, updated_at desc);

-- Confirming a Vibe is not proof of attendance. This separate host-recorded
-- fact is what later makes a member eligible to request regular membership.
create table if not exists public.club_attendance (
  club_id uuid not null references public.clubs(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete cascade,
  attended_at timestamptz not null default now(),
  primary key (vibe_id, user_id)
);
create index if not exists club_attendance_user_idx on public.club_attendance (user_id, attended_at desc);
create index if not exists club_attendance_club_idx on public.club_attendance (club_id, attended_at desc);

alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_attendance enable row level security;

create or replace function public.is_club_host(p_club uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.clubs
    where id = p_club and owner_id = auth.uid()
  );
$$;
revoke all on function public.is_club_host(uuid) from public, anon;
grant execute on function public.is_club_host(uuid) to authenticated;

create or replace function public.is_club_member(p_club uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_club_host(p_club)
    or exists (
      select 1 from public.club_memberships
      where club_id = p_club
        and user_id = auth.uid()
        and status in ('founding', 'regular')
    );
$$;
revoke all on function public.is_club_member(uuid) from public, anon;
grant execute on function public.is_club_member(uuid) to authenticated;

-- No broad browser table access is granted. Discovery uses a safe RPC so
-- public Club browsing never exposes an exact venue or a roster of people.
drop policy if exists "clubs host read" on public.clubs;
create policy "clubs host read" on public.clubs for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "clubs host update" on public.clubs;
create policy "clubs host update" on public.clubs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "clubs host delete" on public.clubs;
create policy "clubs host delete" on public.clubs for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "club memberships own or host read" on public.club_memberships;
create policy "club memberships own or host read" on public.club_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_club_host(club_id));

drop policy if exists "club attendance own or host read" on public.club_attendance;
create policy "club attendance own or host read" on public.club_attendance for select to authenticated
  using (user_id = auth.uid() or public.is_club_host(club_id));

create or replace function public.create_forming_club(
  p_title text,
  p_description text,
  p_city text,
  p_area text default null,
  p_category text default null,
  p_cover_photo text default null,
  p_cadence text default 'weekly',
  p_openness text default 'discoverable'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_club uuid;
begin
  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 80 then
    raise exception 'club title must be between 3 and 80 characters';
  end if;
  if char_length(trim(p_title)) < 3 then
    raise exception 'club title must be between 3 and 80 characters';
  end if;
  if nullif(trim(p_city), '') is null or char_length(trim(p_city)) > 80 then
    raise exception 'choose a valid city';
  end if;
  if char_length(coalesce(p_description, '')) > 600 then
    raise exception 'club description is too long';
  end if;
  if p_cadence not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'invalid club cadence';
  end if;
  if p_openness not in ('discoverable', 'invite_only') then
    raise exception 'invalid club openness';
  end if;

  insert into public.clubs (
    owner_id, title, description, city, area, category, cover_photo, cadence, openness
  )
  values (
    auth.uid(), trim(p_title), trim(coalesce(p_description, '')), trim(p_city),
    nullif(trim(p_area), ''), nullif(trim(p_category), ''), p_cover_photo, p_cadence, p_openness
  )
  returning id into v_club;

  insert into public.club_memberships (club_id, user_id, role, status, joined_at)
  values (v_club, auth.uid(), 'host', 'founding', now());

  return v_club;
end;
$$;
grant execute on function public.create_forming_club(text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.invite_club_founder(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can invite founding members';
  end if;
  if p_user = auth.uid() then
    raise exception 'the host is already a founding member';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'member not found';
  end if;

  insert into public.club_memberships (club_id, user_id, status, invited_by, invited_at, updated_at)
  values (p_club, p_user, 'invited', auth.uid(), now(), now())
  on conflict (club_id, user_id) do update
    set status = 'invited', invited_by = auth.uid(), invited_at = now(), updated_at = now(), show_on_profile = false
    where public.club_memberships.status in ('left', 'declined', 'removed');

  if not found then
    raise exception 'this person already has an active club membership or request';
  end if;
end;
$$;
grant execute on function public.invite_club_founder(uuid, uuid) to authenticated;

create or replace function public.accept_club_founder_invitation(p_club uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.club_memberships
  set status = 'founding', joined_at = now(), updated_at = now()
  where club_id = p_club and user_id = auth.uid() and status = 'invited';

  if not found then
    raise exception 'a pending founding invitation is required';
  end if;
end;
$$;
grant execute on function public.accept_club_founder_invitation(uuid) to authenticated;

create or replace function public.record_club_attendance(p_club uuid, p_vibe uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can record attendance';
  end if;
  if not exists (
    select 1 from public.vibes
    where id = p_vibe
      and club_id = p_club
      and status <> 'cancelled'
      and coalesce(ends_at, starts_at) <= now()
  ) then
    raise exception 'attendance can only be recorded after a completed club gathering';
  end if;
  if not exists (
    select 1 from public.vibe_interests
    where vibe_id = p_vibe and user_id = p_user and status = 'confirmed'
  ) and not exists (
    select 1 from public.vibes where id = p_vibe and host_id = p_user
  ) then
    raise exception 'only confirmed gathering participants can be recorded as attendees';
  end if;

  insert into public.club_attendance (club_id, vibe_id, user_id, recorded_by)
  values (p_club, p_vibe, p_user, auth.uid())
  on conflict (vibe_id, user_id) do nothing;
end;
$$;
grant execute on function public.record_club_attendance(uuid, uuid, uuid) to authenticated;

create or replace function public.request_club_membership(p_club uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.clubs
    where id = p_club and status in ('forming', 'active')
  ) then
    raise exception 'this club is not accepting membership requests';
  end if;
  if not exists (
    select 1 from public.club_attendance
    where club_id = p_club and user_id = auth.uid()
  ) then
    raise exception 'attend a club gathering before requesting membership';
  end if;

  insert into public.club_memberships (club_id, user_id, status, updated_at)
  values (p_club, auth.uid(), 'requested', now())
  on conflict (club_id, user_id) do update
    set status = 'requested', updated_at = now(), show_on_profile = false
    where public.club_memberships.status in ('left', 'declined', 'removed');

  if not found then
    raise exception 'membership is already active or awaiting a decision';
  end if;
end;
$$;
grant execute on function public.request_club_membership(uuid) to authenticated;

create or replace function public.approve_club_membership(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_club_host(p_club) then
    raise exception 'only the club host can approve membership';
  end if;

  update public.club_memberships
  set status = 'regular', regular_since = now(), updated_at = now()
  where club_id = p_club and user_id = p_user and status = 'requested';

  if not found then
    raise exception 'a pending membership request is required';
  end if;
end;
$$;
grant execute on function public.approve_club_membership(uuid, uuid) to authenticated;

create or replace function public.set_club_profile_visibility(p_club uuid, p_visible boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.club_memberships
  set show_on_profile = p_visible, updated_at = now()
  where club_id = p_club
    and user_id = auth.uid()
    and status in ('founding', 'regular');

  if not found then
    raise exception 'an active club membership is required';
  end if;
end;
$$;
grant execute on function public.set_club_profile_visibility(uuid, boolean) to authenticated;

-- Safe discovery: no exact venue, no membership roster, no invite or request data.
create or replace function public.club_directory(p_city text default null, p_limit int default 24)
returns table (
  id uuid,
  title text,
  description text,
  cover_photo text,
  city text,
  area text,
  category text,
  cadence text,
  status text,
  next_vibe_id uuid,
  next_vibe_title text,
  next_vibe_starts_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    c.id, c.title, c.description, c.cover_photo, c.city, c.area, c.category, c.cadence, c.status,
    next_vibe.id, next_vibe.title, next_vibe.starts_at
  from public.clubs c
  left join lateral (
    select v.id, v.title, v.starts_at
    from public.vibes v
    where v.club_id = c.id
      and v.status = 'open'
      and v.starts_at > now()
    order by v.starts_at asc
    limit 1
  ) next_vibe on true
  where c.status in ('forming', 'active')
    and c.openness = 'discoverable'
    and (p_city is null or lower(c.city) = lower(trim(p_city)))
  order by next_vibe.starts_at nulls last, c.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 48);
$$;
grant execute on function public.club_directory(text, int) to authenticated;

-- Profiles show a club only when the member explicitly opts in. The RPC is
-- intentionally limited to club-level identity, never a gathering location.
create or replace function public.public_profile_clubs(p_user uuid)
returns table (
  club_id uuid,
  title text,
  cover_photo text,
  city text,
  category text,
  cadence text,
  membership_status text
)
language sql security definer set search_path = public stable as $$
  select c.id, c.title, c.cover_photo, c.city, c.category, c.cadence, cm.status
  from public.club_memberships cm
  join public.clubs c on c.id = cm.club_id
  where cm.user_id = p_user
    and cm.show_on_profile
    and cm.status in ('founding', 'regular')
    and c.status <> 'closed'
  order by cm.updated_at desc;
$$;
grant execute on function public.public_profile_clubs(uuid) to authenticated;
