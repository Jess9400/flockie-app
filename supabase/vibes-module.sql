-- Flockie — Vibe Buddy / "Create a Vibe" module. Run in Supabase SQL Editor.
-- Safe to re-run.

-- ───────────────────────────── vibes (events) ─────────────────────────────
create table if not exists public.vibes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  photos text[] default '{}',
  city text not null,
  location_name text,
  location_lat float8,
  location_lng float8,
  starts_at timestamptz not null,
  ends_at timestamptz,
  signup_deadline timestamptz not null,
  capacity int not null check (capacity between 2 and 100),
  event_vibe_tags text[] default '{}',
  required_skill_level int,
  dealbreaker_rules jsonb default '{}'::jsonb,
  diversity_floor_enabled boolean default false,
  status text not null default 'open',
  created_at timestamptz default now()
);
create index if not exists vibes_city_starts_idx on public.vibes (city, starts_at);

-- host's must-invite picks (max 5 enforced in app)
create table if not exists public.vibe_pins (
  vibe_id uuid references public.vibes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (vibe_id, user_id)
);

-- members who clicked Interested (and their ranking lifecycle)
create table if not exists public.vibe_interests (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid references public.vibes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  status text not null default 'interested',
  match_score float8,
  invitation_sent_at timestamptz,
  invitation_expires_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  unique (vibe_id, user_id)
);

create table if not exists public.vibe_removals (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid references public.vibes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  host_id uuid references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('known_conflict', 'other', 'safety')),
  note text,
  previous_status text,
  is_safety boolean not null default false,
  disputed_at timestamptz,
  dispute_note text,
  reviewed_at timestamptz,
  review_status text,
  created_at timestamptz default now(),
  unique (vibe_id, user_id)
);
create index if not exists vibe_removals_vibe_idx on public.vibe_removals (vibe_id, created_at desc);
create index if not exists vibe_removals_user_idx on public.vibe_removals (user_id, created_at desc);

-- one chat per vibe
create table if not exists public.vibing_chats (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid references public.vibes (id) on delete cascade unique,
  created_at timestamptz default now()
);

create table if not exists public.vibing_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.vibing_chats (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- in-app notifications (never email)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────────────────────── RLS ─────────────────────────────
alter table public.vibes enable row level security;
alter table public.vibe_pins enable row level security;
alter table public.vibe_interests enable row level security;
alter table public.vibe_removals enable row level security;
alter table public.vibing_chats enable row level security;
alter table public.vibing_messages enable row level security;
alter table public.notifications enable row level security;

-- helper: is the current user a confirmed attendee (or host) of a vibe?
create or replace function public.is_vibe_member(p_vibe uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.vibes v where v.id = p_vibe and v.host_id = auth.uid())
      or exists (
        select 1 from public.vibe_interests i
        where i.vibe_id = p_vibe and i.user_id = auth.uid() and i.status = 'confirmed'
      );
$$;

-- vibes: anyone signed in can browse; host manages own
drop policy if exists "vibes readable" on public.vibes;
create policy "vibes readable" on public.vibes for select to authenticated using (true);
drop policy if exists "vibes host insert" on public.vibes;
create policy "vibes host insert" on public.vibes for insert to authenticated with check (auth.uid() = host_id);
drop policy if exists "vibes host update" on public.vibes;
create policy "vibes host update" on public.vibes for update to authenticated using (auth.uid() = host_id);
drop policy if exists "vibes host delete" on public.vibes;
create policy "vibes host delete" on public.vibes for delete to authenticated using (auth.uid() = host_id);

-- pins: host or the pinned user can read; host manages
drop policy if exists "pins read" on public.vibe_pins;
create policy "pins read" on public.vibe_pins for select to authenticated
  using (user_id = auth.uid() or auth.uid() = (select host_id from public.vibes v where v.id = vibe_id));
drop policy if exists "pins host write" on public.vibe_pins;
create policy "pins host write" on public.vibe_pins for all to authenticated
  using (auth.uid() = (select host_id from public.vibes v where v.id = vibe_id))
  with check (auth.uid() = (select host_id from public.vibes v where v.id = vibe_id));

-- interests: own row, the host, or any confirmed row (for attendee counts/avatars)
drop policy if exists "interests read" on public.vibe_interests;
create policy "interests read" on public.vibe_interests for select to authenticated
  using (
    user_id = auth.uid()
    or status = 'confirmed'
    or auth.uid() = (select host_id from public.vibes v where v.id = vibe_id)
  );
drop policy if exists "interests self insert" on public.vibe_interests;
create policy "interests self insert" on public.vibe_interests for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "interests self update" on public.vibe_interests;
create policy "interests self update" on public.vibe_interests for update to authenticated
  using (user_id = auth.uid());
drop policy if exists "interests self delete" on public.vibe_interests;
create policy "interests self delete" on public.vibe_interests for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "removals read" on public.vibe_removals;
create policy "removals read" on public.vibe_removals for select to authenticated
  using (
    user_id = auth.uid()
    or auth.uid() = (select host_id from public.vibes v where v.id = vibe_id)
  );

-- chats + messages: confirmed attendees and host only
drop policy if exists "chats member read" on public.vibing_chats;
create policy "chats member read" on public.vibing_chats for select to authenticated
  using (public.is_vibe_member(vibe_id));
drop policy if exists "messages member read" on public.vibing_messages;
create policy "messages member read" on public.vibing_messages for select to authenticated
  using (public.is_vibe_member((select vibe_id from public.vibing_chats c where c.id = chat_id)));
drop policy if exists "messages member send" on public.vibing_messages;
create policy "messages member send" on public.vibing_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_vibe_member((select vibe_id from public.vibing_chats c where c.id = chat_id))
  );

-- notifications: own only
drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- Vibe cover photos reuse the existing 'avatars' bucket (owner-scoped path).
