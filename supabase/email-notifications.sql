-- Email notification preference + one-click unsubscribe token. Run in the
-- Supabase SQL editor. Safe to re-run.
alter table public.profiles
  add column if not exists email_notifications boolean not null default true,
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid();

-- Unsubscribe links look up by token.
create index if not exists profiles_email_unsub_idx
  on public.profiles (email_unsubscribe_token);
