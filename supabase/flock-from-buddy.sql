-- Turn a 1:1 buddy trip into a Flock, with both buddies approving new joiners.
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.trips
  add column if not exists co_host_id uuid references public.profiles(id) on delete set null;

alter table public.trip_join_requests
  add column if not exists approvals uuid[] not null default '{}';

-- needed for the on-conflict upsert below
create unique index if not exists trip_join_requests_trip_user_uniq
  on public.trip_join_requests (trip_id, user_id);

-- Convert the caller's trip in a match into a public Flock; co-host = the buddy.
create or replace function public.convert_match_to_flock(p_match uuid, p_group_size int default 4)
returns uuid language plpgsql security definer set search_path = public as $$
declare m public.buddy_matches%rowtype; v_trip uuid; v_other uuid; v_existing uuid;
begin
  select * into m from public.buddy_matches where id = p_match and auth.uid() in (user_a, user_b);
  if not found then raise exception 'not a member of this match'; end if;
  v_trip := case when m.user_a = auth.uid() then m.trip_a else m.trip_b end;
  v_other := case when m.user_a = auth.uid() then m.user_b else m.user_a end;
  if v_trip is null then raise exception 'no trip on this match to convert'; end if;

  -- already converted? reuse the existing flock
  select id into v_existing from public.trips
    where id in (m.trip_a, m.trip_b) and visibility = 'public' and co_host_id is not null
    limit 1;
  if v_existing is not null then return v_existing; end if;

  update public.trips
    set visibility = 'public', co_host_id = v_other,
        group_size = greatest(coalesce(group_size, 2), greatest(p_group_size, 3))
    where id = v_trip;

  insert into public.trip_join_requests (trip_id, user_id, status, approvals)
    values (v_trip, v_other, 'accepted', '{}')
    on conflict (trip_id, user_id) do update set status = 'accepted';

  perform public.notify(v_other, 'flock_created', 'Your trip is now a Flock',
    'You and your buddy opened the trip to a group — approve who joins together.',
    jsonb_build_object('trip_id', v_trip));
  return v_trip;
end $$;
grant execute on function public.convert_match_to_flock(uuid, int) to authenticated;

-- Respond to a join request. For a converted Flock (co_host set) BOTH hosts must
-- approve before the joiner is accepted; for a normal flock the host alone does.
create or replace function public.respond_join_request(p_trip uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_cohost uuid; v_dest text; v_appr uuid[]; v_required uuid[];
begin
  select user_id, co_host_id, destination into v_host, v_cohost, v_dest
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
