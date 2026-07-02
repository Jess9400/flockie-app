-- ════════════════════════════════════════════════════════════════════════════
-- deploy-full-2026-07-02.sql
-- ALL pending prod SQL for the audit + tombstone batches, concatenated in
-- dependency order. Run the WHOLE file once in the Supabase SQL editor.
-- Idempotent (CREATE OR REPLACE / DROP IF EXISTS); safe to re-run.
-- Source of truth is the individual files; this is a convenience bundle.
-- SUPERSEDED /* ... */ blocks inside are commented out and do nothing.
-- ════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- [01] vibe-eligibility-enforce.sql
-- ═══════════════════════════════════════════════════════════════════

-- Vibe eligibility enforcement: the host's gender/age preferences, checked at
-- every funnel entry point. Run in the Supabase SQL editor BEFORE re-running
-- vibe-interests-status-lock.sql (whose INSERT policy now calls this helper).
-- Safe to re-run.
--
-- Before this, gender_pref / age_min / age_max were only enforced by the cold
-- same-city fallback (and even there the age filter had been lost) — the main
-- funnel (interest button → _rank_vibe_core shortlist → recommended_vibes)
-- ignored them entirely, so e.g. men could be shortlisted for women-only vibes.
--
-- vibe_eligible(user, vibe) — does the user's profile satisfy the vibe's
-- gender_pref / age_min / age_max?
--   * no prefs set (or gender_pref = 'any')  -> eligible
--   * gender_pref set, gender unknown        -> NOT eligible (the host explicitly
--       restricted; same semantics as invite_city_fallback's inline gender check)
--   * age range set, age unknown             -> eligible (matches the age filter
--       the matching SQL has always used: null age passes)
-- Used by: _rank_vibe_core (vibe-v2-private-link.sql), recommended_vibes
-- (recommended-vibes.sql), invite_city_fallback (vibe-auto-matching.sql), the
-- vibe_interests INSERT policy (vibe-interests-status-lock.sql), and the
-- InterestButton pre-check in the app.

create or replace function public.vibe_eligible(p_user uuid, p_vibe uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.vibes v
    left join public.profiles p on p.id = p_user
    where v.id = p_vibe
      and (v.gender_pref is null or v.gender_pref = 'any'
           or (v.gender_pref = 'women' and p.gender = 'woman')
           or (v.gender_pref = 'men' and p.gender = 'man'))
      and (v.age_min is null or p.age is null or p.age >= v.age_min)
      and (v.age_max is null or p.age is null or p.age <= v.age_max)
  );
$$;
grant execute on function public.vibe_eligible(uuid, uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- [02] vibe-attendees-rls.sql
-- ═══════════════════════════════════════════════════════════════════

-- P1 FIX (2026-07-02): stop attendance enumeration via vibe_interests.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Before this, the "interests read" SELECT policy included an unscoped
-- `or status = 'confirmed'` — any signed-in user could query
-- `vibe_interests?user_id=eq.X&status=eq.confirmed` and enumerate ANYONE's
-- confirmed vibes (raw rows: vibe_id + timestamps), deriving their future
-- whereabouts across the whole app.
--
-- Fix: the table policy now only allows own rows and the vibe host. The two
-- legitimate public surfaces move behind SECURITY DEFINER RPCs that expose
-- only safe, per-vibe data:
--   • vibe_attendees(p_vibe)         — the "Going" strip on the vibe page
--                                      (id, display_name, photos via the safe
--                                      public_profiles view)
--   • vibe_confirmed_counts(p_vibes) — aggregate "X going" counts for vibe
--                                      cards (home / vibes list / my-vibes);
--                                      no user ids leave the database.

-- ── attendee strip: confirmed attendees of one vibe (safe fields only) ─────
create or replace function public.vibe_attendees(p_vibe uuid)
returns table (id uuid, display_name text, photos text[])
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos
  from public.vibe_interests i
  join public.public_profiles p on p.id = i.user_id
  where i.vibe_id = p_vibe
    and i.status = 'confirmed'
  order by i.confirmed_at nulls last, i.created_at;
$$;
revoke all on function public.vibe_attendees(uuid) from public, anon;
grant execute on function public.vibe_attendees(uuid) to authenticated;

-- ── card counts: confirmed ("going") tallies for a set of vibes ────────────
create or replace function public.vibe_confirmed_counts(p_vibes uuid[])
returns table (vibe_id uuid, going int)
language sql security definer set search_path = public stable as $$
  select i.vibe_id, count(*)::int as going
  from public.vibe_interests i
  where i.vibe_id = any (p_vibes)
    and i.status = 'confirmed'
  group by i.vibe_id;
$$;
revoke all on function public.vibe_confirmed_counts(uuid[]) from public, anon;
grant execute on function public.vibe_confirmed_counts(uuid[]) to authenticated;

-- ── scoped SELECT policy: own rows + the vibe host only ────────────────────
-- (Canonical definition — the old broad version in vibes-module.sql is
-- tombstoned so a re-run there can't re-open the table.)
drop policy if exists "interests read" on public.vibe_interests;
create policy "interests read" on public.vibe_interests for select to authenticated
  using (
    user_id = auth.uid()
    or auth.uid() = (select host_id from public.vibes v where v.id = vibe_id)
  );


-- ═══════════════════════════════════════════════════════════════════
-- [03] fix-incoming-swipe-rls.sql
-- ═══════════════════════════════════════════════════════════════════

-- Fix: invitees couldn't see the "Match back & chat" button.
--
-- The /people/[id] page detects an incoming like by reading the other user's
-- swipe row (swiper_id = them, target_id = me). The existing "own swipes" policy
-- only allows reading rows where swiper_id = auth.uid(), so that read was blocked
-- by RLS and the match-back button never showed.
--
-- Add a SELECT-only policy so you can also READ swipes that target you. Writes
-- (insert/update/delete) stay restricted to your own rows via the existing
-- "own swipes" policy. Run in the Supabase SQL editor. Safe to re-run.
--
-- P2 FIX (2026-07-02): scope the incoming clause with `and liked`. The first
-- version exposed ALL rows where target_id = auth.uid(), so users could also see
-- who swiped NO on them. The app only ever needs incoming liked=true rows
-- (the match-back check on /people/[id]).

drop policy if exists "see incoming swipes" on public.buddy_swipes;
create policy "see incoming swipes" on public.buddy_swipes
  for select to authenticated
  using (swiper_id = auth.uid() or (target_id = auth.uid() and liked));


-- ═══════════════════════════════════════════════════════════════════
-- [04] legacy-buddy-cleanup.sql
-- ═══════════════════════════════════════════════════════════════════

-- Cleanup (2026-07-02): drop the legacy buddy-matching functions from
-- supabase/buddy-matching.sql. Run in the Supabase SQL editor. Safe to re-run.
--
-- These were the original flat-weight deck — no hard-block filtering, still
-- granted to authenticated, and unused by the client. Canonical replacements:
--   • buddy_candidates_trip            (supabase/match-priorities.sql)
--   • buddy_swipe(uuid, boolean, text) (supabase/buddy-swipe-notify-once.sql)
--
-- Signatures are exact so the live 3-arg buddy_swipe(uuid, boolean, text)
-- is untouched.

drop function if exists public.buddy_city_count();
drop function if exists public.buddy_candidates(int);
drop function if exists public.buddy_swipe(uuid, boolean);


-- ═══════════════════════════════════════════════════════════════════
-- [05] fix-flock-chat-on-approve.sql
-- ═══════════════════════════════════════════════════════════════════

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
    -- Only flip (and notify) a live request, so re-running a decline can't spam.
    update public.trip_join_requests set status = 'declined'
      where trip_id = p_trip and user_id = p_user and status <> 'declined';
    if found then
      perform public.notify(p_user, 'flock_declined', 'Update on ' || v_dest,
        'The host went with other travelers for ' || v_dest || ' this time. More Flocks are waiting for you.',
        jsonb_build_object('trip_id', p_trip));
    end if;
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
    select id into v_chat from public.buddy_chats where match_id = v_match;
  end if;

  -- chat_id in the payload so the inbox can deep-link straight into the chat
  -- (/my-trips only lists trips the viewer hosts, so it was a dead end here).
  perform public.notify(p_user, 'flock_approved', 'You''re in! ' || v_dest,
    'Your request to join was approved — say hi in the group chat.',
    jsonb_build_object('trip_id', p_trip, 'chat_id', v_chat));
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


-- ═══════════════════════════════════════════════════════════════════
-- [06] flock-requests.sql
-- ═══════════════════════════════════════════════════════════════════

-- Flock join approvals: host accepts/declines requests; "going" = host + accepted.
-- Run the whole file in the Supabase SQL editor. Safe to re-run.

-- Base table. Columns are exact (captured from prod 2026-06-29); the PK/FKs are
-- the natural reconstruction so a fresh DB is reproducible. `create ... if not
-- exists` is a no-op on prod (the table already exists there).
create table if not exists public.trip_join_requests (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  created_at timestamptz default now(),
  status     text not null default 'pending',
  approvals  uuid[] not null default '{}',
  primary key (trip_id, user_id)
);

alter table public.trip_join_requests
  add column if not exists status text not null default 'pending';

-- A user requests to join a public Flock → creates a request (status defaults to
-- 'pending') and notifies the host. Captured from prod 2026-06-29; updated to let
-- a previously-declined user request again: their old row resets to 'pending'
-- (approvals cleared) instead of the insert silently no-op'ing. The host is only
-- notified when a request was actually created/revived (no repeat-click spam).
create or replace function public.request_join_trip(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
  declare v public.trips;
  begin
    select * into v from public.trips where id = p_trip;
    if v.id is null or v.visibility <> 'public' then raise exception 'not joinable'; end if;
    if v.user_id = auth.uid() then raise exception 'own trip'; end if;
    insert into public.trip_join_requests (trip_id, user_id) values (p_trip, auth.uid())
      on conflict (trip_id, user_id) do update
        set status = 'pending', approvals = '{}', created_at = now()
        where trip_join_requests.status = 'declined';
    if found then
      perform public.notify(v.user_id, 'trip_join_request', 'Someone wants to join your trip',
        'A flockie requested to join your ' || v.destination || ' trip.',
        jsonb_build_object('trip_id', p_trip));
    end if;
  end $$;
grant execute on function public.request_join_trip(uuid) to authenticated;

-- Host approves a request → member is "going".
create or replace function public.approve_join_request(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_dest text;
begin
  select user_id, destination into v_host, v_dest from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can approve'; end if;
  update public.trip_join_requests set status = 'accepted'
    where trip_id = p_trip and user_id = p_user;
  perform public.notify(p_user, 'flock_approved', 'You''re in! ' || v_dest,
          'The host approved your request to join.', jsonb_build_object('trip_id', p_trip));
end $$;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;

-- Host declines a request.
create or replace function public.decline_join_request(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  select user_id into v_host from public.trips where id = p_trip;
  if v_host is null then raise exception 'trip not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can decline'; end if;
  update public.trip_join_requests set status = 'declined'
    where trip_id = p_trip and user_id = p_user;
end $$;
grant execute on function public.decline_join_request(uuid, uuid) to authenticated;

-- join requests SELECT policy: SUPERSEDED — do not recreate here.
-- The live, scoped policy is in supabase/trip-requests-rls-enforce.sql (#90 —
-- requester / trip host / co-host / accepted member, via can_see_trip_requests).
-- The old `using (true)` version (any authed user reads every join request) was
-- removed 2026-06-28 so re-running this file can't re-open the table.


-- ═══════════════════════════════════════════════════════════════════
-- [07] match-priorities.sql
-- ═══════════════════════════════════════════════════════════════════

-- Per-user match weighting + hard dealbreaker filters. Run in the Supabase SQL
-- editor. Safe to re-run.
--
-- Two upgrades the matching algo needs to actually differentiate people:
--   1. WEIGHTS  — each user picks the 2-3 things that matter most to them.
--      Those dimensions count ~2x in THEIR ranking, so a budget-obsessed
--      traveler and a budget-agnostic one no longer get the same score.
--   2. FILTERS  — the dealbreakers we already collect (same-gender, sober)
--      now hard-exclude incompatible candidates instead of being dead data.
-- Also rescales the personality cosine, which structurally lands ~0.7-0.95 for
-- everyone, so scores spread across a usable range.

-- ── 1. Priority columns (the "weight question" answers) ──────────────────────
alter table public.profiles
  add column if not exists match_priorities text[] default '{}',      -- trip dims
  add column if not exists activity_priorities text[] default '{}';   -- activity dims

-- ── 2. Hard dealbreaker filter ───────────────────────────────────────────────
-- True when a pair should be hidden from each other entirely. Only the
-- dealbreakers with a clear partner-facing meaning are enforced; self-
-- descriptors (dietary, private bathroom…) stay soft.
create or replace function public.buddy_hard_block(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b)
  select
    -- Same-gender requirement on either side. Only enforceable when both
    -- genders are known; "prefer not to say" (null) is never auto-excluded.
    ( ( 'I prefer same-gender travel partners' = any(coalesce(a.dealbreakers, '{}'))
        or 'I prefer same-gender travel partners' = any(coalesce(b.dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(a.activity_dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(b.activity_dealbreakers, '{}')) )
      and a.gender is not null and b.gender is not null
      and a.gender <> b.gender )
    or
    -- Sober-only vs. drinks-are-fine is a real conflict for activity meetups.
    ( ( 'Sober events only' = any(coalesce(a.activity_dealbreakers, '{}'))
          and 'Drinking is fine' = any(coalesce(b.activity_dealbreakers, '{}')) )
      or ( 'Sober events only' = any(coalesce(b.activity_dealbreakers, '{}'))
          and 'Drinking is fine' = any(coalesce(a.activity_dealbreakers, '{}')) ) )
  from a, b;
$$;
grant execute on function public.buddy_hard_block(uuid, uuid) to authenticated;

-- ── 3. Weighted pair score ───────────────────────────────────────────────────
-- Weights are taken from p_a (the viewer) — "what matters to ME when ranking
-- you." A prioritized dimension counts 2x; everything else counts 1x, then the
-- block is renormalized so the total still sums to 1.
-- SUPERSEDED: canonical buddy_pair_score is in supabase/vibe-traits.sql (adds
-- social_style / activity_motivation / initiator). Wrapped out 2026-06-28 so
-- re-running this file can't downgrade the live engine. (buddy_hard_block and
-- buddy_candidates_trip below remain active.)
/*
create or replace function public.buddy_pair_score(p_a uuid, p_b uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  ra public.profiles%rowtype;
  rb public.profiles%rowtype;
  prio text[];   -- viewer's trip priorities
  aprio text[];  -- viewer's activity priorities
  -- trip
  s numeric := 0; w numeric := 0; ww numeric; inter int; uni int; tagj numeric;
  slider numeric; tag_w numeric; trip_sim numeric; trip_w numeric := 0;
  -- personality
  dims text[] := array['culture','social','food','night','adventure','wellness'];
  d text; av float; bv float; dot float := 0; na float := 0; nb float := 0;
  cos numeric; pers_sim numeric; pers_w numeric := 0;
  -- activity
  a_inter int; a_uni int; parts numeric := 0; pw numeric := 0; pwi numeric;
  act_sim numeric; act_w numeric := 0;
  -- blend
  total numeric; wsum numeric;
begin
  select * into ra from public.profiles where id = p_a;
  select * into rb from public.profiles where id = p_b;
  prio  := coalesce(ra.match_priorities, '{}');
  aprio := coalesce(ra.activity_priorities, '{}');

  -- ----- Trip vibe: priority-weighted sliders (60%) + trip_vibe Jaccard (40%) -
  if ra.planning is not null and rb.planning is not null then
    ww := case when 'planning' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.planning - rb.planning)/4.0); w := w + ww; end if;
  if ra.pace is not null and rb.pace is not null then
    ww := case when 'pace' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.pace - rb.pace)/4.0); w := w + ww; end if;
  if ra.social_energy is not null and rb.social_energy is not null then
    ww := case when 'social_energy' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.social_energy - rb.social_energy)/4.0); w := w + ww; end if;
  if ra.budget is not null and rb.budget is not null then
    ww := case when 'budget' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.budget - rb.budget)/4.0); w := w + ww; end if;
  if ra.nightlife is not null and rb.nightlife is not null then
    ww := case when 'nightlife' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.nightlife - rb.nightlife)/4.0); w := w + ww; end if;
  if ra.adventurousness is not null and rb.adventurousness is not null then
    ww := case when 'adventurousness' = any(prio) then 2 else 1 end;
    s := s + ww * (1 - abs(ra.adventurousness - rb.adventurousness)/4.0); w := w + ww; end if;

  select count(*) into inter from unnest(coalesce(ra.trip_vibe,'{}')) t where t = any(coalesce(rb.trip_vibe,'{}'));
  select cardinality(array(select distinct unnest(coalesce(ra.trip_vibe,'{}') || coalesce(rb.trip_vibe,'{}')))) into uni;

  if w > 0 then
    slider := s / w;
    tagj := case when uni > 0 then inter::numeric / uni else 0.5 end;
    -- "Shared interests" as a priority pulls the tag overlap up to a 50/50 split.
    tag_w := case when 'interests' = any(prio) then 0.5 else 0.4 end;
    trip_sim := (1 - tag_w) * slider + tag_w * tagj;
    trip_w := 0.35;
  elsif uni > 0 then
    trip_sim := inter::numeric / uni;
    trip_w := 0.35;
  end if;

  -- ----- Personality: 6-dim cosine, rescaled so the typical band spreads -----
  if ra.vibe_scores is not null and rb.vibe_scores is not null then
    foreach d in array dims loop
      av := coalesce((ra.vibe_scores ->> d)::float, 0);
      bv := coalesce((rb.vibe_scores ->> d)::float, 0);
      dot := dot + av * bv; na := na + av * av; nb := nb + bv * bv;
    end loop;
    if na > 0 and nb > 0 then
      cos := dot / (sqrt(na) * sqrt(nb));
      -- 0.55 -> 0, 1.0 -> 1; clamps the all-positive cosine into a real range.
      pers_sim := greatest(0, least(1, (cos - 0.55) / 0.45));
      pers_w := 0.40;
    end if;
  end if;

  -- ----- Activity: priority-weighted over its sub-signals --------------------
  if coalesce(array_length(ra.activities,1),0) > 0 and coalesce(array_length(rb.activities,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activities) t where t = any(rb.activities);
    select cardinality(array(select distinct unnest(ra.activities || rb.activities))) into a_uni;
    pwi := case when 'interests' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if coalesce(array_length(ra.activity_vibe,1),0) > 0 and coalesce(array_length(rb.activity_vibe,1),0) > 0 then
    select count(*) into a_inter from unnest(ra.activity_vibe) t where t = any(rb.activity_vibe);
    select cardinality(array(select distinct unnest(ra.activity_vibe || rb.activity_vibe))) into a_uni;
    pwi := case when 'vibe' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (case when a_uni > 0 then a_inter::numeric / a_uni else 0 end); pw := pw + pwi;
  end if;
  if ra.activity_social is not null and rb.activity_social is not null then
    pwi := case when 'social' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_social - rb.activity_social)/4.0); pw := pw + pwi;
  end if;
  if ra.activity_intensity is not null and rb.activity_intensity is not null then
    pwi := case when 'intensity' = any(aprio) then 2 else 1 end;
    parts := parts + pwi * (1 - abs(ra.activity_intensity - rb.activity_intensity)/4.0); pw := pw + pwi;
  end if;
  if pw > 0 then
    act_sim := parts / pw;
    act_w := 0.25;
  end if;

  -- ----- Weighted blend over the components both people have ------------------
  wsum := pers_w + trip_w + act_w;
  if wsum = 0 then return 50; end if; -- no shared data — neutral
  total := coalesce(pers_sim * pers_w, 0) + coalesce(trip_sim * trip_w, 0) + coalesce(act_sim * act_w, 0);
  return round(100 * (total / wsum));
end $$;
grant execute on function public.buddy_pair_score(uuid, uuid) to authenticated;
*/

-- ── 4. Trip candidate deck: priority-weighted per-dimension score + filter ───
drop function if exists public.buddy_candidates_trip(int);
drop function if exists public.buddy_candidates_trip(int, text);
drop function if exists public.buddy_candidates_trip(int, text, uuid);
create or replace function public.buddy_candidates_trip(
  p_limit int default 30, p_kind text default 'trip', p_trip uuid default null
)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (
    select * from public.trips
    where user_id = auth.uid() and status = 'active'
      and (id = p_trip or (p_trip is null and kind = p_kind))
    order by created_at desc limit 1
  ),
  me_p as (select * from public.profiles where id = auth.uid())
  select cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
         ct.title, ct.destinations, ct.start_date, ct.end_date, ct.trip_type,
    -- Priority-weighted average of the per-dimension similarities. Each weight
    -- is 2 when the viewer flagged that dimension as a priority, else 1. Inline
    -- arithmetic (not a VALUES list) so the me_t/ct/cp correlation is plain and
    -- portable. Denominator is the sum of the 7 weights, always >= 7.
    ( 100 * (
        score_w.w_interests * sim.s_interests
      + score_w.w_pace      * sim.s_pace
      + score_w.w_budget    * sim.s_budget
      + score_w.w_planning  * sim.s_planning
      + score_w.w_social    * sim.s_social
      + score_w.w_night     * sim.s_night
      + score_w.w_adv       * sim.s_adv
      ) / (
        score_w.w_interests + score_w.w_pace + score_w.w_budget + score_w.w_planning
      + score_w.w_social + score_w.w_night + score_w.w_adv
      ) )::float8 as score
  from public.trips ct
  join public.profiles cp on cp.id = ct.user_id
  cross join me_t cross join me_p
  -- per-dimension similarities (0..1)
  cross join lateral (
    select
      ( case when cardinality(coalesce(me_t.trip_type,'{}'))=0 and cardinality(coalesce(ct.trip_type,'{}'))=0 then 0.5
             else (select count(*)::float from unnest(coalesce(ct.trip_type,'{}')) x where x = any(coalesce(me_t.trip_type,'{}')))
                  / greatest(cardinality(coalesce(me_t.trip_type,'{}')) + cardinality(coalesce(ct.trip_type,'{}'))
                    - (select count(*)::float from unnest(coalesce(ct.trip_type,'{}')) x where x = any(coalesce(me_t.trip_type,'{}'))), 1) end ) as s_interests,
      ( 1 - abs(coalesce(ct.pace, cp.pace, 3) - coalesce(me_t.pace, me_p.pace, 3))::float / 4 ) as s_pace,
      ( 1 - abs(coalesce(ct.budget, cp.budget, 3) - coalesce(me_t.budget, me_p.budget, 3))::float / 4 ) as s_budget,
      ( case when cp.planning is null or me_p.planning is null then 0.5 else 1 - abs(cp.planning - me_p.planning)::float / 4 end ) as s_planning,
      ( case when cp.social_energy is null or me_p.social_energy is null then 0.5 else 1 - abs(cp.social_energy - me_p.social_energy)::float / 4 end ) as s_social,
      ( case when cp.nightlife is null or me_p.nightlife is null then 0.5 else 1 - abs(cp.nightlife - me_p.nightlife)::float / 4 end ) as s_night,
      ( case when cp.adventurousness is null or me_p.adventurousness is null then 0.5 else 1 - abs(cp.adventurousness - me_p.adventurousness)::float / 4 end ) as s_adv
  ) sim
  -- viewer's priority weights (2 = flagged as "matters most", else 1)
  cross join lateral (
    select
      case when 'interests'     = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_interests,
      case when 'pace'          = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_pace,
      case when 'budget'        = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_budget,
      case when 'planning'      = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_planning,
      case when 'social_energy' = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_social,
      case when 'nightlife'     = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_night,
      case when 'adventurousness' = any(coalesce(me_p.match_priorities,'{}')) then 2 else 1 end as w_adv
  ) score_w
  where ct.user_id <> auth.uid()
    and ct.status = 'active'
    and ct.kind = me_t.kind
    and coalesce(ct.visibility, 'private') <> 'public'  -- exclude Flocks from 1:1
    and exists (select 1 from unnest(coalesce(ct.destinations,'{}')) a
                join unnest(coalesce(me_t.destinations,'{}')) b on lower(a)=lower(b))
    and (greatest(ct.start_date, me_t.start_date) - least(ct.end_date, me_t.end_date)) <= 30
    and cp.onboarding_complete
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=auth.uid() and s.target_id=cp.id)
    -- reciprocity: don't resurface people who already swiped no on the viewer
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id=cp.id and s.target_id=auth.uid() and not s.liked)
  order by score desc nulls last, cp.id
  limit p_limit;
$$;
grant execute on function public.buddy_candidates_trip(int, text, uuid) to authenticated;

-- ── 5. Activity discovery deck: add the same hard filter ─────────────────────
-- SUPERSEDED: canonical activity_candidates is in
-- supabase/activity-candidate-decisions.sql (adds the per-activity decision +
-- swipe exclusions). Wrapped out 2026-06-28 to prevent re-run downgrade.
/*
drop function if exists public.activity_candidates(uuid, int);
create or replace function public.activity_candidates(p_trip uuid, p_limit int default 30)
returns table (
  id uuid, display_name text, age int, photos text[], video_url text, one_liner text,
  title text, destinations text[], start_date date, end_date date, trip_type text[], score float8
)
language sql security definer set search_path = public stable as $$
  with me_t as (select * from public.trips where id = p_trip and user_id = auth.uid()),
       me_p as (select * from public.profiles where id = auth.uid())
  select
    cp.id, cp.display_name, cp.age, cp.photos, cp.video_url, cp.one_liner,
    null::text as title,
    array[cp.home_city]::text[] as destinations,
    null::date as start_date,
    null::date as end_date,
    null::text[] as trip_type,
    ( 100 * (
        0.5 * (public.buddy_pair_score(auth.uid(), cp.id) / 100.0)
        + 0.5 * (
          case
            when coalesce(array_length(cp.activity_vibe, 1), 0) = 0
              or coalesce(array_length(me_p.activity_vibe, 1), 0) = 0
            then 0.5
            else cardinality(array(select unnest(cp.activity_vibe) intersect select unnest(me_p.activity_vibe)))::numeric
                 / nullif(cardinality(array(select unnest(cp.activity_vibe) union select unnest(me_p.activity_vibe))), 0)
          end
        )
      ) )::float8 as score
  from public.profiles cp
  cross join me_t
  cross join me_p
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    and coalesce(array_length(cp.activities, 1), 0) > 0
    and lower(coalesce(cp.home_city, '')) = lower(coalesce(me_t.destination, ''))
    and not public.buddy_hard_block(auth.uid(), cp.id)  -- hard dealbreaker filter
    and not exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.activity_id = p_trip
        and d.candidate_id = cp.id
    )
    and not exists (select 1 from public.buddy_swipes s where s.swiper_id = auth.uid() and s.target_id = cp.id)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.activity_candidates(uuid, int) to authenticated;
*/

-- ── 6. Recompute persisted pair scores with the new formula ──────────────────
update public.buddy_matches m
set score = public.buddy_pair_score(m.user_a, m.user_b);


-- ═══════════════════════════════════════════════════════════════════
-- [08] activity-candidate-decisions.sql
-- ═══════════════════════════════════════════════════════════════════

-- Activity-specific candidate decisions.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- A pass belongs to one activity, so the same person may still be relevant for
-- a different activity later. A like still uses buddy_swipe so mutual likes
-- continue to create the existing buddy match and chat.

create table if not exists public.activity_candidate_decisions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.trips(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id, candidate_id),
  check (user_id <> candidate_id)
);

create index if not exists activity_candidate_decisions_user_candidate_idx
  on public.activity_candidate_decisions (user_id, candidate_id);

alter table public.activity_candidate_decisions enable row level security;
drop policy if exists "manage own activity candidate decisions"
  on public.activity_candidate_decisions;
create policy "manage own activity candidate decisions"
  on public.activity_candidate_decisions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.trips t
      where t.id = activity_id
        and t.user_id = auth.uid()
        and t.kind = 'activity'
    )
  );

drop function if exists public.activity_candidate_decide(uuid, uuid, boolean);
create or replace function public.activity_candidate_decide(
  p_activity uuid,
  p_target uuid,
  p_liked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_result jsonb;
begin
  if p_target = auth.uid() then
    raise exception 'You cannot choose yourself.';
  end if;

  select t.title
  into v_title
  from public.trips t
  where t.id = p_activity
    and t.user_id = auth.uid()
    and t.kind = 'activity'
    and t.status = 'active';

  if not found then
    raise exception 'Activity not found or no longer active.';
  end if;

  insert into public.activity_candidate_decisions (
    user_id,
    activity_id,
    candidate_id,
    liked,
    updated_at
  )
  values (auth.uid(), p_activity, p_target, p_liked, now())
  on conflict (user_id, activity_id, candidate_id)
  do update set
    liked = excluded.liked,
    updated_at = now();

  if p_liked then
    select public.buddy_swipe(
      p_target,
      true,
      coalesce(nullif(trim(v_title), ''), 'an activity')
    )
    into v_result;
    return v_result;
  end if;

  return jsonb_build_object('matched', false);
end;
$$;
grant execute on function public.activity_candidate_decide(uuid, uuid, boolean)
  to authenticated;

drop function if exists public.activity_candidates(uuid, int);
create or replace function public.activity_candidates(
  p_trip uuid,
  p_limit int default 30
)
returns table (
  id uuid,
  display_name text,
  age int,
  photos text[],
  video_url text,
  one_liner text,
  title text,
  destinations text[],
  start_date date,
  end_date date,
  trip_type text[],
  score float8
)
language sql
security definer
set search_path = public
stable
as $$
  with me_t as (
    select *
    from public.trips
    where id = p_trip
      and user_id = auth.uid()
      and kind = 'activity'
      and status = 'active'
  ),
  me_p as (
    select *
    from public.profiles
    where id = auth.uid()
  )
  select
    cp.id,
    cp.display_name,
    cp.age,
    cp.photos,
    cp.video_url,
    cp.one_liner,
    null::text as title,
    array[cp.home_city]::text[] as destinations,
    null::date as start_date,
    null::date as end_date,
    null::text[] as trip_type,
    (
      100 * (
        0.5 * (public.buddy_pair_score(auth.uid(), cp.id) / 100.0)
        + 0.5 * (
          case
            when coalesce(array_length(cp.activity_vibe, 1), 0) = 0
              or coalesce(array_length(me_p.activity_vibe, 1), 0) = 0
            then 0.5
            else cardinality(array(
              select unnest(cp.activity_vibe)
              intersect
              select unnest(me_p.activity_vibe)
            ))::numeric
            / nullif(cardinality(array(
              select unnest(cp.activity_vibe)
              union
              select unnest(me_p.activity_vibe)
            )), 0)
          end
        )
      )
    )::float8 as score
  from public.profiles cp
  cross join me_t
  cross join me_p
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    -- Discovery pool = people in YOUR city who are open to discovery, ranked by
    -- vibe similarity. We match on the swiper's own home_city (me_p) — NOT the
    -- activity's destination — and we do NOT require the candidate to have posted
    -- their own activity. You swipe in-city people and invite them to your activity.
    and coalesce(me_p.home_city, '') <> ''
    and lower(coalesce(cp.home_city, '')) = lower(me_p.home_city)
    and not public.buddy_hard_block(auth.uid(), cp.id)
    and not exists (
      select 1
      from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.activity_id = p_trip
        and d.candidate_id = cp.id
    )
    and not exists (
      select 1
      from public.buddy_swipes s
      where s.swiper_id = auth.uid()
        and s.target_id = cp.id
    )
    -- reciprocity: don't resurface people who already swiped no on the viewer
    and not exists (
      select 1
      from public.buddy_swipes s
      where s.swiper_id = cp.id
        and s.target_id = auth.uid()
        and not s.liked
    )
  order by score desc nulls last, cp.id
  limit p_limit;
$$;
grant execute on function public.activity_candidates(uuid, int)
  to authenticated;

-- SUPERSEDED 2026-06-29: the canonical city_people lives in home-carousels.sql.
-- This was a behaviorally-identical duplicate (whitespace-only diff). Wrapped so
-- re-running this file can't install a second live copy. Do not un-wrap.
/*
create or replace function public.city_people(p_limit int default 12)
returns table (
  id uuid,
  display_name text,
  age int,
  photos text[],
  one_liner text,
  home_city text,
  score float8
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select *
    from public.profiles
    where id = auth.uid()
  )
  select
    cp.id,
    cp.display_name,
    cp.age,
    cp.photos,
    cp.one_liner,
    cp.home_city,
    public.buddy_pair_score(auth.uid(), cp.id)::float8 as score
  from public.profiles cp
  cross join me
  where cp.id <> auth.uid()
    and cp.open_to_discovery
    and cp.onboarding_complete
    and coalesce(me.home_city, '') <> ''
    and lower(coalesce(cp.home_city, '')) = lower(me.home_city)
    and not exists (
      select 1
      from public.buddy_swipes s
      where s.swiper_id = auth.uid()
        and s.target_id = cp.id
    )
    and not exists (
      select 1
      from public.activity_candidate_decisions d
      where d.user_id = auth.uid()
        and d.candidate_id = cp.id
    )
  order by score desc nulls last
  limit p_limit;
$$;
grant execute on function public.city_people(int) to authenticated;
*/


-- ═══════════════════════════════════════════════════════════════════
-- [09] buddy-swipe-notify-once.sql
-- ═══════════════════════════════════════════════════════════════════

-- P0 fix: stop buddy_swipe from re-notifying on repeat calls.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Before: every buddy_swipe(target, true, …) on an already-matched pair re-fired
-- "It's a match!" to both users, and every repeat like re-fired the activity-like
-- notification — a spam vector (a client could loop the RPC to flood someone).
-- After: the match notification fires only when the chat row is newly created,
-- and the activity-like notification fires only on a fresh like (new swipe row).
-- Behavior, matching, and the returned shape are otherwise unchanged.
--
-- Also enforces buddy_hard_block server-side: decks pre-filter hard-blocked
-- pairs, but direct RPC callers ("Say hi", match-back) could bypass it. A
-- blocked pair now gets a stable, client-distinguishable error
-- ('blocked_by_preferences') instead of silently recording the swipe.

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
  if public.buddy_hard_block(auth.uid(), p_target) then
    raise exception 'blocked_by_preferences';
  end if;

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


-- ═══════════════════════════════════════════════════════════════════
-- [10] home-carousels.sql
-- ═══════════════════════════════════════════════════════════════════

-- Home page carousels: "People in your city" + "Flocks you can join".
-- Run in the Supabase SQL editor. Safe to re-run.

-- People in the viewer's home city who are open to discovery. Mirrors
-- activity_candidates but keys off the viewer's own home_city instead of a
-- posted activity's destination, so it works with no posted activity.
--
-- Ranking: `score` stays a pure match % (the home UI renders it directly).
-- The ORDER BY additionally applies:
--   * a recency boost from auth.users.last_sign_in_at (~10-day decay, max +12
--     on the 0-100 scale) so dormant accounts stop outranking active ones
--     without recency dominating compatibility;
--   * a small deterministic jitter (+/- ~2.5), stable per viewer per ISO week,
--     so everyone in a city doesn't see the identical order and it rotates.
-- Hygiene: bilateral hard dealbreakers (buddy_hard_block) and people who
-- already swiped no on the viewer are excluded entirely.
-- Thinness valve: when the fresh pool (never swiped/decided) has fewer than 6
-- people, top the carousel back up to 6 with people the viewer previously
-- PASSED on in activity decisions (liked = false), ordered after the fresh
-- pool — never with hard-blocked people or anyone the viewer buddy-swiped.
create or replace function public.city_people(p_limit int default 12)
returns table (
  id uuid, display_name text, age int, photos text[], one_liner text,
  home_city text, score float8
)
language sql security definer set search_path = public stable as $$
  with me as (select * from public.profiles where id = auth.uid()),
  -- materialized so buddy_pair_score runs once per candidate even though the
  -- score feeds both the returned column and the rank expression below
  base as materialized (
    select cp.id, cp.display_name, cp.age, cp.photos, cp.one_liner, cp.home_city,
           public.buddy_pair_score(auth.uid(), cp.id)::float8 as score,
           u.last_sign_in_at
    from public.profiles cp
    cross join me
    left join auth.users u on u.id = cp.id
    where cp.id <> auth.uid()
      and cp.open_to_discovery
      and cp.onboarding_complete
      and coalesce(me.home_city, '') <> ''
      and lower(coalesce(cp.home_city, '')) = lower(me.home_city)
      and not public.buddy_hard_block(auth.uid(), cp.id)
      and not exists (  -- they already swiped no on the viewer
        select 1 from public.buddy_swipes s
        where s.swiper_id = cp.id and s.target_id = auth.uid() and not s.liked
      )
      and not exists (  -- the viewer already buddy-swiped them
        select 1 from public.buddy_swipes s
        where s.swiper_id = auth.uid() and s.target_id = cp.id
      )
  ),
  pool as (
    select b.id, b.display_name, b.age, b.photos, b.one_liner, b.home_city, b.score,
           ( coalesce(b.score, 0)
             + case when b.last_sign_in_at is null then 0
                    else 12.0 * exp(-greatest(extract(epoch from (now() - b.last_sign_in_at)), 0)::float8 / 864000.0)
               end
             + (hashtext(auth.uid()::text || b.id::text || to_char(now(), 'IYYY-IW')) % 250)::float8 / 100.0
           ) as rank_score
    from base b
  ),
  fresh as (
    select p.* from pool p
    where not exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid() and d.candidate_id = p.id
    )
  ),
  backfill as (
    select p.* from pool p
    where exists (
      select 1 from public.activity_candidate_decisions d
      where d.user_id = auth.uid() and d.candidate_id = p.id and not d.liked
    )
    order by p.rank_score desc nulls last, p.id
    limit greatest(6 - (select count(*) from fresh), 0)
  )
  select c.id, c.display_name, c.age, c.photos, c.one_liner, c.home_city, c.score
  from (
    select f.*, 0 as pri from fresh f
    union all
    select b.*, 1 as pri from backfill b
  ) c
  order by c.pri, c.rank_score desc nulls last, c.id
  limit p_limit;
$$;
grant execute on function public.city_people(int) to authenticated;

-- Open, not-full public group trips (Flocks) you can request to join, with the
-- host, current going-count, and whether you've already requested.
create or replace function public.home_flocks(p_limit int default 10)
returns table (
  id uuid, destination text, destinations text[], start_date date, end_date date,
  group_size int, cover_photo text, going int, requested boolean,
  host_name text, host_photo text
)
language sql security definer set search_path = public stable as $$
  select t.id, t.destination, t.destinations, t.start_date, t.end_date,
         t.group_size, t.cover_photo,
         (1 + coalesce(a.accepted, 0))::int as going,
         exists(
           select 1 from public.trip_join_requests r
           where r.trip_id = t.id and r.user_id = auth.uid()
             and r.status in ('pending', 'accepted') -- declined = not requested anymore
         ) as requested,
         hp.display_name as host_name,
         (hp.photos)[1] as host_photo
  from public.trips t
  join public.profiles hp on hp.id = t.user_id
  left join lateral (
    select count(*)::int as accepted
    from public.trip_join_requests r
    where r.trip_id = t.id and r.status = 'accepted'
  ) a on true
  where t.visibility = 'public'
    and t.kind = 'trip'
    and t.status = 'active'
    and t.user_id <> auth.uid()
    and t.end_date >= current_date
    and (1 + coalesce(a.accepted, 0)) < t.group_size
  order by t.created_at desc
  limit p_limit;
$$;
grant execute on function public.home_flocks(int) to authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- [11] performance-indexes.sql
-- ═══════════════════════════════════════════════════════════════════

-- Phase 1 latency cleanup indexes. Safe to re-run.
-- These support the high-traffic Home/Vibes feed queries without changing app logic.

create index if not exists vibes_status_starts_idx
  on public.vibes (status, starts_at);

create index if not exists vibes_host_status_starts_idx
  on public.vibes (host_id, status, starts_at);

create index if not exists vibes_lower_city_starts_idx
  on public.vibes (lower(city), starts_at);

create index if not exists vibe_interests_user_status_vibe_idx
  on public.vibe_interests (user_id, status, vibe_id);

create index if not exists vibe_interests_vibe_status_user_idx
  on public.vibe_interests (vibe_id, status, user_id);

create index if not exists vibe_feedback_user_signal_vibe_idx
  on public.vibe_feedback (user_id, signal, vibe_id);

-- city_people / activity_candidates look up same-city discoverable people with
-- lower(home_city) = lower(...). The trgm index only covers vibes.city ILIKE,
-- so this btree expression index (partial on the discovery flag) serves the
-- equality path.
create index if not exists profiles_home_city_lower_idx
  on public.profiles (lower(home_city)) where open_to_discovery;


-- ═══════════════════════════════════════════════════════════════════
-- [12] vibe-v2-private-link.sql
-- ═══════════════════════════════════════════════════════════════════

-- Vibe Matching v2: host private-link direct invites (manual accept).
-- Run AFTER vibe-v2-algo-share.sql and vibe-eligibility-enforce.sql
-- (_rank_vibe_core now filters through vibe_eligible). Safe to re-run.
--
-- Capacity is split: the algo fills its share; the host fills the rest via a
-- private link (joiners still do the activity vibe-check, but skip ranking — the
-- host accepts them manually). A `source` tag keeps the two tracks from colliding.

alter table public.vibe_interests
  add column if not exists source text not null default 'algo' check (source in ('algo', 'private'));

-- Algo's currently-available spots: its share (or, after the 12h roll-back,
-- whatever the host didn't fill privately), minus what the algo already holds.
create or replace function public._vibe_algo_remaining(p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare v public.vibes; v_algo_base int; v_private_held int; v_algo_held int; v_cap_for_algo int;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return 0; end if;
  v_algo_base := greatest(1, ceil(v.capacity * coalesce(v.algo_share, 100) / 100.0)::int);

  select count(*) into v_private_held from public.vibe_interests
    where vibe_id = p_vibe and source = 'private'
      and (status = 'confirmed'
           or (status = 'invited' and (invitation_expires_at is null or invitation_expires_at > now())));

  select count(*) into v_algo_held from public.vibe_interests
    where vibe_id = p_vibe and coalesce(source, 'algo') <> 'private'
      and ( status in ('shortlisted', 'confirmed')
            or (status = 'invited' and (invitation_expires_at is null or invitation_expires_at > now())) );

  if now() >= v.starts_at - interval '12 hours' then
    v_cap_for_algo := v.capacity - v_private_held;   -- roll-back: algo takes the host's unfilled spots
  else
    v_cap_for_algo := v_algo_base;
  end if;
  return greatest(v_cap_for_algo - v_algo_held, 0);
end $$;
grant execute on function public._vibe_algo_remaining(uuid) to authenticated;

-- ── Re-wire the three algo fillers to the new remaining-spots helper ────────
create or replace function public._rank_vibe_core(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_shortlisted int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return jsonb_build_object('shortlisted',0,'standby',0); end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);

  for c in
    select vi.user_id,
      ( 0.35 * (case when v.required_skill_level is null then 0.7 else coalesce((
            select 1 - abs(((case when (p.activity_skills ->> k) ~ '^[0-9]+$' then (p.activity_skills ->> k)::int end)) - v.required_skill_level)::float / 4
            from jsonb_object_keys(coalesce(p.activity_skills,'{}'::jsonb)) k
            where lower(k) like '%'||lower(v.category)||'%' limit 1), 0.3) end)
      + 0.30 * (case when array_length(v.event_vibe_tags,1) is null then 0.5 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      -- Guard EVERY slider (not just planning): one NULL on either side used to
      -- turn the whole score NULL, and NULLs sorted FIRST — rank 1 shortlists.
      + 0.20 * (case when p.planning is null or h.planning is null
                       or p.pace is null or h.pace is null
                       or p.social_energy is null or h.social_energy is null
                       or p.budget is null or h.budget is null
                       or p.nightlife is null or h.nightlife is null
                       or p.adventurousness is null or h.adventurousness is null then 0.5 else 1 - (
            (abs(p.planning-h.planning)+abs(p.pace-h.pace)+abs(p.social_energy-h.social_energy)
            +abs(p.budget-h.budget)+abs(p.nightlife-h.nightlife)+abs(p.adventurousness-h.adventurousness))::float/24) end)
      + 0.10 * public.vibe_review_fit(vi.user_id, p_vibe)
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested' and coalesce(vi.source,'algo') <> 'private'
      and public.vibe_eligible(vi.user_id, p_vibe)  -- host's gender/age prefs
    order by score desc nulls last, vi.user_id      -- deterministic; NULLs never win
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining then
      update public.vibe_interests set status='shortlisted', match_score=c.score where vibe_id=p_vibe and user_id=c.user_id;
      v_shortlisted := v_shortlisted + 1;
    else
      update public.vibe_interests set status='standby', match_score=c.score where vibe_id=p_vibe and user_id=c.user_id;
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status='reviewing', shortlisted_at=now(), preview_rejects_used=0 where id=p_vibe and status <> 'cancelled';
  perform public.notify(v.host_id, 'vibe_review_ready', 'Your matched list for '||v.title||' is ready',
          'Review it — remove up to a few before invites go out, or send them now.', jsonb_build_object('vibe_id', p_vibe));
  return jsonb_build_object('shortlisted', v_shortlisted, 'standby', v_standby);
end $$;
grant execute on function public._rank_vibe_core(uuid) to authenticated;

create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select user_id from public.vibe_interests where vibe_id=p_vibe and status='standby' and coalesce(source,'algo') <> 'private'
    order by match_score desc nulls last limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at) where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;

-- SUPERSEDED: canonical invite_city_fallback is in supabase/vibe-auto-matching.sql
-- (live; has the #77 starts_at>now guard). Wrapped out 2026-06-28 — repo-only.
-- (The _rank_vibe_core + backfill_vibe above remain the canonical/live versions.)
/*
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  v_remaining := public._vibe_algo_remaining(p_vibe);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select p.id,
      ( 0.4
        + 0.3 * (case when array_length(v.event_vibe_tags,1) is null then 0.0 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
        + 0.3 * public.vibe_review_fit(p.id, p_vibe)
      ) * 100 as score
    from public.profiles p
    where p.id <> v.host_id and coalesce(p.notifications_enabled, true)
      and array_length(coalesce(p.activities,'{}'), 1) is not null
      and p.home_city is not null and lower(p.home_city) = lower(v.city)
      and not exists (select 1 from public.vibe_interests vi where vi.vibe_id=p_vibe and vi.user_id=p.id)
      and not exists (select 1 from public.vibe_feedback vf where vf.vibe_id=p_vibe and vf.user_id=p.id and vf.signal='not_for_me')
      and (v.gender_pref is null or v.gender_pref = 'any'
           or (v.gender_pref='women' and p.gender='woman') or (v.gender_pref='men' and p.gender='man'))
      and (v.age_min is null or p.age is null or p.age >= v.age_min)
      and (v.age_max is null or p.age is null or p.age <= v.age_max)
    order by score desc limit v_remaining
  loop
    insert into public.vibe_interests (vibe_id, user_id, status, source, match_score, invitation_sent_at, invitation_expires_at)
      values (p_vibe, c.id, 'invited', 'algo', c.score, now(), public._vibe_confirm_deadline(v.starts_at))
      on conflict (vibe_id, user_id) do nothing;
    perform public.notify(c.id, 'vibe_invitation', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'There''s a spot for you — confirm to join.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.invite_city_fallback(uuid) to authenticated;
*/

-- ── Private requests: join via the host's link → pending host accept ────────
create or replace function public.request_private_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_exists text;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id = auth.uid() then raise exception 'you host this vibe'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  select status into v_exists from public.vibe_interests where vibe_id=p_vibe and user_id=auth.uid();
  if v_exists is not null then return; end if;   -- already in the funnel
  insert into public.vibe_interests (vibe_id, user_id, status, source)
    values (p_vibe, auth.uid(), 'requested', 'private');
  perform public.notify(v.host_id, 'vibe_private_request', 'Someone used your invite link for '||v.title,
          'Review and add them to your spots.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.request_private_vibe(uuid) to authenticated;

create or replace function public.host_accept_private(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_algo_base int; v_host_spots int; v_private_held int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can accept'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null or v_status <> 'requested' then raise exception 'no pending request from this person'; end if;

  -- Gate on overall capacity (confirmed + live invites), not the host-share
  -- sub-cap — accepting a request is an explicit host decision, so it should
  -- succeed whenever the room genuinely has an open seat.
  select count(*) into v_private_held from public.vibe_interests
    where vibe_id=p_vibe
      and (status='confirmed' or (status='invited' and (invitation_expires_at is null or invitation_expires_at>now())));
  if v_private_held >= v.capacity then raise exception 'this vibe is full'; end if;

  update public.vibe_interests set status='invited', source='private',
    invitation_sent_at=now(), invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
    where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_invitation', 'You''re invited to '||v.title,
          'The host added you directly — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.host_accept_private(uuid, uuid) to authenticated;

create or replace function public.host_reject_private(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can decline'; end if;
  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null or v_status <> 'requested' then raise exception 'no pending request'; end if;
  update public.vibe_interests set status='declined' where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_declined', v.title||' — not this time',
          'The host went a different way for their direct spots.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.host_reject_private(uuid, uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- [13] vibe-auto-matching.sql
-- ═══════════════════════════════════════════════════════════════════

-- Stage 2 + 3: automatic, proximity-aware Vibe matching + same-city fallback.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- What this adds:
--  * Matching runs AUTOMATICALLY at the right time (no host click needed):
--      run_at = least( deadline (or start-24h if none), start-2h )
--    so far-out events rank ~24h before, today's events rank ~2h before.
--  * Confirm window is now PROXIMITY-AWARE: 24h, but never past (start-30min),
--    so invites for a same-day Vibe don't expire after the event.
--  * If natural interest can't fill the room, invite matched SAME-CITY users.

-- ── Dynamic confirm deadline: 24h, capped to just before the event ──────────
create or replace function public._vibe_confirm_deadline(p_starts timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select least(
    now() + interval '24 hours',
    greatest(now() + interval '30 minutes', p_starts - interval '30 minutes')
  );
$$;

-- ── When the algo should run for a Vibe (stable; no dependence on now()) ────
create or replace function public._vibe_run_at(p_starts timestamptz, p_deadline timestamptz)
returns timestamptz language sql immutable set search_path = public as $$
  select least(
    coalesce(p_deadline, p_starts - interval '24 hours'),
    p_starts - interval '2 hours'
  );
$$;

-- SUPERSEDED: canonical backfill_vibe is in supabase/vibe-v2-private-link.sql
-- (live; uses _vibe_algo_remaining). Wrapped out 2026-06-28 — repo-only.
/*
-- ── Backfill open spots from standby (uses the dynamic confirm window) ───────
create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_active int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);
  if v_remaining <= 0 then return 0; end if;
  for c in
    select user_id from public.vibe_interests where vibe_id=p_vibe and status='standby'
    order by match_score desc nulls last limit v_remaining
  loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
      where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm to lock your spot.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;
*/

-- ── Same-city fallback: when interest can't fill the room, put matched
--    same-city flockies on the SHORTLIST (like every algo candidate). Only
--    fires when the algo's share is short, never re-adds anyone, and enforces
--    the host's eligibility prefs (gender + age) via vibe_eligible.
--    Run AFTER vibe-eligibility-enforce.sql + vibe-v2-private-link.sql. ────────
create or replace function public.invite_city_fallback(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_pool int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;  -- never invite into a started/finished Vibe

  -- Same remaining-spots helper as _rank_vibe_core: shortlisted/invited/confirmed
  -- holds and the host's private share are all accounted for inside
  -- _vibe_algo_remaining. Then subtract everyone still WAITING in the funnel
  -- (interested/requested/standby — they'll be ranked / host-reviewed), so cold
  -- candidates never displace genuinely-interested people when this runs early.
  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','requested','standby');
  v_remaining := public._vibe_algo_remaining(p_vibe) - v_pool;
  if v_remaining <= 0 then return 0; end if;  -- enough in the funnel already

  for c in
    select p.id,
      ( 0.5
        + 0.5 * (case when array_length(v.event_vibe_tags,1) is null then 0.0 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      ) * 100 as score
    from public.profiles p
    where p.id <> v.host_id
      and coalesce(p.notifications_enabled, true)
      and array_length(coalesce(p.activities,'{}'), 1) is not null       -- did the activity vibe-check
      and p.home_city is not null and lower(p.home_city) = lower(v.city)  -- same city
      and not exists (select 1 from public.vibe_interests vi where vi.vibe_id=p_vibe and vi.user_id=p.id)
      and not exists (select 1 from public.vibe_feedback vf where vf.vibe_id=p_vibe and vf.user_id=p.id and vf.signal='not_for_me')
      and public.vibe_eligible(p.id, p_vibe)  -- host's gender + age prefs (age filter restored)
    order by score desc nulls last, p.id
    limit v_remaining
  loop
    -- Cold candidates join as 'shortlisted' (NOT a direct invite): they go
    -- through the host's pre-invite review + commit_vibe_matching exactly like
    -- the candidates _rank_vibe_core shortlists.
    insert into public.vibe_interests (vibe_id, user_id, status, source, match_score)
      values (p_vibe, c.id, 'shortlisted', 'algo', c.score)
      on conflict (vibe_id, user_id) do nothing;
    perform public.notify(c.id, 'vibe_shortlisted', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'You''re in the running — we''ll notify you if a spot is yours.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.invite_city_fallback(uuid) to authenticated;

-- SUPERSEDED: canonical _rank_vibe_core is in supabase/vibe-v2-private-link.sql
-- (live shortlist→host-review flow). This older copy auto-invited. Wrapped out
-- 2026-06-28 — repo-only. (The rank_vibe wrapper below stays active.)
/*
-- ── Core ranking (NO auth gate — callable by host RPC and by the scheduler) ─
create or replace function public._rank_vibe_core(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_active int; v_remaining int; v_invited int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return jsonb_build_object('invited',0,'standby',0); end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);

  for c in
    select vi.user_id,
      ( 0.35 * (case when v.required_skill_level is null then 0.7 else coalesce((
            select 1 - abs(((p.activity_skills ->> k)::int) - v.required_skill_level)::float / 4
            from jsonb_object_keys(coalesce(p.activity_skills,'{}'::jsonb)) k
            where lower(k) like '%'||lower(v.category)||'%' limit 1), 0.3) end)
      + 0.30 * (case when array_length(v.event_vibe_tags,1) is null then 0.5 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      + 0.20 * (case when p.planning is null or h.planning is null then 0.5 else 1 - (
            (abs(p.planning-h.planning)+abs(p.pace-h.pace)+abs(p.social_energy-h.social_energy)
            +abs(p.budget-h.budget)+abs(p.nightlife-h.nightlife)+abs(p.adventurousness-h.adventurousness))::float/24) end)
      + 0.10 * 0.8
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested'
    order by score desc
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining and c.score >= 60 then
      update public.vibe_interests set status='invited', match_score=c.score,
        invitation_sent_at=now(), invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
        where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_invitation', 'You''re invited to '||v.title,
              'Confirm your spot to unlock the location & chat.', jsonb_build_object('vibe_id', p_vibe));
      v_invited := v_invited + 1;
    else
      update public.vibe_interests set status='standby', match_score=c.score
        where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_standby', v.title||' is filling up',
              'You''re on standby — we''ll bump you in if a spot opens.', jsonb_build_object('vibe_id', p_vibe));
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status='ranking' where id=p_vibe and status <> 'cancelled';
  perform public.backfill_vibe(p_vibe);       -- top up from standby
  perform public.invite_city_fallback(p_vibe); -- still short? pull in same-city matches
  return jsonb_build_object('invited', v_invited, 'standby', v_standby);
end $$;
grant execute on function public._rank_vibe_core(uuid) to authenticated;
*/

-- ── Host-facing rank_vibe: auth-gated wrapper around the core ───────────────
create or replace function public.rank_vibe(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  select host_id into v_host from public.vibes where id = p_vibe;
  if v_host is null then raise exception 'vibe not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can run matching'; end if;
  return public._rank_vibe_core(p_vibe);
end $$;
grant execute on function public.rank_vibe(uuid) to authenticated;

-- ── Scheduler: auto-run the initial ranking when each Vibe's run_at arrives ──
create or replace function public.auto_rank_due_vibes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.vibes
    where status = 'open'
      and starts_at > now()
      and now() >= public._vibe_run_at(starts_at, signup_deadline)
  loop
    perform public._rank_vibe_core(r.id);
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-auto-rank'); exception when others then null; end $$;
select cron.schedule('flockie-auto-rank', '*/5 * * * *', $$ select public.auto_rank_due_vibes(); $$);

-- ── Keep vibes topped up every 10 min ───────────────────────────────────────
--   * Ranked vibes: backfill from standby + same-city.
--   * Open vibes within 48h of their deadline: start same-city fallback early
--     so the city pool has lead time to see and confirm the invite.
create or replace function public.autofill_open_vibes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.vibes where status = 'ranking' and starts_at > now() loop
    perform public.backfill_vibe(r.id);
    perform public.invite_city_fallback(r.id);
  end loop;
  for r in
    select id from public.vibes
    where status = 'open'
      and starts_at > now()
      and now() >= coalesce(signup_deadline, starts_at - interval '24 hours') - interval '48 hours'
  loop
    perform public.invite_city_fallback(r.id);
  end loop;
end $$;
do $$ begin perform cron.unschedule('flockie-autofill'); exception when others then null; end $$;
select cron.schedule('flockie-autofill', '*/10 * * * *', $$ select public.autofill_open_vibes(); $$);


-- ═══════════════════════════════════════════════════════════════════
-- [14] recommended-vibes.sql
-- ═══════════════════════════════════════════════════════════════════

-- Vibe match scoring + "Picked for you". Run the whole file in the Supabase SQL
-- editor AFTER vibe-eligibility-enforce.sql (recommended_vibes filters through
-- vibe_eligible). Safe to re-run.
--
-- vibe_match(user, vibe) -> 0-100, how well an open Vibe fits a user's profile:
--   0.35 category fit   — does the Vibe's category match something you do?
--   0.25 vibe-tag fit   — event tags (chill/social/party…) vs your activity vibe
--   0.12 skill fit      — required skill vs your skill in that activity
--   0.13 social fit     — how social the event reads vs your activity-social pref
--   0.15 review fit     — do you tend to recommend Vibes like this? (vibe_review_fit)
-- Used by both the "X% your vibe" card badge and the "Picked for you" ranking.
-- The review-fit term (2026-07-02) was ported from the tombstoned copy in
-- vibe-review-preferences.sql; the other four weights were rescaled from
-- 0.40/0.30/0.15/0.15 so the five still sum to 1.0.

create or replace function public.vibe_match(p_user uuid, p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare
  pr public.profiles%rowtype;
  v public.vibes%rowtype;
  cat_fit numeric; tag_fit numeric; skill_fit numeric; social_fit numeric; review_fit numeric;
  n_tags int; n_match int; event_social int; matched_skill int;
begin
  select * into pr from public.profiles where id = p_user;
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return null; end if;

  -- category / activity fit
  if coalesce(array_length(pr.activities, 1), 0) = 0 or v.category is null or v.category = 'other' then
    cat_fit := 0.5;
  elsif exists (select 1 from unnest(pr.activities) a where lower(a) like '%' || lower(v.category) || '%') then
    cat_fit := 1.0;
  else
    cat_fit := 0.2;
  end if;

  -- vibe-tag fit (event tags appearing in the user's activity-vibe phrases)
  n_tags := coalesce(array_length(v.event_vibe_tags, 1), 0);
  if n_tags = 0 or coalesce(array_length(pr.activity_vibe, 1), 0) = 0 then
    tag_fit := 0.5;
  else
    select count(*) into n_match
    from unnest(v.event_vibe_tags) tg
    where lower(array_to_string(pr.activity_vibe, ' ')) like '%' || lower(tg) || '%';
    tag_fit := n_match::numeric / n_tags;
  end if;

  -- skill fit
  if v.required_skill_level is null then
    skill_fit := 1.0;
  else
    select case when (pr.activity_skills->>a) ~ '^[0-9]+$' then (pr.activity_skills->>a)::int end into matched_skill
    from unnest(pr.activities) a
    where lower(a) like '%' || lower(v.category) || '%' and pr.activity_skills ? a
    limit 1;
    if matched_skill is null then
      skill_fit := 0.5;
    else
      skill_fit := 1 - abs(v.required_skill_level - matched_skill)::numeric / 4;
    end if;
  end if;

  -- social fit
  event_social := case
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('party', 'social', 'energetic')) then 5
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('quiet', 'chill')) then 2
    else 3
  end;
  if pr.activity_social is null then
    social_fit := 0.5;
  else
    social_fit := 1 - abs(event_social - pr.activity_social)::numeric / 4;
  end if;

  -- review fit: do this user's past positive reviews lean toward this category /
  -- these tags? vibe_review_fit returns 0..1 (0.5 neutral when no reviews yet).
  review_fit := public.vibe_review_fit(p_user, p_vibe);

  return round(100 * (0.35 * cat_fit + 0.25 * tag_fit + 0.12 * skill_fit + 0.13 * social_fit + 0.15 * review_fit));
end $$;
grant execute on function public.vibe_match(uuid, uuid) to authenticated;

-- Per-vibe match for the "X% your vibe" badge on cards.
drop function if exists public.vibe_match_scores(uuid[]);
create or replace function public.vibe_match_scores(p_ids uuid[])
returns table (vibe_id uuid, score int)
language sql security definer set search_path = public stable as $$
  select v.id, public.vibe_match(auth.uid(), v.id)
  from public.vibes v
  where v.id = any(p_ids);
$$;
grant execute on function public.vibe_match_scores(uuid[]) to authenticated;

-- "Picked for you": upcoming open Vibes in your city you don't host / haven't
-- shown interest in, ranked by vibe_match.
drop function if exists public.recommended_vibes(int);
create or replace function public.recommended_vibes(p_limit int default 6)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  photos text[],
  city text,
  area text,
  country text,
  starts_at timestamptz,
  capacity int,
  event_vibe_tags text[],
  match_score int
)
language sql security definer set search_path = public stable as $$
  with me as (select id, home_city from public.profiles where id = auth.uid())
  select
    v.id, v.host_id, v.title, v.category, v.photos, v.city, v.area, v.country,
    v.starts_at, v.capacity, v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status = 'open'
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    and not exists (
      select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = m.id
    )
    and not exists (
      select 1 from public.vibe_feedback vf
      where vf.vibe_id = v.id and vf.user_id = m.id and vf.signal = 'not_for_me'
    )
    -- never recommend a vibe whose host prefs (gender/age) exclude the viewer
    and public.vibe_eligible(m.id, v.id)
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$$;
grant execute on function public.recommended_vibes(int) to authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- [15] vibe-interests-status-lock.sql
-- ═══════════════════════════════════════════════════════════════════

-- P0 FIX (2026-06-28): lock the vibe_interests self-write policies to status
-- 'interested' only. Run in the Supabase SQL editor AFTER
-- vibe-eligibility-enforce.sql (the INSERT policy calls vibe_eligible).
-- Safe to re-run. This file is the CANONICAL definition of the self-write
-- policies (the older inline copies in vibes-module.sql are wrapped out).
--
-- Before this, the INSERT/UPDATE policies only checked `user_id = auth.uid()`, so
-- any signed-in user could directly POST/PATCH their own interest row to
-- status='confirmed' for ANY vibe — bypassing the invite/matching/capacity flow
-- and unlocking exact GPS (public.vibe_private_logistics) + the vibe chat
-- (public.is_vibe_member) with no host approval.
--
-- The UI only ever inserts status='interested' (InterestButton) and deletes.
-- All privileged transitions run through SECURITY DEFINER RPCs that bypass RLS,
-- so this change breaks nothing legitimate.

-- Eligibility (2026-07-02): entering the funnel also requires satisfying the
-- host's gender/age preferences (vibe_eligible — see vibe-eligibility-enforce.sql).
-- The client shows a friendly message via a pre-check (InterestButton).
drop policy if exists "interests self insert" on public.vibe_interests;
create policy "interests self insert" on public.vibe_interests for insert to authenticated
  with check (user_id = auth.uid() and status = 'interested'
              and public.vibe_eligible(auth.uid(), vibe_id));

drop policy if exists "interests self update" on public.vibe_interests;
create policy "interests self update" on public.vibe_interests for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'interested');

-- OPTIONAL audit — find rows whose status was self-elevated WITHOUT a matching
-- invitation timestamp (i.e. set outside the RPC flow). Review before deleting.
-- select vi.* from public.vibe_interests vi
--   where vi.status = 'confirmed' and vi.invitation_sent_at is null;
