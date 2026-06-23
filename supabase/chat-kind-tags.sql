-- Add a `kind` to buddy chat summaries so the Chats list can tag each row as a
-- Travel Buddy, Activity Buddy, or Flock. (Vibe chats are tagged 'vibe' and
-- my_flock_chats rows 'flock' in the app.) Run in the Supabase SQL editor.
-- Safe to re-run. Drop is required because the return signature changes.

drop function if exists public.buddy_chat_summaries();
create or replace function public.buddy_chat_summaries()
returns table(chat_id uuid, name text, photo text, last_at timestamptz, unread integer, kind text)
language sql stable security definer set search_path to 'public'
as $function$
  select bc.id,
    -- For a flock, show the destination instead of one member's name.
    case when exists (select 1 from public.trips t
                      where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public')
         then coalesce((select t.destination from public.trips t
                        where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public' limit 1),
                       o.display_name)
         else o.display_name end as name,
    (o.photos)[1] as photo,
    coalesce(lm.last_at, bc.created_at) as last_at,
    coalesce((select count(*) from public.buddy_messages m
      where m.chat_id=bc.id and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select last_read_at from public.chat_reads r
              where r.user_id=auth.uid() and r.chat_id=bc.id),'epoch')),0)::int as unread,
    case
      when exists (select 1 from public.trips t
                   where t.id in (mt.trip_a, mt.trip_b) and t.visibility = 'public') then 'flock'
      when exists (select 1 from public.trips t
                   where t.id in (mt.trip_a, mt.trip_b) and t.kind = 'activity') then 'activity_buddy'
      else 'travel_buddy'
    end as kind
  from public.buddy_chats bc
  join public.buddy_matches mt on mt.id = bc.match_id
  join public.profiles o on o.id = case when mt.user_a=auth.uid() then mt.user_b else mt.user_a end
  left join lateral (select max(created_at) last_at from public.buddy_messages m where m.chat_id=bc.id) lm on true
  where auth.uid() in (mt.user_a, mt.user_b)
  order by last_at desc;
$function$;
grant execute on function public.buddy_chat_summaries() to authenticated;
