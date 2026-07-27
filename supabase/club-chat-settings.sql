-- ============================================================================
-- Flockie Clubs - chat header settings: members list, leave, mute-aware
-- badge + heartbeat. Run AFTER clubs-loop.sql. Idempotent / safe to re-run.
-- ============================================================================

-- Members list, visible to members/host only (the base table's RLS is
-- deliberately owner/self-only, so the chat needs this definer RPC).
create or replace function public.club_members(p_club uuid)
returns table (id uuid, display_name text, photo text, role text, status text)
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos[1],
         case when c.owner_id = p.id then 'host' else m.role end,
         m.status
  from public.clubs c
  join public.club_memberships m on m.club_id = c.id
  join public.profiles p on p.id = m.user_id
  where c.id = p_club
    and m.status in ('founding', 'regular')
    and (public.is_club_member(p_club) or public.is_club_host(p_club))
  order by
    case when c.owner_id = p.id then 0 else 1 end,
    m.joined_at asc nulls last;
$$;
grant execute on function public.club_members(uuid) to authenticated;

-- Leave the club (members only - the host closes it instead).
create or replace function public.leave_club(p_club uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_club_host(p_club) then
    raise exception 'the host cannot leave - close the club instead';
  end if;
  update public.club_memberships
     set status = 'left'
   where club_id = p_club and user_id = auth.uid()
     and status in ('founding', 'regular', 'invited', 'requested');
  if not found then raise exception 'not a member of this club'; end if;
end;
$$;
grant execute on function public.leave_club(uuid) to authenticated;

-- Muted clubs: badge goes quiet (chat_mutes.chat_id doubles as club_id).
create or replace function public.my_club_chats()
returns table (club_id uuid, title text, cover_photo text, unread int, last_at timestamptz)
language sql security definer set search_path = public stable as $$
  select
    c.id,
    c.title,
    c.cover_photo,
    case when exists (
      select 1 from public.chat_mutes cm where cm.user_id = auth.uid() and cm.chat_id = c.id
    ) then 0 else (
      select count(*)::int
      from public.club_messages m
      left join public.chat_reads cr
        on cr.user_id = auth.uid() and cr.chat_id = c.id
      where m.club_id = c.id
        and (m.sender_id is null or m.sender_id <> auth.uid())
        and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    ) end as unread,
    (select max(m2.created_at) from public.club_messages m2 where m2.club_id = c.id) as last_at
  from public.clubs c
  where c.status in ('forming', 'active', 'paused')
    and (
      c.owner_id = auth.uid()
      or exists (
        select 1 from public.club_memberships cm
        where cm.club_id = c.id and cm.user_id = auth.uid()
          and cm.status in ('founding', 'regular')
      )
    );
$$;
grant execute on function public.my_club_chats() to authenticated;
