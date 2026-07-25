-- ============================================================================
-- Flockie - Pinned messages. One pinned message per chat, across every chat
-- type (1:1, flock, vibe, club) — chat_id spans buddy_chats / vibing_chats /
-- clubs, so access is gated by can_access_chat(). Run in the SQL editor.
-- Idempotent.
-- ============================================================================

-- Can the caller see this chat? Works for any chat_id namespace we use.
create or replace function public.can_access_chat(p_chat uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    exists (
      select 1 from public.buddy_chats bc
      join public.buddy_matches m on m.id = bc.match_id
      where bc.id = p_chat and auth.uid() in (m.user_a, m.user_b)
    )
    or exists (
      select 1 from public.vibing_chats c
      where c.id = p_chat and public.is_vibe_member(c.vibe_id)
    )
    or public.is_club_member(p_chat)
    or public.is_club_host(p_chat);
$$;
grant execute on function public.can_access_chat(uuid) to authenticated;

create table if not exists public.chat_pins (
  chat_id uuid primary key,
  content text not null check (char_length(content) between 1 and 2000),
  author_name text,
  pinned_by uuid not null references public.profiles(id) on delete cascade,
  pinned_at timestamptz not null default now()
);

alter table public.chat_pins enable row level security;

-- Anyone in the chat can read the pin, and any member can set/replace/clear it
-- (small trusted groups). Writes must stamp themselves as the pinner.
drop policy if exists "pin read" on public.chat_pins;
create policy "pin read" on public.chat_pins for select to authenticated
  using (public.can_access_chat(chat_id));
drop policy if exists "pin insert" on public.chat_pins;
create policy "pin insert" on public.chat_pins for insert to authenticated
  with check (public.can_access_chat(chat_id) and pinned_by = auth.uid());
drop policy if exists "pin update" on public.chat_pins;
create policy "pin update" on public.chat_pins for update to authenticated
  using (public.can_access_chat(chat_id))
  with check (public.can_access_chat(chat_id) and pinned_by = auth.uid());
drop policy if exists "pin delete" on public.chat_pins;
create policy "pin delete" on public.chat_pins for delete to authenticated
  using (public.can_access_chat(chat_id));

-- Realtime so a new pin lights up for everyone with the chat open.
do $$
begin
  alter publication supabase_realtime add table public.chat_pins;
exception when duplicate_object then null;
  when others then null;
end $$;

notify pgrst, 'reload schema';
