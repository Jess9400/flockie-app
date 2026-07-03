-- "Your Vibe is tomorrow" reminder. Hourly pg_cron: for each upcoming Vibe that
-- starts in ~20-28h, notify every CONFIRMED attendee once, then stamp the Vibe
-- so it never fires again. The wide 20-28h window guarantees at least one hourly
-- tick lands inside it; the `starting_soon_reminded_at` stamp guarantees exactly
-- one reminder per Vibe. Emailed via the existing notifications trigger
-- (vibe_starting_soon is in the EMAILABLE map). Run in the Supabase SQL editor.
-- Safe to re-run.

alter table public.vibes add column if not exists starting_soon_reminded_at timestamptz;

create or replace function public.send_vibe_tomorrow_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare r record; m record;
begin
  for r in
    select * from public.vibes
    where starting_soon_reminded_at is null
      and status <> 'cancelled'
      and starts_at >= now() + interval '20 hours'
      and starts_at <= now() + interval '28 hours'
  loop
    for m in
      select user_id from public.vibe_interests
      where vibe_id = r.id and status = 'confirmed'
    loop
      perform public.notify(
        m.user_id, 'vibe_starting_soon',
        'Your Vibe is tomorrow: ' || r.title,
        'It kicks off soon — open the chat to coordinate with your group.',
        jsonb_build_object('vibe_id', r.id, 'href', '/vibes/' || r.id || '/chat'));
    end loop;
    update public.vibes set starting_soon_reminded_at = now() where id = r.id;
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-vibe-tomorrow'); exception when others then null; end $$;
select cron.schedule('flockie-vibe-tomorrow', '0 * * * *', $$ select public.send_vibe_tomorrow_reminders(); $$);
