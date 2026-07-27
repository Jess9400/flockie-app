-- ============================================================================
-- Flockie - pending prod migrations, bundled (2026-07-18).
-- Idempotent and safe to re-run. Paste the WHOLE file into the Supabase SQL
-- editor and Run once. Re-running fixes any half-applied earlier attempt
-- (e.g. respond_buddy_plan / set_plan_met that failed on a `pgsql` typo).
-- ============================================================================

-- ── 1) buddy_plans: "propose a plan" + plan-anchored review ─────────────────
create table if not exists public.buddy_plans (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.buddy_chats(id) on delete cascade,
  proposed_by  uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (category in ('coffee','restaurant','bar','park','activity')),
  place_name   text,
  place_url    text,
  when_at      timestamptz,
  status       text not null default 'proposed' check (status in ('proposed','accepted','declined')),
  met          boolean,
  created_at   timestamptz default now()
);
create index if not exists buddy_plans_chat_idx on public.buddy_plans (chat_id, created_at desc);

alter table public.buddy_plans enable row level security;
drop policy if exists "members see plans" on public.buddy_plans;
create policy "members see plans" on public.buddy_plans
  for select to authenticated using (public.is_buddy_chat_member(chat_id));

create or replace function public.propose_buddy_plan(
  p_chat uuid, p_category text, p_place_name text default null,
  p_place_url text default null, p_when timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_buddy_chat_member(p_chat) then raise exception 'not a member of this chat'; end if;
  update public.buddy_plans set status='declined' where chat_id=p_chat and status='proposed';
  insert into public.buddy_plans (chat_id, proposed_by, category, place_name, place_url, when_at)
    values (p_chat, auth.uid(), p_category, nullif(btrim(p_place_name),''), nullif(btrim(p_place_url),''), p_when)
    returning id into v_id;
  insert into public.buddy_messages (chat_id, sender_id, content) values (p_chat, null, '📅 proposed a plan');
  return v_id;
end; $$;
grant execute on function public.propose_buddy_plan(uuid, text, text, text, timestamptz) to authenticated;

create or replace function public.respond_buddy_plan(p_plan uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select chat_id into v_chat from public.buddy_plans where id=p_plan;
  if v_chat is null or not public.is_buddy_chat_member(v_chat) then raise exception 'not allowed'; end if;
  update public.buddy_plans set status=case when p_accept then 'accepted' else 'declined' end
    where id=p_plan and status='proposed';
  insert into public.buddy_messages (chat_id, sender_id, content)
    values (v_chat, null, case when p_accept then '✅ accepted the plan' else '↩️ passed on the plan' end);
end; $$;
grant execute on function public.respond_buddy_plan(uuid, boolean) to authenticated;

create or replace function public.set_plan_met(p_plan uuid, p_met boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select chat_id into v_chat from public.buddy_plans where id=p_plan;
  if v_chat is null or not public.is_buddy_chat_member(v_chat) then raise exception 'not allowed'; end if;
  update public.buddy_plans set met=p_met where id=p_plan and status='accepted';
end; $$;
grant execute on function public.set_plan_met(uuid, boolean) to authenticated;


-- ── 2) Review gate: don't review a match created AFTER the activity ended ───
create or replace function public.pending_reviews()
returns table (buddy_id uuid, display_name text, photo text, destination text)
language sql security definer set search_path = public stable as $$
  select
    (case when m.user_a = auth.uid() then m.user_b else m.user_a end) as buddy_id,
    other.display_name, other.photos[1] as photo, t.destination
  from public.buddy_matches m
  join public.trips t
    on t.id = (case when m.user_a = auth.uid() then m.trip_a else m.trip_b end)
  join public.profiles other
    on other.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  where auth.uid() in (m.user_a, m.user_b)
    and t.end_date < current_date
    and m.created_at::date <= t.end_date
    and not exists (
      select 1 from public.reviews r
      where r.reviewer_id = auth.uid()
        and r.subject_id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
    );
$$;
grant execute on function public.pending_reviews() to authenticated;

create or replace function public.trips_creation_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if exists (
    select 1
    from public.buddy_matches m
    join public.trips t
      on t.id = (case when m.user_a = new.user_id then m.trip_a else m.trip_b end)
    where new.user_id in (m.user_a, m.user_b)
      and t.end_date < current_date
      and m.created_at::date <= t.end_date
      and not exists (
        select 1 from public.reviews r
        where r.reviewer_id = new.user_id
          and r.subject_id = (case when m.user_a = new.user_id then m.user_b else m.user_a end)
      )
  ) then
    raise exception 'Review your past travel buddies before creating a new trip or activity.';
  end if;
  return new;
end; $$;


-- ── 3) Soften buddy_hard_block (drop sober↔drinking; keep same-gender) ──────
create or replace function public.buddy_hard_block(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b)
  select
    ( ( 'I prefer same-gender travel partners' = any(coalesce(a.dealbreakers, '{}'))
        or 'I prefer same-gender travel partners' = any(coalesce(b.dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(a.activity_dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(b.activity_dealbreakers, '{}')) )
      and a.gender is not null and b.gender is not null
      and a.gender <> b.gender )
  from a, b;
$$;
grant execute on function public.buddy_hard_block(uuid, uuid) to authenticated;


-- ── 4) Invite-with-a-plan from the Home Say Hi card ─────────────────────────
-- (from buddy-swipe-plans.sql - stashes the plan on the swipe + seeds it on match)
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
    -- Borrow each user's latest PERSONAL active trip for match context. Never a
    -- public (flock) trip: that would make this 1:1 activity match render as a
    -- Flock group chat and hide the plan/accept UI.
    select id into v_trip_a from public.trips
      where user_id = v_a and status = 'active' and coalesce(visibility, 'private') <> 'public'
      order by created_at desc limit 1;
    select id into v_trip_b from public.trips
      where user_id = v_b and status = 'active' and coalesce(visibility, 'private') <> 'public'
      order by created_at desc limit 1;
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
      -- Seed a plan from whoever proposed one first. The other person's swipe
      -- row is the earlier one (they liked before this call), so prefer it.
      select plan_category, plan_place_name, plan_place_url, plan_when
        into o_category, o_place_name, o_place_url, o_when
      from public.buddy_swipes
      where swiper_id = p_target and target_id = auth.uid();

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
