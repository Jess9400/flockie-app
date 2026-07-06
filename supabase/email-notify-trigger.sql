-- Email pipeline trigger (replaces the Supabase Webhooks UI, which needs the
-- supabase_functions schema this project doesn't have). Requires the pg_net
-- extension (Database → Extensions → enable "pg_net").
--
-- On every notifications INSERT, POSTs the row to the Vercel email route, which
-- decides whether to send a Tier-1 transactional email.
--
-- ⚠️ Replace <EMAIL_WEBHOOK_SECRET> with the SAME value set in Vercel before
-- running. Safe to re-run.

create or replace function public.email_notify_hook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://app.findflockie.com/api/email/notify',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', '<EMAIL_WEBHOOK_SECRET>'
               ),
    body    := jsonb_build_object('type', 'INSERT', 'record', to_jsonb(NEW)),
    -- 15s (default is 5s): a burst of inserts cold-starts the serverless function,
    -- and 5s wasn't enough — timed-out POSTs dropped the email.
    timeout_milliseconds := 15000
  );
  return NEW;
end $$;

drop trigger if exists notifications_email_hook on public.notifications;
create trigger notifications_email_hook
  after insert on public.notifications
  for each row execute function public.email_notify_hook();
