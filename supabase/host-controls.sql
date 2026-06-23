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

create or replace function public.host_decline_interest(p_vibe uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can deny interests'; end if;

  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null then raise exception 'interest not found'; end if;
  if v_status = 'confirmed' then raise exception 'confirmed attendees cannot be denied here'; end if;

  update public.vibe_interests
    set status='declined', invitation_expires_at=null
    where vibe_id=p_vibe and user_id=p_user;
  perform public.notify(p_user, 'vibe_declined', v.title || ' is not a match this time',
          'The host went with a different mix for this Vibe.', jsonb_build_object('vibe_id', p_vibe));
  perform public.backfill_vibe(p_vibe);
end $$;
grant execute on function public.host_decline_interest(uuid, uuid) to authenticated;

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
