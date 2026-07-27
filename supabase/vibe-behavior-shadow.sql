-- Passive Vibe behavior signals for offline matching analysis.
-- Shadow mode only: no live ranking or displayed percentage reads this table.
-- Safe to re-run after the PR is merged.

create table if not exists public.vibe_behavior_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'card_impression',
      'detail_open',
      'detail_dwell_10s',
      'detail_dwell_30s'
    )
  ),
  source text not null check (source in ('home', 'browse', 'detail')),
  event_date date not null default (timezone('utc', now()))::date,
  occurrences smallint not null default 1 check (occurrences between 1 and 20),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, vibe_id, event_type, source, event_date)
);

create index if not exists vibe_behavior_events_user_recent_idx
  on public.vibe_behavior_events (user_id, last_seen_at desc);

create index if not exists vibe_behavior_events_vibe_event_recent_idx
  on public.vibe_behavior_events (vibe_id, event_type, last_seen_at desc);

alter table public.vibe_behavior_events enable row level security;

-- The app writes through record_vibe_behavior only. Users cannot read the raw
-- event history or submit events for another account.
revoke all on table public.vibe_behavior_events from public, anon, authenticated;

create or replace function public.record_vibe_behavior(
  p_vibe uuid,
  p_event text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_event not in (
    'card_impression',
    'detail_open',
    'detail_dwell_10s',
    'detail_dwell_30s'
  ) then
    raise exception 'unsupported behavior event' using errcode = '22023';
  end if;

  if p_source not in ('home', 'browse', 'detail') then
    raise exception 'unsupported behavior source' using errcode = '22023';
  end if;

  -- Host views are management activity, not preference evidence.
  if exists (
    select 1
    from public.vibes v
    where v.id = p_vibe
      and v.host_id = viewer_id
  ) then
    return;
  end if;

  insert into public.vibe_behavior_events (
    user_id,
    vibe_id,
    event_type,
    source
  )
  values (
    viewer_id,
    p_vibe,
    p_event,
    p_source
  )
  on conflict (user_id, vibe_id, event_type, source, event_date)
  do update set
    occurrences = least(20, public.vibe_behavior_events.occurrences + 1),
    last_seen_at = now();
end;
$$;

revoke all on function public.record_vibe_behavior(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_vibe_behavior(uuid, text, text)
  to authenticated;

create or replace function public.purge_old_vibe_behavior_events()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count bigint;
begin
  delete from public.vibe_behavior_events
  where last_seen_at < now() - interval '180 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_vibe_behavior_events()
  from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('flockie-vibe-behavior-retention');
exception
  when others then null;
end
$$;

select cron.schedule(
  'flockie-vibe-behavior-retention',
  '17 3 * * *',
  $$ select public.purge_old_vibe_behavior_events(); $$
);
