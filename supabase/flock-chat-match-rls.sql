-- Fix: accepted Flock members who aren't in the buddy_match pair (i.e. anyone
-- beyond the host + first-accepted member) couldn't read the buddy_match row,
-- so /buddies/[chatId] failed to detect the Flock and fell back to a broken 1:1
-- view ("your", 0%, "Leave match"). buddy_chats/buddy_messages already allow
-- all members via is_buddy_chat_member; this brings buddy_matches in line.
-- Run in the Supabase SQL editor. Safe to re-run.

drop policy if exists "see own matches" on public.buddy_matches;
create policy "see own matches" on public.buddy_matches for select to authenticated
  using (
    auth.uid() = user_a
    or auth.uid() = user_b
    or exists (
      select 1 from public.trip_join_requests j
      where j.trip_id in (buddy_matches.trip_a, buddy_matches.trip_b)
        and j.user_id = auth.uid()
        and j.status = 'accepted'
    )
  );
