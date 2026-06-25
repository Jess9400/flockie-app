-- After an event ends, remind people to review: the Vibe (event) for vibes, and
-- the people you went with for trips/activities/flocks. Hourly pg_cron, once per
-- event. Run in the Supabase SQL editor. Safe to re-run.

alter table public.trips add column if not exists review_reminded_at timestamptz;
alter table public.vibes add column if not exists review_reminded_at timestamptz;

create or replace function public.send_review_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare r record; m record;
begin
  -- VIBES → remind confirmed attendees to review the event.
  for r in
    select * from public.vibes
    where review_reminded_at is null and status <> 'cancelled'
      and coalesce(ends_at, starts_at) <= now()
      and coalesce(ends_at, starts_at) >= now() - interval '14 days'
  loop
    for m in select user_id from public.vibe_interests where vibe_id = r.id and status = 'confirmed' loop
      perform public.notify(m.user_id, 'vibe_review_reminder', 'How was ' || r.title || '?',
        'Leave a quick review of the Vibe.',
        jsonb_build_object('vibe_id', r.id, 'href', '/vibes/' || r.id || '/review'));
    end loop;
    update public.vibes set review_reminded_at = now() where id = r.id;
  end loop;

  -- TRIPS / ACTIVITIES / FLOCKS → remind participants to review each person.
  for r in
    select * from public.trips
    where review_reminded_at is null and status <> 'cancelled'
      and end_date <= current_date and end_date >= current_date - 14
  loop
    if r.visibility = 'public' and r.kind = 'trip' then
      -- Flock: host + accepted members → the per-person review picker.
      for m in
        select user_id from public.trip_join_requests where trip_id = r.id and status = 'accepted'
        union select r.user_id as user_id
      loop
        perform public.notify(m.user_id, 'buddy_review_reminder',
          'How was ' || coalesce(r.destination, 'your flock') || '?',
          'Rate each person you flocked with.',
          jsonb_build_object('trip_id', r.id, 'href', '/flocks/' || r.id || '/review'));
      end loop;
    else
      -- 1:1 trip / activity: each side reviews the other.
      for m in select user_a, user_b from public.buddy_matches where trip_a = r.id loop
        perform public.notify(m.user_a, 'buddy_review_reminder', 'How was your trip?',
          'Rate your travel buddy.', jsonb_build_object('href', '/review/' || m.user_b));
        perform public.notify(m.user_b, 'buddy_review_reminder', 'How was your trip?',
          'Rate your travel buddy.', jsonb_build_object('href', '/review/' || m.user_a));
      end loop;
    end if;
    update public.trips set review_reminded_at = now() where id = r.id;
  end loop;
end $$;

do $$ begin perform cron.unschedule('flockie-review-reminders'); exception when others then null; end $$;
select cron.schedule('flockie-review-reminders', '0 * * * *', $$ select public.send_review_reminders(); $$);
