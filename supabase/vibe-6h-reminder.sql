-- 6-hour "final reminder" with the address again + a Google Maps link. Runs
-- every 30 min via pg_cron: for each upcoming Vibe starting in ~5.5–6.5h, notify
-- every CONFIRMED attendee once, then stamp the Vibe so it never fires again.
-- The 1h window with a 30-min cadence guarantees at least one tick lands inside
-- it; `final_reminded_at` guarantees exactly one reminder per Vibe.
--
-- The email body (address + map link) is assembled by the notify route, which
-- enriches `vibe_final_reminder` with location + coordinates (confirmed-only, so
-- the exact venue is fine). Run in the Supabase SQL editor. Safe to re-run.

alter table public.vibes add column if not exists final_reminded_at timestamptz;

create or replace function public.send_vibe_6h_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare r record; m record;
begin
  for r in
    select * from public.vibes
    where final_reminded_at is null
      and status <> 'cancelled'
      and starts_at >= now() + interval '5 hours 30 minutes'
      and starts_at <= now() + interval '6 hours 30 minutes'
  loop
    for m in
      select user_id from public.vibe_interests
      where vibe_id = r.id and status = 'confirmed'
    loop
      perform public.notify(
        m.user_id, 'vibe_final_reminder',
        'Your Vibe starts soon: ' || r.title,
        'It starts in a few hours - here''s the address and directions.',
        jsonb_build_object('vibe_id', r.id, 'href', '/vibes/' || r.id || '/chat'));
    end loop;
    update public.vibes set final_reminded_at = now() where id = r.id;
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-vibe-6h'); exception when others then null; end $$;
select cron.schedule('flockie-vibe-6h', '*/30 * * * *', $$ select public.send_vibe_6h_reminders(); $$);
