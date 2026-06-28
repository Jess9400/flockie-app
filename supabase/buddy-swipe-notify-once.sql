-- P0 fix: stop buddy_swipe from re-notifying on repeat calls.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Before: every buddy_swipe(target, true, …) on an already-matched pair re-fired
-- "It's a match!" to both users, and every repeat like re-fired the activity-like
-- notification — a spam vector (a client could loop the RPC to flood someone).
-- After: the match notification fires only when the chat row is newly created,
-- and the activity-like notification fires only on a fresh like (new swipe row).
-- Behavior, matching, and the returned shape are otherwise unchanged.

create or replace function public.buddy_swipe(p_target uuid, p_liked boolean, p_activity_title text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_a uuid := least(auth.uid(), p_target);
  v_b uuid := greatest(auth.uid(), p_target);
  v_match uuid; v_chat uuid; v_trip_a uuid; v_trip_b uuid; v_score numeric; v_mutual boolean;
  v_liker text; v_city text;
  v_swipe_new boolean;
  v_new_chat uuid;
begin
  insert into public.buddy_swipes (swiper_id, target_id, liked)
  values (auth.uid(), p_target, p_liked)
  on conflict (swiper_id, target_id) do update set liked = excluded.liked
  returning (xmax = 0) into v_swipe_new;  -- true only when the row was newly inserted

  v_mutual := p_liked and exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = p_target and s.target_id = auth.uid() and s.liked
  );

  if v_mutual then
    select id into v_trip_a from public.trips where user_id = v_a and status = 'active' order by created_at desc limit 1;
    select id into v_trip_b from public.trips where user_id = v_b and status = 'active' order by created_at desc limit 1;
    v_score := public.buddy_pair_score(v_a, v_b);
    insert into public.buddy_matches (user_a, user_b, trip_a, trip_b, score)
    values (v_a, v_b, v_trip_a, v_trip_b, v_score)
    on conflict (user_a, user_b) do update set
      trip_a = coalesce(public.buddy_matches.trip_a, excluded.trip_a),
      trip_b = coalesce(public.buddy_matches.trip_b, excluded.trip_b),
      score  = coalesce(public.buddy_matches.score,  excluded.score);
    select id into v_match from public.buddy_matches where user_a = v_a and user_b = v_b;
    insert into public.buddy_chats (match_id) values (v_match)
      on conflict (match_id) do nothing
      returning id into v_new_chat;  -- set only when the chat is created this call
    select id into v_chat from public.buddy_chats where match_id = v_match;
    if v_new_chat is not null then
      perform public.notify(p_target, 'buddy_match', 'It''s a match! 🎉', 'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
      perform public.notify(auth.uid(), 'buddy_match', 'It''s a match! 🎉', 'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    end if;
    return jsonb_build_object('matched', true, 'chat_id', v_chat);
  elsif p_liked and p_activity_title is not null and v_swipe_new then
    select display_name, home_city into v_liker, v_city from public.profiles where id = auth.uid();
    perform public.notify(
      p_target, 'activity_like',
      coalesce(v_liker, 'Someone') || ' wants to do something with you',
      coalesce(v_liker, 'Someone') || ' is in ' || coalesce(v_city, 'your city') ||
        ' looking for someone to do ' || p_activity_title || ' — your vibes match. Match back to chat.',
      jsonb_build_object('like_from', auth.uid())
    );
  end if;
  return jsonb_build_object('matched', false);
end $$;
grant execute on function public.buddy_swipe(uuid, boolean, text) to authenticated;
