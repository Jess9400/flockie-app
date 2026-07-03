-- Weekly "Vibes near you" digest (Tier-3, opt-outable). Once a week, for each
-- eligible user, pick their top upcoming Vibes this week and insert ONE
-- `weekly_digest` notification, emailed via the existing notifications trigger
-- (weekly_digest is in the EMAILABLE map). Run in the Supabase SQL editor.
-- Safe to re-run.
--
-- OPT-OUT: there is no separate marketing-consent flag in `profiles` today, so
-- we gate on the two existing switches:
--   * email_notifications  — the email opt-out honoured by /api/email/notify.
--   * notifications_enabled — the master in-app switch enforced by notify().
-- Users with EITHER turned off get neither the in-app card nor the email. When a
-- dedicated marketing opt-in is added later, AND it into the WHERE below.
--
-- ONE email per user per week: the weekly cadence plus a 6-day NOT EXISTS guard
-- (so a manual re-run within the week can't double-send).

create or replace function public.send_weekly_digest()
returns void language plpgsql security definer set search_path = public as $$
declare u record; titles text[]; n int;
begin
  for u in
    select p.id, p.home_city
    from public.profiles p
    join auth.users au on au.id = p.id
    where coalesce(p.email_notifications, true)
      and coalesce(p.notifications_enabled, true)
      and p.home_city is not null
      and au.email is not null
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'weekly_digest'
          and n.created_at > now() - interval '6 days'
      )
  loop
    -- Top upcoming open Vibes in the user's city this week that they don't host,
    -- haven't engaged with, and aren't excluded from — ranked by vibe_match.
    -- (Mirrors recommended_vibes(), but keyed to u.id instead of auth.uid().)
    select array_agg(t.title order by t.rn), max(t.rn)
      into titles, n
    from (
      select v.title,
             row_number() over (order by public.vibe_match(u.id, v.id) desc nulls last, v.starts_at asc) as rn
      from public.vibes v
      where v.status = 'open'
        and v.starts_at > now()
        and v.starts_at < now() + interval '7 days'
        and v.host_id <> u.id
        and lower(v.city) = lower(u.home_city)
        and not exists (
          select 1 from public.vibe_interests vi where vi.vibe_id = v.id and vi.user_id = u.id
        )
        and not exists (
          select 1 from public.vibe_feedback vf
          where vf.vibe_id = v.id and vf.user_id = u.id and vf.signal = 'not_for_me'
        )
        and public.vibe_eligible(u.id, v.id)
      order by public.vibe_match(u.id, v.id) desc nulls last, v.starts_at asc
      limit 3
    ) t;

    if n is not null and n > 0 then
      perform public.notify(
        u.id, 'weekly_digest',
        n || ' Vibe' || case when n = 1 then '' else 's' end
          || ' in ' || u.home_city || ' this week',
        'Picked for you: ' || array_to_string(titles, ', ') || '.',
        jsonb_build_object('href', '/vibes', 'count', n));
    end if;
  end loop;
end $$;

-- Thursdays 15:00 UTC (late-morning US / evening EU — a "plan your week" nudge).
do $$ begin perform cron.unschedule('flockie-weekly-digest'); exception when others then null; end $$;
select cron.schedule('flockie-weekly-digest', '0 15 * * 4', $$ select public.send_weekly_digest(); $$);
