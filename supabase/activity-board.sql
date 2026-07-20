-- ============================================================================
-- Flockie — Activity Board: browse 1:1 activities near you + join with context.
-- Run once in the Supabase SQL editor. Idempotent / safe to re-run.
--
-- Two RPCs:
--   activity_feed(p_limit)              → open activities by others in my city
--                                         (board page + Home carousel)
--   request_join_activity(id, lvl, note)→ "I'm in": records the like (with the
--                                         plan stashed so the match seeds a
--                                         buddy_plan) and sends the creator a
--                                         RICH notification — age, gender,
--                                         self-declared level, note, match % —
--                                         so they accept with full context.
--
-- Accept path (no new UI needed): notification → requester's profile →
-- match back → buddy_swipe seeds the plan from the requester's stash.
-- ============================================================================

-- ── Browse feed ─────────────────────────────────────────────────────────────
-- (drop first: adding cover_photo changes the return type, which
--  create-or-replace alone can't do)
drop function if exists public.activity_feed(int);
create or replace function public.activity_feed(p_limit int default 30)
returns table (
  activity_id uuid,
  title text,
  start_date date,
  end_date date,
  city text,
  cover_photo text,
  creator_id uuid,
  display_name text,
  age int,
  photo text,
  one_liner text,
  score float8
)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid())
  select
    t.id as activity_id,
    t.title,
    t.start_date,
    t.end_date,
    t.destination as city,
    t.cover_photo,
    p.id as creator_id,
    p.display_name,
    p.age,
    p.photos[1] as photo,
    p.activity_one_liner as one_liner,
    public.buddy_pair_score(auth.uid(), p.id)::float8 as score
  from public.trips t
  join public.profiles p on p.id = t.user_id
  cross join me
  where t.kind = 'activity'
    and t.status = 'active'
    and coalesce(t.visibility, 'private') <> 'public'   -- public group trips are Flocks
    and t.end_date >= current_date
    and t.user_id <> auth.uid()
    and p.onboarding_complete
    and lower(coalesce(t.destination, '')) = lower(coalesce(me.home_city, ''))
    and not public.buddy_hard_block(auth.uid(), p.id)
    -- already requested / matched / passed on this creator → hide
    and not exists (
      select 1 from public.buddy_swipes s
      where s.swiper_id = auth.uid() and s.target_id = p.id
    )
  order by score desc, t.start_date asc
  limit p_limit;
$$;
grant execute on function public.activity_feed(int) to authenticated;

-- ── "I'm in" with context ───────────────────────────────────────────────────
create or replace function public.request_join_activity(
  p_activity uuid,
  p_level text default null,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record; me record;
  v_score int;
  v_ctx text;
  v_existing boolean;
begin
  select tr.*, tr.user_id as creator_id into t
  from public.trips tr
  where tr.id = p_activity and tr.kind = 'activity' and tr.status = 'active';
  if not found then raise exception 'activity_not_found'; end if;
  if t.creator_id = auth.uid() then raise exception 'own_activity'; end if;

  if public.buddy_hard_block(auth.uid(), t.creator_id) then
    raise exception 'blocked_by_preferences';
  end if;

  -- If the creator already liked me, this is a mutual → let buddy_swipe do the
  -- match/chat/plan-seed work (it reads MY stash, so stash via its args).
  if exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = t.creator_id and s.target_id = auth.uid() and s.liked
  ) then
    return public.buddy_swipe(t.creator_id, true, t.title, 'activity', t.title, null, null);
  end if;

  select exists (
    select 1 from public.buddy_swipes s
    where s.swiper_id = auth.uid() and s.target_id = t.creator_id
  ) into v_existing;

  -- Record the like with the plan stashed (category 'activity', the activity
  -- title as the "place" detail) so the eventual match auto-seeds a buddy_plan.
  insert into public.buddy_swipes
    (swiper_id, target_id, liked, plan_category, plan_place_name, plan_place_url, plan_when)
  values (auth.uid(), t.creator_id, true, 'activity', nullif(btrim(t.title), ''), null, null)
  on conflict (swiper_id, target_id) do update set
    liked = true,
    plan_category = excluded.plan_category,
    plan_place_name = excluded.plan_place_name;

  -- Rich context so the creator accepts with the right expectations:
  -- age · gender · self-declared level for THIS activity · match % · note.
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

  if not v_existing then
    perform public.notify(
      t.creator_id, 'activity_like',
      coalesce(me.display_name, 'Someone') || ' wants to join "' || coalesce(t.title, 'your activity') || '"',
      v_ctx
        || case when p_note is not null and btrim(p_note) <> ''
             then e'\n“' || left(btrim(p_note), 200) || '”' else '' end
        || e'\nOpen their profile to accept.',
      jsonb_build_object('like_from', auth.uid(), 'activity_id', t.id)
    );
  end if;

  return jsonb_build_object('matched', false, 'requested', true);
end $$;
grant execute on function public.request_join_activity(uuid, text, text) to authenticated;
