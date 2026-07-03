-- Targeted Chat and Inbox latency indexes.
-- Run in the Supabase SQL editor after deployment. Safe to re-run.
--
-- These match the app's existing read shapes:
--   * latest messages filtered by chat_id and ordered by created_at desc
--   * unread notification counts filtered by user_id with both timestamps null
-- They do not change query results, RLS, functions, or application behavior.

create index if not exists buddy_messages_chat_created_idx
  on public.buddy_messages (chat_id, created_at desc);

create index if not exists vibing_messages_chat_created_idx
  on public.vibing_messages (chat_id, created_at desc);

create index if not exists notifications_unread_user_idx
  on public.notifications (user_id)
  where read_at is null and dismissed_at is null;
