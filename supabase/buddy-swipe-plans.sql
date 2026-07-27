-- ============================================================================
-- Flockie - "invite with a plan" from the Home Say Hi card.
-- Idempotent / safe to re-run. Paste into the Supabase SQL editor and Run.
--
-- Redesign: the plan (category + place + date) is now attached at the Say Hi
-- MOMENT, not re-proposed later in chat. The swiper picks "coffee at Blue
-- Tokai, Thu 6pm" on the person's Home card; we stash that on their swipe row.
-- When the other person matches back, we auto-seed a buddy_plans row from the
-- FIRST proposer's stash, so the recipient opens the chat to
-- "Jess invited you for coffee at Blue Tokai · Thu 6pm - Accept".
-- Requires run-on-prod-2026-07-18.sql to have created buddy_plans first.
-- ============================================================================

-- 1) Stash the proposed plan on the swipe row.
alter table public.buddy_swipes add column if not exists plan_category   text;
alter table public.buddy_swipes add column if not exists plan_place_name text;
alter table public.buddy_swipes add column if not exists plan_place_url  text;
alter table public.buddy_swipes add column if not exists plan_when       timestamptz;

-- 2) Rewrite buddy_swipe to accept + stash the plan, and seed buddy_plans on
--    match. Drop the old 3-arg signature so PostgREST resolves cleanly to the
--    new one (extra args default to null → old callers keep working).
drop function if exists public.buddy_swipe(uuid, boolean, text);

create or replace function public.buddy_swipe(
  p_target uuid,
  p_liked boolean,
  p_activity_title text default null,
  p_category text default null,
  p_place_name text default null,
  p_place_url text default null,
  p_when timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_a uuid := least(auth.uid(), p_target);
  v_b uuid := greatest(auth.uid(), p_target);
  v_match uuid; v_chat uuid; v_trip_a uuid; v_trip_b uuid; v_score numeric; v_mutual boolean;
  v_liker text; v_city text;
  v_swipe_new boolean;
  v_new_chat uuid;
  -- seed source: prefer the OTHER person's (first proposer's) stash, else mine
  o_category text; o_place_name text; o_place_url text; o_when timestamptz;
  s_by uuid; s_category text; s_place_name text; s_place_url text; s_when timestamptz;
  v_cat text := nullif(btrim(p_category), '');
begin
  if public.buddy_hard_block(auth.uid(), p_target) then
    raise exception 'blocked_by_preferences';
  end if;

  -- normalise category to the buddy_plans allow-list; anything else → no plan
  if v_cat is not null and v_cat not in ('coffee','restaurant','bar','park','activity') then
    v_cat := null;
  end if;

  insert into public.buddy_swipes
    (swiper_id, target_id, liked, plan_category, plan_place_name, plan_place_url, plan_when)
  values
    (auth.uid(), p_target, p_liked, v_cat,
     nullif(btrim(p_place_name), ''), nullif(btrim(p_place_url), ''), p_when)
  on conflict (swiper_id, target_id) do update set
    liked           = excluded.liked,
    plan_category   = excluded.plan_category,
    plan_place_name = excluded.plan_place_name,
    plan_place_url  = excluded.plan_place_url,
    plan_when       = excluded.plan_when
  returning (xmax = 0) into v_swipe_new;  -- true only when the row was newly inserted

  v_mutual := p_liked and exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = p_target and s.target_id = auth.uid() and s.liked
  );

  if v_mutual then
    -- Read the other person's stashed plan (they liked first, so their swipe
    -- row carries any invite they attached).
    select plan_category, plan_place_name, plan_place_url, plan_when
      into o_category, o_place_name, o_place_url, o_when
    from public.buddy_swipes
    where swiper_id = p_target and target_id = auth.uid();

    -- A plan-based (Home "Say hi") match has NO shared trip. Only borrow a
    -- personal trip for context when NEITHER side attached a plan - and never a
    -- public (flock) trip, which would render this 1:1 as a Flock group chat.
    -- This keeps the random "Jul 25 · Party" trip line out of plan matches and
    -- stops the review gate from firing on a borrowed trip.
    if o_category is null and v_cat is null then
      select id into v_trip_a from public.trips
        where user_id = v_a and status = 'active' and coalesce(visibility, 'private') <> 'public'
        order by created_at desc limit 1;
      select id into v_trip_b from public.trips
        where user_id = v_b and status = 'active' and coalesce(visibility, 'private') <> 'public'
        order by created_at desc limit 1;
    end if;
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
      -- Seed a plan from whoever proposed one first (o_* was read above; the
      -- other person's swipe row is the earlier one, so prefer it).
      if o_category is not null then
        s_by := p_target; s_category := o_category;
        s_place_name := o_place_name; s_place_url := o_place_url; s_when := o_when;
      elsif v_cat is not null then
        s_by := auth.uid(); s_category := v_cat;
        s_place_name := nullif(btrim(p_place_name), '');
        s_place_url  := nullif(btrim(p_place_url), '');
        s_when := p_when;
      end if;

      if s_category is not null then
        insert into public.buddy_plans
          (chat_id, proposed_by, category, place_name, place_url, when_at, status)
        values (v_chat, s_by, s_category, s_place_name, s_place_url, s_when, 'proposed');
        insert into public.buddy_messages (chat_id, sender_id, content)
          values (v_chat, null, '📅 proposed a plan');
      end if;

      perform public.notify(p_target, 'buddy_match', 'It''s a match! 🎉', 'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
      perform public.notify(auth.uid(), 'buddy_match', 'It''s a match! 🎉', 'You both liked each other. Say hi.', jsonb_build_object('chat_id', v_chat));
    end if;
    return jsonb_build_object('matched', true, 'chat_id', v_chat);
  elsif p_liked and v_swipe_new then
    select display_name, home_city into v_liker, v_city from public.profiles where id = auth.uid();
    perform public.notify(
      p_target, 'activity_like',
      coalesce(v_liker, 'Someone') || ' wants to do something with you',
      coalesce(v_liker, 'Someone') || ' is in ' || coalesce(v_city, 'your city') ||
        ' looking for someone to do ' ||
        coalesce(nullif(p_activity_title, ''), v_cat, 'something') ||
        ' - your vibes match. Match back to chat.',
      jsonb_build_object('like_from', auth.uid())
    );
  end if;
  return jsonb_build_object('matched', false);
end $$;

grant execute on function public.buddy_swipe(uuid, boolean, text, text, text, text, timestamptz) to authenticated;
