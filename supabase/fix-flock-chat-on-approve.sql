-- Fix: approving a join request on a directly-created Flock didn't open a chat.
--
-- The Flock group chat is a buddy_chat hung off a buddy_match whose trip_a/trip_b
-- points at the flock trip. Flocks *converted from a buddy pair* already have
-- that match+chat, but Flocks *created directly* (Create a Flock) never do — so
-- respond_join_request accepted the member but no chat existed. This:
--   1) re-creates respond_join_request to SEED the group chat on first approval,
--   2) backfills a chat for already-accepted flocks that are missing one.
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.respond_join_request(p_trip uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_host uuid; v_cohost uuid; v_dest text; v_cap int; v_going int;
  v_appr uuid[]; v_required uuid[];
  v_chat uuid; v_match uuid; v_a uuid; v_b uuid;
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

  -- Record this host's approval. A co-hosted flock needs BOTH hosts.
  select coalesce(approvals, '{}') into v_appr
    from public.trip_join_requests where trip_id = p_trip and user_id = p_user;
  v_appr := (select array(select distinct unnest(v_appr || array[auth.uid()])));
  v_required := case when v_cohost is null then array[v_host] else array[v_host, v_cohost] end;

  if not (v_required <@ v_appr) then
    update public.trip_join_requests set approvals = v_appr
      where trip_id = p_trip and user_id = p_user;
    return; -- still waiting on the co-host
  end if;

  -- Capacity guard (host + already-accepted).
  select count(*) into v_going from public.trip_join_requests
    where trip_id = p_trip and status = 'accepted';
  if (1 + v_going) >= v_cap then raise exception 'This Flock is full.'; end if;

  update public.trip_join_requests set status = 'accepted', approvals = v_appr
    where trip_id = p_trip and user_id = p_user;

  -- Ensure the Flock has a group chat. Seed one if this trip has none yet.
  select bc.id into v_chat
    from public.buddy_matches m
    join public.buddy_chats bc on bc.match_id = m.id
    where p_trip in (m.trip_a, m.trip_b)
    limit 1;
  if v_chat is null then
    v_a := least(v_host, p_user); v_b := greatest(v_host, p_user);
    insert into public.buddy_matches (user_a, user_b, trip_a, score)
      values (v_a, v_b, p_trip, 100)
      on conflict (user_a, user_b) do update set trip_a = excluded.trip_a
      returning id into v_match;
    insert into public.buddy_chats (match_id) values (v_match)
      on conflict (match_id) do nothing;
  end if;

  perform public.notify(p_user, 'flock_approved', 'You''re in! ' || v_dest,
    'Your request to join was approved — say hi in the group chat.',
    jsonb_build_object('trip_id', p_trip));
end $$;
grant execute on function public.respond_join_request(uuid, uuid, boolean) to authenticated;

-- Backfill: seed a chat for public flocks that already have an accepted member
-- but no chat (the ones approved before this fix).
do $$
declare r record; v_match uuid; v_a uuid; v_b uuid;
begin
  for r in
    select t.id as trip_id, t.user_id as host, j.user_id as member
    from public.trips t
    join lateral (
      select user_id from public.trip_join_requests
      where trip_id = t.id and status = 'accepted'
      order by user_id limit 1
    ) j on true
    where t.visibility = 'public'
      and not exists (
        select 1 from public.buddy_matches m
        join public.buddy_chats bc on bc.match_id = m.id
        where t.id in (m.trip_a, m.trip_b)
      )
  loop
    v_a := least(r.host, r.member); v_b := greatest(r.host, r.member);
    insert into public.buddy_matches (user_a, user_b, trip_a, score)
      values (v_a, v_b, r.trip_id, 100)
      on conflict (user_a, user_b) do update set trip_a = excluded.trip_a
      returning id into v_match;
    insert into public.buddy_chats (match_id) values (v_match)
      on conflict (match_id) do nothing;
  end loop;
end $$;
