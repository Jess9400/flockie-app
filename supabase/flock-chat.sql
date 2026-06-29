-- Flock group chat = the buddy chat (approved members join it) + capacity + remove.
-- Run in the Supabase SQL editor. Safe to re-run. (Needs flock-from-buddy.sql first.)

-- Approved Flock members can read/post in the converted buddy chat.
create or replace function public.is_buddy_chat_member(p_chat uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.buddy_chats bc
    join public.buddy_matches m on m.id = bc.match_id
    where bc.id = p_chat and (
      auth.uid() in (m.user_a, m.user_b)
      or exists (
        select 1 from public.trip_join_requests j
        where j.trip_id in (m.trip_a, m.trip_b)
          and j.user_id = auth.uid() and j.status = 'accepted'
      )
    )
  );
$$;

-- Respond to a join request, now with a capacity guard (host + accepted < size).
create or replace function public.respond_join_request(p_trip uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_cohost uuid; v_dest text; v_cap int; v_going int;
        v_appr uuid[]; v_required uuid[];
begin
  select user_id, co_host_id, destination, coalesce(group_size, 99)
    into v_host, v_cohost, v_dest, v_cap
    from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if auth.uid() <> v_host and auth.uid() is distinct from v_cohost then
    raise exception 'only the flock hosts can respond';
  end if;

  if not p_approve then
    update public.trip_join_requests set status = 'declined'
      where trip_id = p_trip and user_id = p_user;
    return;
  end if;

  select coalesce(approvals, '{}') into v_appr
    from public.trip_join_requests where trip_id = p_trip and user_id = p_user;
  v_appr := (select array(select distinct unnest(v_appr || array[auth.uid()])));
  v_required := case when v_cohost is null then array[v_host] else array[v_host, v_cohost] end;

  if v_required <@ v_appr then
    select count(*) into v_going from public.trip_join_requests
      where trip_id = p_trip and status = 'accepted';
    if (1 + v_going) >= v_cap then
      raise exception 'This Flock is full.';
    end if;
    update public.trip_join_requests set status = 'accepted', approvals = v_appr
      where trip_id = p_trip and user_id = p_user;
    perform public.notify(p_user, 'flock_approved', 'You''re in! ' || v_dest,
      'Your request to join was approved.', jsonb_build_object('trip_id', p_trip));
  else
    update public.trip_join_requests set approvals = v_appr
      where trip_id = p_trip and user_id = p_user;
  end if;
end $$;
grant execute on function public.respond_join_request(uuid, uuid, boolean) to authenticated;

-- Hosts remove a member (frees a spot; Flock reappears in Find a Flock).
create or replace function public.remove_flock_member(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_cohost uuid;
begin
  select user_id, co_host_id into v_host, v_cohost from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if auth.uid() <> v_host then
    raise exception 'only the host can remove members';
  end if;
  if p_user = v_host or p_user is not distinct from v_cohost then
    raise exception 'cannot remove a host';
  end if;
  update public.trip_join_requests set status = 'declined'
    where trip_id = p_trip and user_id = p_user;
  perform public.notify(p_user, 'flock_removed', 'Removed from a Flock',
    'A host removed you from the group trip.', jsonb_build_object('trip_id', p_trip));
end $$;
grant execute on function public.remove_flock_member(uuid, uuid) to authenticated;

-- A member removes themselves from a Flock they joined (hosts can't leave this way).
create or replace function public.leave_flock(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_cohost uuid;
begin
  select user_id, co_host_id into v_host, v_cohost from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if auth.uid() = v_host or auth.uid() is not distinct from v_cohost then
    raise exception 'a host cannot leave their own Flock';
  end if;
  update public.trip_join_requests set status = 'declined'
    where trip_id = p_trip and user_id = auth.uid();
  perform public.notify(v_host, 'flock_left', 'Someone left your Flock',
    'A member left the group trip.', jsonb_build_object('trip_id', p_trip));
end $$;
grant execute on function public.leave_flock(uuid) to authenticated;

-- Flock chats I've joined (as an approved member, not an original buddy) — so
-- they show in my Chats list.
create or replace function public.my_flock_chats()
returns table (chat_id uuid, name text, photo text)
language sql security definer set search_path = public stable as $$
  select bc.id,
         coalesce(t.destination, 'Flock') as name,
         coalesce(t.cover_photo, hp.photos[1]) as photo  -- trip banner, not host face
  from public.trip_join_requests j
  join public.trips t on t.id = j.trip_id and t.visibility = 'public'
  join public.buddy_matches m on (m.trip_a = t.id or m.trip_b = t.id)
  join public.buddy_chats bc on bc.match_id = m.id
  left join public.profiles hp on hp.id = t.user_id
  where j.user_id = auth.uid() and j.status = 'accepted'
    and auth.uid() not in (m.user_a, m.user_b);
$$;
grant execute on function public.my_flock_chats() to authenticated;
