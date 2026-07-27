-- One-tap join for POST-MATCHING vibes. Once the algo/host has ranked a vibe
-- (status 'ranking'/'finalized') and there's still room, a person tapping
-- "I'm interested" is confirmed straight away - no separate invite→confirm step,
-- since at that point we're just filling the room. Before matching (status
-- 'open'/'reviewing') or when full, it falls back to normal soft interest.
--
-- Replaces the client's direct `insert ... status='interested'` (which the RLS
-- policy limited to 'interested'); this SECURITY DEFINER RPC can also confirm.
-- Atomic: locks the vibe row so concurrent taps can't overfill. Room = confirmed
-- + live invites < capacity (same gate as host_accept_private). Run in the
-- Supabase SQL editor. Safe to re-run.

create or replace function public.express_interest(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_existing text; v_held int; v_chat uuid; v_name text; v_same_city boolean;
begin
  select * into v from public.vibes where id = p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if v.host_id = auth.uid() then raise exception 'you host this vibe'; end if;
  if v.starts_at <= now() then raise exception 'this vibe has already started'; end if;
  -- Host gender/age gate (RLS enforced this before; keep it here since definer bypasses RLS).
  if not public.vibe_eligible(auth.uid(), p_vibe) then
    raise exception 'not eligible for this vibe' using errcode = '42501';
  end if;

  select status into v_existing from public.vibe_interests where vibe_id=p_vibe and user_id=auth.uid();
  -- Already progressed past a fresh tap → report current status, do nothing.
  if v_existing in ('confirmed','invited','standby','shortlisted','requested') then
    return jsonb_build_object('status', v_existing, 'confirmed', v_existing = 'confirmed');
  end if;

  -- Same-city gate for the ONE-TAP confirm: only auto-confirm people in the
  -- vibe's city (they can actually show up). A different-city person still gets
  -- to express interest (falls through below) and can join via the normal flow
  -- if they're genuinely travelling there - they're just never silently
  -- confirmed into an event they likely can't attend.
  select (p.home_city is not null and lower(p.home_city) = lower(v.city))
    into v_same_city
    from public.profiles p where p.id = auth.uid();

  -- Post-matching fast path: ranked + genuine room + same city → confirm directly.
  if v.status in ('ranking','finalized') and coalesce(v_same_city, false) then
    select count(*) into v_held from public.vibe_interests
      where vibe_id = p_vibe
        and (status='confirmed'
             or (status='invited' and (invitation_expires_at is null or invitation_expires_at > now())));
    if v_held < v.capacity then
      insert into public.vibe_interests (vibe_id, user_id, status, source, confirmed_at)
        values (p_vibe, auth.uid(), 'confirmed', 'algo', now())
      on conflict (vibe_id, user_id) do update set status='confirmed', confirmed_at=now();

      -- Mirror confirm_vibe's side effects so they land in the room cleanly.
      insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;
      select id into v_chat from public.vibing_chats where vibe_id=p_vibe;
      v_name := coalesce((select display_name from public.profiles where id=auth.uid()), 'Someone');
      insert into public.vibing_messages (chat_id, sender_id, content)
        values (v_chat, null, v_name || ' joined the chat');
      insert into public.notifications (user_id, type, title, body, data)
        values (auth.uid(), 'vibe_confirmed', 'You''re in for ' || v.title,
                'Vibing Chat is now open.', jsonb_build_object('vibe_id', p_vibe));

      return jsonb_build_object('status','confirmed','confirmed',true);
    end if;
  end if;

  -- Otherwise: normal soft interest (pre-matching, or full → waits for a spot).
  insert into public.vibe_interests (vibe_id, user_id, status, source)
    values (p_vibe, auth.uid(), 'interested', 'algo')
    on conflict (vibe_id, user_id) do update set status='interested';
  return jsonb_build_object('status','interested','confirmed',false);
end $$;
grant execute on function public.express_interest(uuid) to authenticated;
