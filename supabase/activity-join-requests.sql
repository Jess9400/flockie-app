-- ============================================================================
-- Flockie — per-ACTIVITY join tracking (fixes: one "I'm in" hid ALL of that
-- creator's activities from the board + Home carousel, because visibility was
-- keyed on buddy_swipes, i.e. per-person).
-- Run in the Supabase SQL editor. Idempotent / safe to re-run.
--
-- After this: requesting one activity hides only THAT activity for you.
-- Other activities by the same creator stay visible; joining another one
-- while already matched proposes a fresh plan into your existing chat.
-- ============================================================================

create table if not exists public.activity_join_requests (
  activity_id uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (activity_id, user_id)
);
alter table public.activity_join_requests enable row level security;
drop policy if exists "own join requests" on public.activity_join_requests;
create policy "own join requests" on public.activity_join_requests
  for select to authenticated using (user_id = auth.uid());

-- ── Feed: exclude only activities *I* requested (not whole creators) ────────
drop function if exists public.activity_feed(int);
create or replace function public.activity_feed(p_limit int default 30)
returns table (
  activity_id uuid, title text, start_date date, end_date date, city text,
  cover_photo text,
  creator_id uuid, display_name text, age int, photo text, one_liner text,
  score float8
)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid())
  select
    t.id, t.title, t.start_date, t.end_date, t.destination,
    t.cover_photo,
    p.id, p.display_name, p.age, p.photos[1], p.activity_one_liner,
    public.buddy_pair_score(auth.uid(), p.id)::float8
  from public.trips t
  join public.profiles p on p.id = t.user_id
  cross join me
  where t.kind = 'activity'
    and t.status = 'active'
    and coalesce(t.visibility, 'private') <> 'public'
    and t.end_date >= current_date
    and t.user_id <> auth.uid()
    and p.onboarding_complete
    and lower(coalesce(t.destination, '')) = lower(coalesce(me.home_city, ''))
    and not public.buddy_hard_block(auth.uid(), p.id)
    -- hide only the specific activities I already requested
    and not exists (
      select 1 from public.activity_join_requests r
      where r.activity_id = t.id and r.user_id = auth.uid()
    )
  order by 12 desc, t.start_date asc
  limit p_limit;
$$;
grant execute on function public.activity_feed(int) to authenticated;

-- ── "I'm in": record per-activity; already-matched pairs get a new plan in
--    their existing chat instead of being blocked ─────────────────────────────
create or replace function public.request_join_activity(
  p_activity uuid, p_level text default null, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record; me record;
  v_a uuid; v_b uuid; v_chat uuid;
  v_score int; v_ctx text;
begin
  select tr.*, tr.user_id as creator_id into t
  from public.trips tr
  where tr.id = p_activity and tr.kind = 'activity' and tr.status = 'active';
  if not found then raise exception 'activity_not_found'; end if;
  if t.creator_id = auth.uid() then raise exception 'own_activity'; end if;

  if public.buddy_hard_block(auth.uid(), t.creator_id) then
    raise exception 'blocked_by_preferences';
  end if;

  insert into public.activity_join_requests (activity_id, user_id)
  values (p_activity, auth.uid())
  on conflict do nothing;

  select * into me from public.profiles where id = auth.uid();
  v_score := round(public.buddy_pair_score(auth.uid(), t.creator_id));
  v_ctx := concat_ws(' · ',
    nullif(concat_ws(', ',
      coalesce(me.display_name, 'Someone'),
      nullif(me.age::text, ''),
      nullif(me.gender, '')
    ), ''),
    case when p_level is not null and btrim(p_level) <> '' then 'Level: ' || btrim(p_level) end,
    v_score || '% match'
  );

  -- Already matched with this creator? Propose the activity as a fresh plan in
  -- the existing chat (declining any still-open proposal), and let them know.
  v_a := least(auth.uid(), t.creator_id);
  v_b := greatest(auth.uid(), t.creator_id);
  select c.id into v_chat
  from public.buddy_matches m
  join public.buddy_chats c on c.match_id = m.id
  where m.user_a = v_a and m.user_b = v_b;

  if v_chat is not null then
    update public.buddy_plans set status = 'declined'
      where chat_id = v_chat and status = 'proposed';
    insert into public.buddy_plans (chat_id, proposed_by, category, place_name, when_at)
      values (v_chat, auth.uid(), 'activity', nullif(btrim(t.title), ''), null);
    insert into public.buddy_messages (chat_id, sender_id, content)
      values (v_chat, null, '📅 proposed a plan');
    perform public.notify(
      t.creator_id, 'activity_like',
      coalesce(me.display_name, 'Someone') || ' wants to join "' || coalesce(t.title, 'your activity') || '"',
      v_ctx || e'\nYou two already have a chat — accept the plan there.',
      jsonb_build_object('chat_id', v_chat, 'activity_id', t.id)
    );
    return jsonb_build_object('matched', true, 'chat_id', v_chat);
  end if;

  -- Creator already liked me but no chat yet → buddy_swipe completes the match
  -- (and seeds the plan from the stash we set below via its own args).
  if exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = t.creator_id and s.target_id = auth.uid() and s.liked
  ) then
    return public.buddy_swipe(t.creator_id, true, t.title, 'activity', t.title, null, null);
  end if;

  -- Fresh request: like + plan stash + rich notification.
  insert into public.buddy_swipes
    (swiper_id, target_id, liked, plan_category, plan_place_name, plan_place_url, plan_when)
  values (auth.uid(), t.creator_id, true, 'activity', nullif(btrim(t.title), ''), null, null)
  on conflict (swiper_id, target_id) do update set
    liked = true,
    plan_category = excluded.plan_category,
    plan_place_name = excluded.plan_place_name;

  perform public.notify(
    t.creator_id, 'activity_like',
    coalesce(me.display_name, 'Someone') || ' wants to join "' || coalesce(t.title, 'your activity') || '"',
    v_ctx
      || case when p_note is not null and btrim(p_note) <> ''
           then e'\n“' || left(btrim(p_note), 200) || '”' else '' end
      || e'\nOpen their profile to accept.',
    jsonb_build_object('like_from', auth.uid(), 'activity_id', t.id)
  );

  return jsonb_build_object('matched', false, 'requested', true);
end $$;
grant execute on function public.request_join_activity(uuid, text, text) to authenticated;

-- ── My joined activities (per-activity status for My Plans) ─────────────────
create or replace function public.my_joined_activities()
returns table (
  activity_id uuid,
  title text,
  start_date date,
  creator_id uuid,
  creator_name text,
  creator_photo text,
  chat_id uuid,
  plan_status text
)
language sql security definer set search_path = public stable as $$
  select
    t.id, t.title, t.start_date,
    p.id, p.display_name, p.photos[1],
    c.id,
    pl.status
  from public.activity_join_requests r
  join public.trips t on t.id = r.activity_id
  join public.profiles p on p.id = t.user_id
  left join public.buddy_matches m
    on m.user_a = least(r.user_id, t.user_id)
   and m.user_b = greatest(r.user_id, t.user_id)
  left join public.buddy_chats c on c.match_id = m.id
  left join lateral (
    select bp.status
    from public.buddy_plans bp
    where bp.chat_id = c.id
      and lower(coalesce(bp.place_name, '')) = lower(coalesce(t.title, ''))
    order by bp.created_at desc
    limit 1
  ) pl on true
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit 20;
$$;
grant execute on function public.my_joined_activities() to authenticated;
