-- "New messages while you were away" nudge (throttled). Runs every 15 min and
-- inserts ONE `unread_messages` notification per (recipient, chat) that is
-- emailed via the existing notifications trigger (unread_messages is in the
-- EMAILABLE map). Run in the Supabase SQL editor. Safe to re-run.
--
-- THROTTLE / ANTI-SPAM DESIGN (deliberately conservative — under-notify rather
-- than spam a live conversation):
--   1. Unread is measured against chat_reads.last_read_at (the per-(user,chat)
--      read cursor written by mark_chat_read). Messages the user sent are never
--      counted as unread against themselves.
--   2. We only fire when the NEWEST unread message is already >15 min old. That
--      means the chat has gone quiet for 15 min, so we never email mid-thread
--      while people are actively typing.
--   3. We only fire for recipients who are AWAY: auth.users.last_sign_in_at is
--      older than 1 hour (no recent fresh session). Someone who just signed in
--      would have seen the badge, so we skip them.
--   4. ONE nudge per unread batch: once we've notified about the current
--      unread messages we stay silent until a NEW message arrives after that
--      nudge — never a repeat reminder for the same unread state. On top of
--      that, max one nudge per (user, chat) per 4 hours.
-- Membership: vibe chats -> host + confirmed attendees; buddy chats -> both
-- sides of the match. chat_reads.chat_id spans both chat tables.

create or replace function public.send_unread_message_emails()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    with vibe_members as (
      -- host + every confirmed attendee is a member of the vibe's chat
      select vc.id as chat_id, v.id as vibe_id, v.title as vibe_title, mem.user_id as recipient
      from public.vibing_chats vc
      join public.vibes v on v.id = vc.vibe_id and v.status <> 'cancelled'
      join lateral (
        select v.host_id as user_id
        union
        select vi.user_id from public.vibe_interests vi
        where vi.vibe_id = v.id and vi.status = 'confirmed'
      ) mem on true
    ),
    buddy_members as (
      select bc.id as chat_id, mem.user_id as recipient
      from public.buddy_chats bc
      join public.buddy_matches bm on bm.id = bc.match_id
      join lateral (
        select bm.user_a as user_id union select bm.user_b
      ) mem on true
    ),
    vibe_unread as (
      select vm.recipient, vm.chat_id, vm.vibe_id, vm.vibe_title, true as is_vibe,
             count(*) as n_unread, max(msg.created_at) as latest_unread
      from vibe_members vm
      left join public.chat_reads cr on cr.user_id = vm.recipient and cr.chat_id = vm.chat_id
      join public.vibing_messages msg
        on msg.chat_id = vm.chat_id
       and msg.sender_id <> vm.recipient
       and msg.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
      group by vm.recipient, vm.chat_id, vm.vibe_id, vm.vibe_title
    ),
    buddy_unread as (
      select bm.recipient, bm.chat_id, null::uuid as vibe_id, null::text as vibe_title, false as is_vibe,
             count(*) as n_unread, max(msg.created_at) as latest_unread
      from buddy_members bm
      left join public.chat_reads cr on cr.user_id = bm.recipient and cr.chat_id = bm.chat_id
      join public.buddy_messages msg
        on msg.chat_id = bm.chat_id
       and msg.sender_id <> bm.recipient
       and msg.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
      group by bm.recipient, bm.chat_id
    ),
    all_unread as (
      select * from vibe_unread
      union all
      select * from buddy_unread
    )
    select au.recipient, au.chat_id, au.vibe_id, au.vibe_title, au.is_vibe, au.n_unread
    from all_unread au
    join auth.users u on u.id = au.recipient
    where au.latest_unread < now() - interval '15 minutes'          -- chat went quiet
      and u.last_sign_in_at < now() - interval '1 hour'             -- recipient is away
      -- ONE nudge per unread batch: if we already notified AFTER the newest
      -- unread message, everything unread has been announced — stay silent
      -- until something NEW arrives. (Prevents the every-4h repeat forever
      -- when the recipient simply never opens the chat.)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = au.recipient
          and n.type = 'unread_messages'
          and (n.data ->> 'chat_id') = au.chat_id::text
          and n.created_at > au.latest_unread
      )
      and not exists (                                             -- and never more than one per 4h
        select 1 from public.notifications n
        where n.user_id = au.recipient
          and n.type = 'unread_messages'
          and (n.data ->> 'chat_id') = au.chat_id::text
          and n.created_at > now() - interval '4 hours'
      )
  loop
    perform public.notify(
      r.recipient, 'unread_messages',
      case when r.is_vibe then 'New messages in ' || coalesce(r.vibe_title, 'your Vibe')
           else 'You have new messages' end,
      'You have ' || r.n_unread || ' unread message'
        || case when r.n_unread = 1 then '' else 's' end || ' waiting — jump back in.',
      jsonb_build_object(
        'chat_id', r.chat_id,
        'href', case when r.is_vibe then '/vibes/' || r.vibe_id || '/chat'
                     else '/buddies/' || r.chat_id end));
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-unread-messages'); exception when others then null; end $$;
select cron.schedule('flockie-unread-messages', '*/15 * * * *', $$ select public.send_unread_message_emails(); $$);
