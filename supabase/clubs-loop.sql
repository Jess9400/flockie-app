-- ============================================================================
-- Flockie Clubs - THE LOOP (built on Taisiya's clubs foundation).
-- Run AFTER: clubs-foundation.sql, club-detail-access.sql,
-- club-founder-invites.sql, club-heartbeat.sql, club-membership-decisions.sql.
-- Idempotent / safe to re-run.
--
-- Adds the plan's MVP floor on top of the foundation (docs/communities-plan.md):
--   1. convert_vibe_to_club  - "Turn this into a club?" for a vibe that went
--      well: club born ACTIVE from proven chemistry, attendees credited with
--      real attendance, host picks founding invitees.
--   2. Automatic heartbeat   - hourly cron. flockie_assisted clubs get their
--      next gathering auto-scheduled ("same time, same place - you in?");
--      host_run clubs get the graceful handoff escalation (nudge → offer →
--      auto-switch to flockie_assisted so the group survives).
--   3. Post-attendance join prompt - recorded attendance for a non-member
--      notifies them: "you were there - want to join?"
--   4. set_club_mode         - host toggles host_run <-> flockie_assisted.
--   5. Club chat             - persistent club room (club_messages).
-- ============================================================================

-- ── Heartbeat bookkeeping columns ───────────────────────────────────────────
alter table public.clubs add column if not exists nudge_stage int not null default 0;
alter table public.clubs add column if not exists nudged_at timestamptz;

-- ── 1) Turn a finished vibe into a club ─────────────────────────────────────
create or replace function public.convert_vibe_to_club(
  p_vibe uuid,
  p_title text default null,
  p_cadence text default 'monthly',
  p_invitees uuid[] default '{}'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v vibes%rowtype;
  v_club uuid;
  v_title text;
  u uuid;
begin
  select * into v from public.vibes where id = p_vibe;
  if not found then raise exception 'vibe_not_found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the vibe host can do this'; end if;
  if coalesce(v.ends_at, v.starts_at) > now() then raise exception 'vibe has not ended yet'; end if;
  if v.club_id is not null then raise exception 'already part of a club'; end if;
  if p_cadence not in ('weekly', 'biweekly', 'monthly') then raise exception 'invalid club cadence'; end if;

  v_title := left(trim(coalesce(nullif(trim(coalesce(p_title, '')), ''), v.title)), 80);
  if char_length(v_title) < 3 then raise exception 'club title must be between 3 and 80 characters'; end if;

  -- Born ACTIVE: the vibe that just happened IS the completed first gathering.
  insert into public.clubs (
    owner_id, title, description, city, area, category, cover_photo,
    cadence, status, openness
  )
  values (
    auth.uid(), v_title, left(coalesce(v.description, ''), 600), v.city, v.area,
    v.category, (v.photos)[1], p_cadence, 'active', 'discoverable'
  )
  returning id into v_club;

  update public.vibes set club_id = v_club where id = p_vibe;

  insert into public.club_memberships (club_id, user_id, role, status, joined_at)
  values (v_club, auth.uid(), 'host', 'founding', now())
  on conflict do nothing;

  -- Everyone who was actually in the room gets real attendance credit.
  insert into public.club_attendance (club_id, vibe_id, user_id, recorded_by)
  select v_club, p_vibe, vi.user_id, auth.uid()
  from public.vibe_interests vi
  where vi.vibe_id = p_vibe and vi.status = 'confirmed'
  on conflict do nothing;
  insert into public.club_attendance (club_id, vibe_id, user_id, recorded_by)
  values (v_club, p_vibe, auth.uid(), auth.uid())
  on conflict do nothing;

  -- Host-picked founding invitees (must have been confirmed on the vibe).
  foreach u in array coalesce(p_invitees, '{}') loop
    if u <> auth.uid() and exists (
      select 1 from public.vibe_interests vi
      where vi.vibe_id = p_vibe and vi.user_id = u and vi.status = 'confirmed'
    ) then
      insert into public.club_memberships (club_id, user_id, role, status, invited_by)
      values (v_club, u, 'member', 'invited', auth.uid())
      on conflict (club_id, user_id) do nothing;
      perform public.notify(
        u, 'club_founder_invite',
        'You are invited to a new club',
        'The group from "' || v.title || '" is becoming a club: "' || v_title
          || '". You are invited as a founding member.',
        jsonb_build_object('club_id', v_club, 'href', '/clubs/' || v_club)
      );
    end if;
  end loop;

  return v_club;
end;
$$;
grant execute on function public.convert_vibe_to_club(uuid, text, text, uuid[]) to authenticated;

-- ── 3) Post-attendance join prompt (trigger on recorded attendance) ─────────
create or replace function public.club_attendance_join_prompt()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text; v_owner uuid;
begin
  select title, owner_id into v_title, v_owner from public.clubs where id = new.club_id;
  -- Only prompt people who are not the host and have no membership row yet.
  if new.user_id <> v_owner and not exists (
    select 1 from public.club_memberships m
    where m.club_id = new.club_id and m.user_id = new.user_id
  ) then
    perform public.notify(
      new.user_id, 'club_join_prompt',
      'Join ' || coalesce(v_title, 'this club') || '?',
      'You were at their last gathering. Members get every next one - want in?',
      jsonb_build_object('club_id', new.club_id, 'href', '/clubs/' || new.club_id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists club_attendance_join_prompt_t on public.club_attendance;
create trigger club_attendance_join_prompt_t
after insert on public.club_attendance
for each row execute function public.club_attendance_join_prompt();

-- ── 4) Host toggles how the club runs ───────────────────────────────────────
create or replace function public.set_club_mode(p_club uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_club_host(p_club) then raise exception 'only the club host can change this'; end if;
  if p_mode not in ('host_run', 'flockie_assisted') then raise exception 'invalid mode'; end if;
  update public.clubs
     set operating_mode = p_mode, nudge_stage = 0, nudged_at = null, updated_at = now()
   where id = p_club;
end;
$$;
grant execute on function public.set_club_mode(uuid, text) to authenticated;

-- ── 2) The automatic heartbeat ──────────────────────────────────────────────
-- Hourly. For every ACTIVE club with no upcoming gathering whose next beat is
-- near (due within 48h or overdue):
--   flockie_assisted → auto-create the next gathering as a copy of the last
--     one, pushed one cadence forward (repeatedly until it lands in the
--     future), and tell every member: one tap to be in.
--   host_run → graceful handoff: nudge (stage 1) → offer takeover (stage 2)
--     → auto-switch to flockie_assisted (stage 3); each stage 48h apart. The
--     club surviving is the default outcome; the switch is fully reversible.
create or replace function public.club_heartbeat_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
  last_v vibes%rowtype;
  v_step interval;
  v_next timestamptz;
  v_new uuid;
  m record;
begin
  for c in
    select cl.* from public.clubs cl
    where cl.status = 'active'
      and not exists (
        select 1 from public.vibes uv
        where uv.club_id = cl.id and uv.status <> 'cancelled'
          and uv.starts_at > now()
      )
  loop
    select * into last_v from public.vibes
    where club_id = c.id and status <> 'cancelled'
      and coalesce(ends_at, starts_at) <= now()
    order by starts_at desc limit 1;
    if not found then continue; end if;

    v_step := case c.cadence when 'weekly' then interval '7 days'
                             when 'biweekly' then interval '14 days'
                             else interval '1 month' end;
    v_next := last_v.starts_at + v_step;
    while v_next < now() + interval '24 hours' loop
      v_next := v_next + v_step;
    end loop;

    -- Only act when the beat is close (within 48h of the scheduled rhythm) or
    -- the club is already overdue (no future gathering at all counts once the
    -- next beat window opens).
    if last_v.starts_at + v_step > now() + interval '48 hours' then continue; end if;

    if c.operating_mode = 'flockie_assisted' then
      insert into public.vibes (
        host_id, title, description, category, categories, photos, country,
        city, area, location_name, location_lat, location_lng, activity_url,
        starts_at, ends_at, signup_deadline, capacity, event_vibe_tags,
        required_skill_level, dealbreaker_rules, diversity_floor_enabled,
        gender_pref, status, club_id, timezone
      )
      values (
        c.owner_id, last_v.title, last_v.description, last_v.category,
        last_v.categories, last_v.photos, last_v.country, last_v.city,
        last_v.area, last_v.location_name, last_v.location_lat,
        last_v.location_lng, last_v.activity_url,
        v_next,
        case when last_v.ends_at is null then null
             else v_next + (last_v.ends_at - last_v.starts_at) end,
        greatest(v_next - interval '2 hours', now() + interval '30 minutes'),
        last_v.capacity, last_v.event_vibe_tags, last_v.required_skill_level,
        last_v.dealbreaker_rules, last_v.diversity_floor_enabled,
        last_v.gender_pref, 'open', c.id, last_v.timezone
      )
      returning id into v_new;

      update public.clubs set nudge_stage = 0, nudged_at = null, updated_at = now()
      where id = c.id;

      -- The reminder lands IN the club chat (the plan's design), plus inbox.
      insert into public.club_messages (club_id, sender_id, content)
      values (c.id, null,
        c.title || ': ' || trim(to_char(v_next, 'Day')) || ', same place - you in? Tap the next gathering on the club page.');

      -- One-tap "you in?" to the whole club (host included).
      for m in
        select user_id from public.club_memberships
        where club_id = c.id and status in ('founding', 'regular')
          and not exists (select 1 from public.chat_mutes cm
                          where cm.user_id = club_memberships.user_id and cm.chat_id = c.id)
      loop
        perform public.notify(
          m.user_id, 'club_gathering',
          c.title || ': ' || trim(to_char(v_next, 'Day')) || ', same place - you in?',
          'The next ' || c.title || ' gathering is scheduled. One tap to be in.',
          jsonb_build_object('club_id', c.id, 'vibe_id', v_new, 'href', '/vibes/' || v_new)
        );
      end loop;

    else
      -- host_run: graceful handoff ladder, one rung per 48h.
      if c.nudged_at is not null and c.nudged_at > now() - interval '48 hours' then
        continue;
      end if;
      if c.nudge_stage = 0 then
        perform public.notify(
          c.owner_id, 'club_heartbeat',
          'Time for the next ' || c.title || ' gathering',
          'Your club meets ' || c.cadence || ' - plan the next one in a tap (same time, same place).',
          jsonb_build_object('club_id', c.id, 'href', '/clubs/' || c.id)
        );
        update public.clubs set nudge_stage = 1, nudged_at = now() where id = c.id;
      elsif c.nudge_stage = 1 then
        perform public.notify(
          c.owner_id, 'club_heartbeat',
          'Want Flockie to keep ' || c.title || ' going?',
          'Things have gone quiet. Flockie can schedule the next gathering for you - you just show up.',
          jsonb_build_object('club_id', c.id, 'href', '/clubs/' || c.id)
        );
        update public.clubs set nudge_stage = 2, nudged_at = now() where id = c.id;
      else
        update public.clubs
           set operating_mode = 'flockie_assisted', nudge_stage = 0, nudged_at = null, updated_at = now()
         where id = c.id;
        perform public.notify(
          c.owner_id, 'club_heartbeat',
          'We kept ' || c.title || ' going',
          'Flockie is now scheduling the gatherings so the group survives. Flip back to running it yourself anytime.',
          jsonb_build_object('club_id', c.id, 'href', '/clubs/' || c.id)
        );
      end if;
    end if;
  end loop;
end;
$$;

do $$ begin perform cron.unschedule('flockie-club-heartbeat'); exception when others then null; end $$;
select cron.schedule('flockie-club-heartbeat', '15 * * * *', $$ select public.club_heartbeat_tick(); $$);

-- ── 5) Club chat - the persistent room ──────────────────────────────────────
create table if not exists public.club_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz default now()
);
create index if not exists club_messages_club_idx on public.club_messages (club_id, created_at);

alter table public.club_messages enable row level security;
drop policy if exists "club members read" on public.club_messages;
create policy "club members read" on public.club_messages
  for select to authenticated
  using (public.is_club_member(club_id) or public.is_club_host(club_id));
drop policy if exists "club members write" on public.club_messages;
create policy "club members write" on public.club_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (public.is_club_member(club_id) or public.is_club_host(club_id))
  );

do $$ begin
  alter publication supabase_realtime add table public.club_messages;
exception when others then null; end $$;

-- ── Club chats in the unified Chats list ────────────────────────────────────
create or replace function public.my_club_chats()
returns table (club_id uuid, title text, cover_photo text, unread int, last_at timestamptz)
language sql security definer set search_path = public stable as $$
  select
    c.id,
    c.title,
    c.cover_photo,
    (
      select count(*)::int
      from public.club_messages m
      left join public.chat_reads cr
        on cr.user_id = auth.uid() and cr.chat_id = c.id
      where m.club_id = c.id
        and (m.sender_id is null or m.sender_id <> auth.uid())
        and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    ) as unread,
    (select max(m2.created_at) from public.club_messages m2 where m2.club_id = c.id) as last_at
  from public.clubs c
  where c.status in ('forming', 'active', 'paused')
    and (
      c.owner_id = auth.uid()
      or exists (
        select 1 from public.club_memberships cm
        where cm.club_id = c.id and cm.user_id = auth.uid()
          and cm.status in ('founding', 'regular')
      )
    );
$$;
grant execute on function public.my_club_chats() to authenticated;
