-- Keep notification history while allowing users to dismiss cards from Inbox.
alter table public.notifications
  add column if not exists dismissed_at timestamptz;

create index if not exists notifications_active_user_idx
  on public.notifications (user_id, dismissed_at, created_at desc);
