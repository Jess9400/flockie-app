-- Host controls, notification opt-out, continuous backfill. Run in SQL Editor.

-- 1) Notification opt-out
alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

-- Insert a notification only if the recipient has them on
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = p_user and coalesce(notifications_enabled, true)) then
    insert into public.notifications (user_id, type, title, body, data)
    values (p_user, p_type, p_title, p_body, p_data);
  end if;
end $$;

-- 2) Host cancels a Vibe (soft delete). Chat stays; vibe becomes 'cancelled'.
create or replace function public.cancel_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; r record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host'; end if;
  update public.vibes set status = 'cancelled' where id = p_vibe;
  for r in select user_id from public.vibe_interests
           where vibe_id = p_vibe and status in ('invited','confirmed','standby') loop
    perform public.notify(r.user_id, 'vibe_cancelled', 'Cancelled: ' || v.title,
            'The host cancelled this Vibe.', jsonb_build_object('vibe_id', p_vibe));
  end loop;
end $$;
grant execute on function public.cancel_vibe(uuid) to authenticated;

-- 3) Host updates timing -> notify everyone in
create or replace function public.update_vibe_when(p_vibe uuid, p_starts timestamptz, p_ends timestamptz, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; r record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host'; end if;
  update public.vibes
    set starts_at = p_starts, ends_at = p_ends,
        signup_deadline = coalesce(p_deadline, signup_deadline)
    where id = p_vibe;
  for r in select user_id from public.vibe_interests
           where vibe_id = p_vibe and status in ('invited','confirmed') loop
    perform public.notify(r.user_id, 'vibe_updated', 'New time for ' || v.title,
            'The host changed the date or time. Check the details.', jsonb_build_object('vibe_id', p_vibe));
  end loop;
end $$;
grant execute on function public.update_vibe_when(uuid, timestamptz, timestamptz, timestamptz) to authenticated;

-- 4) Backfill from standby (now via notify) — keeps filling open spots by score
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
      invitation_expires_at=now()+interval '24 hours' where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
            'You''re in — confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;

-- 5) rank_vibe — score interested, invite up to capacity, standby rest, then top up
create or replace function public.rank_vibe(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_active int; v_remaining int; v_invited int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can run matching'; end if;

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
        invitation_sent_at=now(), invitation_expires_at=now()+interval '24 hours'
        where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_invitation', 'You''re invited to '||v.title,
              'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
      v_invited := v_invited + 1;
    else
      update public.vibe_interests set status='standby', match_score=c.score
        where vibe_id=p_vibe and user_id=c.user_id;
      perform public.notify(c.user_id, 'vibe_standby', v.title||' filled with a specific vibe',
              'Here are events that match yours better.', jsonb_build_object('vibe_id', p_vibe));
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status='ranking' where id=p_vibe;
  perform public.backfill_vibe(p_vibe); -- top up any open spots from standby
  return jsonb_build_object('invited', v_invited, 'standby', v_standby);
end $$;
grant execute on function public.rank_vibe(uuid) to authenticated;

-- 6) Host manually approves/denies pending interest
create or replace function public.host_invite_interest(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_confirmed int; v_active int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can approve interests'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;

  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null then raise exception 'interest not found'; end if;
  if v_status not in ('interested','standby') then raise exception 'only interested or standby users can be approved'; end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  if greatest(v.capacity - v_confirmed - v_active, 0) <= 0 then
    raise exception 'vibe is full';
  end if;

  update public.vibe_interests
    set status='invited', invitation_sent_at=now(), invitation_expires_at=now()+interval '24 hours'
    where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_invitation', 'You''re invited to '||v.title,
          'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.host_invite_interest(uuid, uuid) to authenticated;

create or replace function public.host_make_room_invite_interest(p_vibe uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_confirmed int; v_active int; v_new_capacity int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can make room'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;

  select status into v_status from public.vibe_interests
    where vibe_id=p_vibe and user_id=p_user
    for update;
  if v_status is null then raise exception 'interest not found'; end if;
  if v_status not in ('interested','standby') then raise exception 'only interested or standby users can be approved'; end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status='invited' and (invitation_expires_at is null or invitation_expires_at > now());
  if greatest(v.capacity - v_confirmed - v_active, 0) > 0 then
    raise exception 'room is already available; approve normally';
  end if;

  v_new_capacity := greatest(v.capacity + 1, v_confirmed + v_active + 1);
  update public.vibes set capacity=v_new_capacity where id=p_vibe;

  update public.vibe_interests
    set status='invited', invitation_sent_at=now(), invitation_expires_at=now()+interval '24 hours'
    where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_invitation', 'The host made room for you at '||v.title,
          'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));

  return jsonb_build_object('capacity', v_new_capacity);
end $$;
grant execute on function public.host_make_room_invite_interest(uuid, uuid) to authenticated;

create or replace function public.host_decline_interest(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can deny interests'; end if;

  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null then raise exception 'interest not found'; end if;
  if v_status not in ('interested','standby') then raise exception 'only interested or standby users can be denied here'; end if;

  update public.vibe_interests
    set status='declined', invitation_expires_at=null
    where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_declined', v.title || ' is not a match this time',
          'The host went with a different mix for this Vibe.', jsonb_build_object('vibe_id', p_vibe));
  perform public.backfill_vibe(p_vibe);
end $$;
grant execute on function public.host_decline_interest(uuid, uuid) to authenticated;

-- 6b) Host removes invited/confirmed people with guardrails.
-- Normal removal is limited: min(3, max(1, floor(capacity * 20%))).
-- Safety removal is unlimited, requires a note, and is logged for review.
create table if not exists public.vibe_removals (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid references public.vibes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  host_id uuid references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('known_conflict', 'other', 'safety')),
  note text,
  previous_status text,
  is_safety boolean not null default false,
  disputed_at timestamptz,
  dispute_note text,
  reviewed_at timestamptz,
  review_status text,
  created_at timestamptz default now(),
  unique (vibe_id, user_id)
);
create index if not exists vibe_removals_vibe_idx on public.vibe_removals (vibe_id, created_at desc);
create index if not exists vibe_removals_user_idx on public.vibe_removals (user_id, created_at desc);
alter table public.vibe_removals enable row level security;

drop policy if exists "removals read" on public.vibe_removals;
create policy "removals read" on public.vibe_removals for select to authenticated
  using (
    user_id = auth.uid()
    or auth.uid() = (select host_id from public.vibes v where v.id = vibe_id)
  );

create or replace function public.host_remove_vibe_member(
  p_vibe uuid,
  p_user uuid,
  p_reason text,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.vibes;
  v_status text;
  v_is_safety boolean;
  v_note text;
  v_limit int;
  v_used int;
begin
  select * into v from public.vibes where id = p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can remove members'; end if;
  if v.host_id = p_user then raise exception 'host cannot remove themselves'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;

  if p_reason not in ('known_conflict', 'other', 'safety') then
    raise exception 'invalid removal reason';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_is_safety := p_reason = 'safety';

  if p_reason in ('other', 'safety') and v_note is null then
    raise exception 'a note is required for this removal reason';
  end if;

  select status into v_status
    from public.vibe_interests
    where vibe_id = p_vibe and user_id = p_user
    for update;
  if v_status is null then raise exception 'member not found'; end if;
  if v_status not in ('invited', 'confirmed') then
    raise exception 'only invited or confirmed people can be removed';
  end if;

  if not v_is_safety and v.starts_at <= now() then
    raise exception 'normal removal is only available before the Vibe starts';
  end if;

  if not v_is_safety then
    v_limit := least(3, greatest(1, floor(v.capacity * 0.2)::int));
    select count(*) into v_used
      from public.vibe_removals
      where vibe_id = p_vibe and is_safety = false;
    if v_used >= v_limit then
      raise exception 'normal removal limit reached';
    end if;
  else
    v_limit := null;
    v_used := null;
  end if;

  insert into public.vibe_removals (
    vibe_id, user_id, host_id, reason, note, previous_status, is_safety
  )
  values (
    p_vibe, p_user, v.host_id, p_reason, v_note, v_status, v_is_safety
  )
  on conflict (vibe_id, user_id) do update
    set reason = excluded.reason,
        note = excluded.note,
        previous_status = excluded.previous_status,
        is_safety = excluded.is_safety,
        created_at = now();

  update public.vibe_interests
    set status = 'removed', invitation_expires_at = null
    where vibe_id = p_vibe and user_id = p_user;

  perform public.notify(
    p_user,
    'vibe_removed',
    'This Vibe is no longer available',
    'We''ll keep showing you better matches. If this feels wrong, you can tell us what happened.',
    jsonb_build_object('vibe_id', p_vibe)
  );

  perform public.backfill_vibe(p_vibe);

  return jsonb_build_object('normal_limit', v_limit, 'normal_used', v_used, 'safety', v_is_safety);
end $$;
grant execute on function public.host_remove_vibe_member(uuid, uuid, text, text) to authenticated;

create or replace function public.appeal_vibe_removal(p_vibe uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_note text;
begin
  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then raise exception 'appeal note is required'; end if;

  update public.vibe_removals
    set disputed_at = now(), dispute_note = v_note
    where vibe_id = p_vibe and user_id = auth.uid();
  if not found then raise exception 'removal not found'; end if;

  perform public.notify(
    auth.uid(),
    'vibe_removal_appeal',
    'Thanks — we got your note',
    'We''ll review what happened. You won''t be placed back into this Vibe automatically.',
    jsonb_build_object('vibe_id', p_vibe)
  );
end $$;
grant execute on function public.appeal_vibe_removal(uuid, text) to authenticated;

-- 7) confirm via notify
create or replace function public.confirm_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_updated int;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  if v_confirmed >= v.capacity then raise exception 'vibe is full'; end if;
  update public.vibe_interests set status='confirmed', confirmed_at=now()
    where vibe_id=p_vibe and user_id=auth.uid() and status='invited'
      and (invitation_expires_at is null or invitation_expires_at > now());
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'invitation required or expired'; end if;
  insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;
  perform public.notify(auth.uid(), 'vibe_confirmed', 'You''re in for '||v.title,
          'Vibing Chat is now open.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.confirm_vibe(uuid) to authenticated;

-- 8) Keep filling open vibes from standby automatically (every 10 min)
create or replace function public.autofill_open_vibes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.vibes where status = 'ranking' loop
    perform public.backfill_vibe(r.id);
  end loop;
end $$;
do $$ begin perform cron.unschedule('flockie-autofill'); exception when others then null; end $$;
select cron.schedule('flockie-autofill', '*/10 * * * *', $$ select public.autofill_open_vibes(); $$);
