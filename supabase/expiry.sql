-- 24h invitation expiry + rolling backfill. Run in Supabase SQL Editor.

-- Fill open slots (capacity - confirmed - active invites) from the top of standby
create or replace function public.backfill_vibe(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v public.vibes;
  v_confirmed int; v_active int; v_remaining int; v_added int := 0; c record;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return 0; end if;

  select count(*) into v_confirmed
    from public.vibe_interests where vibe_id = p_vibe and status = 'confirmed';
  select count(*) into v_active
    from public.vibe_interests
    where vibe_id = p_vibe and status = 'invited'
      and (invitation_expires_at is null or invitation_expires_at > now());

  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);
  if v_remaining <= 0 then return 0; end if;

  for c in
    select user_id from public.vibe_interests
    where vibe_id = p_vibe and status = 'standby'
    order by match_score desc nulls last
    limit v_remaining
  loop
    update public.vibe_interests
      set status = 'invited', invitation_sent_at = now(),
          invitation_expires_at = now() + interval '24 hours'
      where vibe_id = p_vibe and user_id = c.user_id;
    insert into public.notifications (user_id, type, title, body, data)
      values (c.user_id, 'vibe_invitation', 'A spot opened up: ' || v.title,
              'You''re in — confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
grant execute on function public.backfill_vibe(uuid) to authenticated;

-- Sweep expired invitations -> ghosted + soft penalty, then backfill those vibes
create or replace function public.expire_invitations()
returns void language plpgsql security definer set search_path = public as $$
declare r record; aff uuid[] := '{}';
begin
  for r in
    select id, vibe_id, user_id from public.vibe_interests
    where status = 'invited' and invitation_expires_at is not null
      and invitation_expires_at < now()
  loop
    update public.vibe_interests set status = 'ghosted' where id = r.id;
    aff := array_append(aff, r.vibe_id);
  end loop;

  for r in select distinct u as vibe_id from unnest(aff) u loop
    perform public.backfill_vibe(r.vibe_id);
  end loop;
end $$;

-- A user declines -> mark declined + immediately backfill
create or replace function public.decline_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.vibe_interests set status = 'declined'
    where vibe_id = p_vibe and user_id = auth.uid();
  perform public.backfill_vibe(p_vibe);
end $$;
grant execute on function public.decline_vibe(uuid) to authenticated;

-- Schedule the sweep every 5 minutes (pg_cron)
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('flockie-expire-invites');
exception when others then null; end $$;
select cron.schedule('flockie-expire-invites', '*/5 * * * *',
  $$ select public.expire_invitations(); $$);
