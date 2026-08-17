-- CLUB GATHERINGS GO INVITE-ONLY (founder call 2026-08-17). A gathering that
-- belongs to a club stops appearing anywhere public - browse, home, the
-- recommendation engine, and the same-city fallback nudges. Members see it via
-- the club (and get a notification when it is scheduled); everyone else can
-- only enter through the host's private invite link. The public /invite page
-- keeps working on purpose: that IS the private link.
--
-- Contents:
--   1. vibe_directory + club_id (appended at the END - view rule).
--   2. recommended_vibes: club gatherings excluded.
--   3. invite_city_fallback: early-return for club gatherings.
--   4. notify_club_gathering(p_vibe): host-only, once per gathering, notifies
--      every active member except the host ('club_gathering', inbox-only).
-- Supersedes: recommended_vibes (recommended-vibes-joinable.sql),
-- invite_city_fallback (vibe-city-fallback-recommend.sql), vibe_directory
-- (vibe-directory-timezone.sql). Run in the Supabase SQL editor. Safe to
-- re-run.

create or replace view public.vibe_directory
with (security_barrier = true, security_invoker = false)
as
select
  v.id,
  v.host_id,
  v.title,
  v.description,
  v.category,
  v.photos,
  v.country,
  v.city,
  v.area,
  v.starts_at,
  v.ends_at,
  v.signup_deadline,
  v.capacity,
  v.event_vibe_tags,
  v.required_skill_level,
  v.dealbreaker_rules,
  v.diversity_floor_enabled,
  v.what_to_bring,
  v.language,
  v.age_min,
  v.age_max,
  v.gender_pref,
  v.status,
  v.created_at,
  v.categories,
  v.timezone,
  -- appended at the END (create or replace view can only add trailing columns).
  v.club_id
from public.vibes v;

revoke all on public.vibe_directory from public, anon, authenticated;
grant select on public.vibe_directory to authenticated;

create or replace function public.recommended_vibes(p_limit integer default 6)
 returns table(id uuid, host_id uuid, title text, category text, photos text[], city text, area text, country text, starts_at timestamp with time zone, capacity integer, event_vibe_tags text[], match_score integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with me as (select id, home_city from public.profiles where id = auth.uid())
  select
    v.id, v.host_id, v.title, v.category, v.photos, v.city, v.area, v.country,
    v.starts_at, v.capacity, v.event_vibe_tags,
    public.vibe_match(auth.uid(), v.id) as match_score
  from public.vibes v
  cross join me m
  where v.status in ('open', 'reviewing', 'ranking', 'finalized')   -- still-joinable, not just open
    and v.club_id is null                                              -- club gatherings are invite-only
    and v.starts_at > now()
    and v.host_id <> m.id
    and (m.home_city is null or lower(v.city) = lower(m.home_city))
    -- already in / interested (any status) -> excluded
    and not exists (
      select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = m.id
    )
    and not exists (
      select 1 from public.vibe_feedback vf
      where vf.vibe_id = v.id and vf.user_id = m.id and vf.signal = 'not_for_me'
    )
    -- only while there's still room - don't recommend a full vibe
    and (select count(*) from public.vibe_interests vi2
         where vi2.vibe_id = v.id and vi2.status = 'confirmed') < v.capacity
    -- never recommend a vibe whose host prefs (gender/age) exclude the viewer
    and public.vibe_eligible(m.id, v.id)
  order by match_score desc nulls last, v.starts_at asc
  limit p_limit;
$function$;

create or replace function public.invite_city_fallback(p_vibe uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.vibes; v_pool int; v_recommended int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return 0; end if;
  if v.starts_at <= now() then return 0; end if;  -- never recommend a started/finished Vibe
  if v.club_id is not null then return 0; end if;  -- club gatherings are invite-only: never nudge the city

  -- People genuinely in the funnel...
  select count(*) into v_pool from public.vibe_interests
    where vibe_id = p_vibe and status in ('interested','requested','standby','shortlisted','invited','confirmed');
  -- ...plus people we've already recommended (they didn't create a row, so count
  -- the notifications) - keeps total reach bounded to the spots available.
  select count(*) into v_recommended from public.notifications
    where type = 'vibe_recommendation' and data->>'vibe_id' = p_vibe::text;
  v_remaining := public._vibe_algo_remaining(p_vibe) - v_pool - v_recommended;
  if v_remaining <= 0 then return 0; end if;  -- enough reached already

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
      and not exists (select 1 from public.notifications n                -- recommend at most once per person per vibe
                      where n.user_id=p.id and n.type='vibe_recommendation'
                        and n.data->>'vibe_id' = p_vibe::text)
      and public.vibe_eligible(p.id, p_vibe)  -- host's gender + age prefs
    order by score desc nulls last, p.id
    limit v_remaining
  loop
    -- RECOMMEND ONLY - no vibe_interests row. They enter the run via "I'm interested".
    perform public.notify(c.id, 'vibe_recommendation', 'A Vibe in ' || v.city || ' you might love: ' || v.title,
            'Tap to check it out - join if it''s your vibe.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $function$;


-- ── Notify every member when a gathering is scheduled ───────────────────────
alter table public.vibes
  add column if not exists club_notified_at timestamptz;

create or replace function public.notify_club_gathering(p_vibe uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v public.vibes; c record; v_count int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.club_id is null then raise exception 'not a club gathering'; end if;
  if not public.is_club_host(v.club_id) then raise exception 'only the club host'; end if;
  if v.club_notified_at is not null then return 0; end if;  -- once per gathering

  for c in
    select user_id from public.club_memberships
    where club_id = v.club_id
      and status in ('founding', 'regular')
      and user_id <> v.host_id
  loop
    perform public.notify(c.user_id, 'club_gathering',
      'New gathering: ' || v.title,
      'Your club scheduled a gathering. Tap to grab your spot.',
      jsonb_build_object('vibe_id', p_vibe));
    v_count := v_count + 1;
  end loop;

  update public.vibes set club_notified_at = now() where id = p_vibe;
  return v_count;
end;
$$;
revoke execute on function public.notify_club_gathering(uuid) from public, anon;
grant execute on function public.notify_club_gathering(uuid) to authenticated;
