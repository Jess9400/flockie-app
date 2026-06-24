-- Real Vibe chat system messages (joined/left) + standby promotion on leave.
-- Run the whole file in the Supabase SQL editor. Safe to re-run.

-- Insert a system message (sender_id null) into a Vibe's chat, if it exists.
create or replace function public.vibe_system_msg(p_vibe uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select id into v_chat from public.vibing_chats where vibe_id = p_vibe;
  if v_chat is not null then
    insert into public.vibing_messages (chat_id, sender_id, content)
    values (v_chat, null, p_text);
  end if;
end $$;

-- confirm_vibe: invited user accepts; opens chat + confirms + posts "joined".
create or replace function public.confirm_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_name text; v_confirmed int; v_updated int;
begin
  select * into v from public.vibes where id = p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  select count(*) into v_confirmed from public.vibe_interests where vibe_id = p_vibe and status = 'confirmed';
  if v_confirmed >= v.capacity then raise exception 'vibe is full'; end if;

  update public.vibe_interests
    set status = 'confirmed', confirmed_at = now()
    where vibe_id = p_vibe and user_id = auth.uid() and status = 'invited'
      and (invitation_expires_at is null or invitation_expires_at > now());
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'invitation required or expired'; end if;

  insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;

  v_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  perform public.vibe_system_msg(p_vibe, v_name || ' joined the chat');

  insert into public.notifications (user_id, type, title, body, data)
    values (auth.uid(), 'vibe_confirmed', 'You''re in for ' || v.title,
            'Vibing Chat is now open.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.confirm_vibe(uuid) to authenticated;

-- leave_vibe: a confirmed attendee leaves; posts "left", and if a spot freed,
-- promotes the top standby to invited (24h window + notification).
create or replace function public.leave_vibe(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.vibes; v_status text; v_name text; v_promoted uuid; v_promoted_name text;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;

  select status into v_status from public.vibe_interests
    where vibe_id = p_vibe and user_id = auth.uid();

  update public.vibe_interests set status = 'declined'
    where vibe_id = p_vibe and user_id = auth.uid();

  v_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  perform public.vibe_system_msg(p_vibe, v_name || ' left the chat');

  if v_status in ('confirmed', 'invited') then
    select user_id into v_promoted from public.vibe_interests
      where vibe_id = p_vibe and status = 'standby'
      order by match_score desc nulls last
      limit 1;
    if v_promoted is not null then
      update public.vibe_interests
        set status = 'invited', invitation_sent_at = now(),
            invitation_expires_at = now() + interval '24 hours'
        where vibe_id = p_vibe and user_id = v_promoted;
      insert into public.notifications (user_id, type, title, body, data)
        values (v_promoted, 'vibe_invitation', 'A spot opened in ' || v.title,
                'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
      v_promoted_name := coalesce((select display_name from public.profiles where id = v_promoted), 'Someone');
      perform public.vibe_system_msg(p_vibe, v_promoted_name || ' was invited from standby');
    end if;
  end if;
end $$;
grant execute on function public.leave_vibe(uuid) to authenticated;
