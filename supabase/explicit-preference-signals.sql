-- Flockie - explicit preference signals, shadow mode.
-- Run after clubs-foundation.sql and activity-join-requests.sql. Then re-run
-- expiry.sql so decline_vibe writes the new timestamp column.
-- This file records and summarizes deliberate behavior for analysis only.
-- It does not change matching, ranking, recommendations, or displayed scores.

-- A confirmed RSVP does not prove attendance. For ordinary completed Vibes,
-- the host can record who actually attended. Club gatherings keep using the
-- existing club_attendance table and its host flow.
create table if not exists public.vibe_attendance (
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete cascade,
  attended_at timestamptz not null default now(),
  primary key (vibe_id, user_id)
);
create index if not exists vibe_attendance_user_idx
  on public.vibe_attendance (user_id, attended_at desc);

alter table public.vibe_attendance enable row level security;
drop policy if exists "vibe attendance own or host read" on public.vibe_attendance;
create policy "vibe attendance own or host read" on public.vibe_attendance
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.vibes v
      where v.id = vibe_id and v.host_id = auth.uid()
    )
  );

create or replace function public.record_vibe_attendance(p_vibe uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.vibes
    where id = p_vibe
      and host_id = auth.uid()
      and club_id is null
      and status <> 'cancelled'
      and coalesce(ends_at, starts_at) <= now()
  ) then
    raise exception 'attendance can only be recorded by the host after a completed non-club vibe';
  end if;

  if not exists (
    select 1 from public.vibe_interests
    where vibe_id = p_vibe and user_id = p_user and status = 'confirmed'
  ) then
    raise exception 'only confirmed vibe participants can be recorded as attendees';
  end if;

  insert into public.vibe_attendance (vibe_id, user_id, recorded_by)
  values (p_vibe, p_user, auth.uid())
  on conflict (vibe_id, user_id) do nothing;
end;
$$;
revoke all on function public.record_vibe_attendance(uuid, uuid) from public, anon;
grant execute on function public.record_vibe_attendance(uuid, uuid) to authenticated;

-- Timestamp user-initiated declines so invitation rejection can be separated
-- from host removal or a person leaving after they had already confirmed.
alter table public.vibe_interests add column if not exists declined_at timestamptz;
create index if not exists vibe_interests_user_invite_declined_idx
  on public.vibe_interests (user_id, declined_at desc)
  where invitation_sent_at is not null and declined_at is not null;

-- This is a private, SQL-editor-only ledger for analysis. Each row is a real
-- action or host-verified outcome. Nothing here is a score or a recommendation.
create or replace view public.preference_signal_events as
  select
    va.user_id,
    'vibe_attended'::text as signal_type,
    'verified'::text as evidence_level,
    'vibe'::text as object_type,
    va.vibe_id as object_id,
    v.category,
    coalesce(v.event_vibe_tags, '{}'::text[]) as tags,
    va.attended_at as occurred_at,
    jsonb_build_object('source', 'host_recorded_vibe_attendance') as metadata
  from public.vibe_attendance va
  join public.vibes v on v.id = va.vibe_id

  union all

  select
    ca.user_id,
    'vibe_attended'::text,
    'verified'::text,
    'vibe'::text,
    ca.vibe_id,
    v.category,
    coalesce(v.event_vibe_tags, '{}'::text[]),
    ca.attended_at,
    jsonb_build_object('source', 'club_attendance')
  from public.club_attendance ca
  join public.vibes v on v.id = ca.vibe_id

  union all

  select
    pl.user_id,
    'liked_post'::text,
    'explicit'::text,
    ('post:' || p.kind)::text,
    p.id,
    coalesce(v.category, c.category, 'activity'),
    coalesce(v.event_vibe_tags, t.trip_type, '{}'::text[]),
    pl.created_at,
    jsonb_build_object('post_id', p.id, 'anchor_id', coalesce(p.vibe_id, p.club_id, p.activity_id))
  from public.post_likes pl
  join public.posts p on p.id = pl.post_id
  left join public.vibes v on v.id = p.vibe_id
  left join public.clubs c on c.id = p.club_id
  left join public.trips t on t.id = p.activity_id

  union all

  select
    cm.user_id,
    'club_belonging'::text,
    'explicit'::text,
    'club'::text,
    c.id,
    c.category,
    '{}'::text[],
    coalesce(cm.regular_since, cm.joined_at, cm.updated_at),
    jsonb_build_object('membership_status', cm.status)
  from public.club_memberships cm
  join public.clubs c on c.id = cm.club_id
  where cm.status in ('founding', 'regular')

  union all

  select
    t.user_id,
    'activity_created'::text,
    'explicit'::text,
    'activity'::text,
    t.id,
    'activity'::text,
    coalesce(t.trip_type, '{}'::text[]),
    t.created_at,
    jsonb_build_object('status', t.status)
  from public.trips t
  where t.kind = 'activity'

  union all

  select
    r.user_id,
    'activity_joined'::text,
    'explicit'::text,
    'activity'::text,
    t.id,
    'activity'::text,
    coalesce(t.trip_type, '{}'::text[]),
    r.accepted_at,
    jsonb_build_object('requested_at', r.created_at)
  from public.activity_join_requests r
  join public.trips t on t.id = r.activity_id
  where r.status = 'accepted' and r.accepted_at is not null

  union all

  select
    vi.user_id,
    'invitation_rejected'::text,
    'explicit_negative'::text,
    'vibe'::text,
    vi.vibe_id,
    v.category,
    coalesce(v.event_vibe_tags, '{}'::text[]),
    vi.declined_at,
    jsonb_build_object('invited_at', vi.invitation_sent_at)
  from public.vibe_interests vi
  join public.vibes v on v.id = vi.vibe_id
  where vi.status = 'declined'
    and vi.invitation_sent_at is not null
    and vi.confirmed_at is null
    and vi.declined_at is not null;

revoke all on table public.preference_signal_events from public, anon, authenticated;

create or replace view public.preference_signal_user_summary as
select
  user_id,
  count(*) filter (where signal_type = 'vibe_attended')::int as vibes_attended,
  count(*) filter (where signal_type = 'liked_post')::int as posts_liked,
  count(*) filter (where signal_type = 'club_belonging')::int as active_clubs,
  count(*) filter (where signal_type = 'activity_created')::int as activities_created,
  count(*) filter (where signal_type = 'activity_joined')::int as activities_joined,
  count(*) filter (where signal_type = 'invitation_rejected')::int as invitations_rejected,
  max(occurred_at) as last_signal_at
from public.preference_signal_events
group by user_id;

revoke all on table public.preference_signal_user_summary from public, anon, authenticated;
