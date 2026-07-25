-- ============================================================================
-- Flockie - fix flock chats missing from the Chats list.
-- Two causes: (1) a flock with accepted members whose group chat was never
-- seeded (approved via the old path); (2) my_flock_chats excluded the host and
-- first member. Run in the SQL editor. Idempotent.
-- ============================================================================

-- 1) Backfill: every public trip with >=1 accepted member but no chat gets one,
--    seeded on the host + earliest accepted member (same shape respond_join
--    _request uses). Later members already reach it via my_flock_chats.
do $$
declare r record; v_a uuid; v_b uuid; v_match uuid;
begin
  for r in
    select t.id as trip_id, t.user_id as host_id,
           (select j.user_id from public.trip_join_requests j
             where j.trip_id = t.id and j.status = 'accepted'
             order by j.created_at asc limit 1) as first_member
    from public.trips t
    where t.visibility = 'public' and t.status = 'active'
      and exists (select 1 from public.trip_join_requests j
                  where j.trip_id = t.id and j.status = 'accepted')
      and not exists (
        select 1 from public.buddy_matches m
        join public.buddy_chats bc on bc.match_id = m.id
        where t.id in (m.trip_a, m.trip_b))
  loop
    if r.first_member is null then continue; end if;
    v_a := least(r.host_id, r.first_member);
    v_b := greatest(r.host_id, r.first_member);
    insert into public.buddy_matches (user_a, user_b, trip_a, score)
      values (v_a, v_b, r.trip_id, 100)
      on conflict (user_a, user_b) do update set trip_a = excluded.trip_a
      returning id into v_match;
    if v_match is null then
      select id into v_match from public.buddy_matches where user_a = v_a and user_b = v_b;
    end if;
    insert into public.buddy_chats (match_id) values (v_match)
      on conflict (match_id) do nothing;
  end loop;
end $$;

-- 2) my_flock_chats now covers the HOST and every accepted member of a public
--    trip that has a chat. Dedups against buddy_chat_summaries in the app layer
--    (chat-list-data appends a flock row only if the chat_id isn't already
--    present), so broadening here is safe and closes the gap.
create or replace function public.my_flock_chats()
returns table (chat_id uuid, name text, photo text)
language sql security definer set search_path = public stable as $$
  select bc.id,
         coalesce(t.destination, 'Flock') as name,
         coalesce(t.cover_photo, hp.photos[1]) as photo
  from public.trips t
  join public.buddy_matches m on (m.trip_a = t.id or m.trip_b = t.id)
  join public.buddy_chats bc on bc.match_id = m.id
  left join public.profiles hp on hp.id = t.user_id
  where t.visibility = 'public'
    and (
      t.user_id = auth.uid()
      or exists (select 1 from public.trip_join_requests j
                 where j.trip_id = t.id and j.user_id = auth.uid() and j.status = 'accepted')
    );
$$;
grant execute on function public.my_flock_chats() to authenticated;
