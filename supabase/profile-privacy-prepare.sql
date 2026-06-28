-- Profile privacy preparation (phase 1 of 2).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Run this BEFORE merging/deploying the profile privacy PR. It is additive:
-- it creates the safe public_profiles view and privacy-aware RPCs without
-- changing the existing profiles SELECT policy.

alter table public.profiles
  add column if not exists social_visibility text not null default 'connections';
update public.profiles
set social_visibility = 'connections'
where social_visibility is null;
alter table public.profiles
  alter column social_visibility set default 'connections',
  alter column social_visibility set not null;
alter table public.profiles
  drop constraint if exists profiles_social_visibility_check;
alter table public.profiles
  add constraint profiles_social_visibility_check
  check (social_visibility in ('members', 'connections', 'private'));

create or replace function public.is_confirmed_profile_connection(
  p_viewer uuid,
  p_profile uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_viewer = auth.uid()
    and (
      p_viewer = p_profile
      or exists (
      select 1
      from public.buddy_matches m
      where (m.user_a = p_viewer and m.user_b = p_profile)
         or (m.user_a = p_profile and m.user_b = p_viewer)
      )
      or exists (
      select 1
      from public.vibes v
      where v.status <> 'cancelled'
        and (
          v.host_id = p_viewer
          or exists (
            select 1
            from public.vibe_interests viewer_interest
            where viewer_interest.vibe_id = v.id
              and viewer_interest.user_id = p_viewer
              and viewer_interest.status = 'confirmed'
          )
        )
        and (
          v.host_id = p_profile
          or exists (
            select 1
            from public.vibe_interests profile_interest
            where profile_interest.vibe_id = v.id
              and profile_interest.user_id = p_profile
              and profile_interest.status = 'confirmed'
          )
        )
      )
      or exists (
      select 1
      from public.trips t
      where t.kind = 'trip'
        and t.visibility = 'public'
        and t.status <> 'cancelled'
        and (
          t.user_id = p_viewer
          or exists (
            select 1
            from public.trip_join_requests viewer_request
            where viewer_request.trip_id = t.id
              and viewer_request.user_id = p_viewer
              and viewer_request.status = 'accepted'
          )
        )
        and (
          t.user_id = p_profile
          or exists (
            select 1
            from public.trip_join_requests profile_request
            where profile_request.trip_id = t.id
              and profile_request.user_id = p_profile
              and profile_request.status = 'accepted'
          )
        )
      )
    );
$$;

revoke all on function public.is_confirmed_profile_connection(uuid, uuid)
  from public, anon;
grant execute on function public.is_confirmed_profile_connection(uuid, uuid)
  to authenticated;

create or replace view public.public_profiles
with (security_barrier = true, security_invoker = false)
as
select
  p.id,
  p.display_name,
  p.age,
  p.home_city,
  p.photos,
  p.video_url,
  p.bio,
  p.one_liner,
  p.archetype,
  p.trip_vibe,
  p.activities,
  p.activity_vibe,
  case
    when p.id = auth.uid()
      or p.social_visibility = 'members'
      or (
        p.social_visibility = 'connections'
        and public.is_confirmed_profile_connection(auth.uid(), p.id)
      )
    then p.instagram
    else null
  end as instagram,
  case
    when p.id = auth.uid()
      or p.social_visibility = 'members'
      or (
        p.social_visibility = 'connections'
        and public.is_confirmed_profile_connection(auth.uid(), p.id)
      )
    then p.x_handle
    else null
  end as x_handle,
  case
    when p.id = auth.uid()
      or p.social_visibility = 'members'
      or (
        p.social_visibility = 'connections'
        and public.is_confirmed_profile_connection(auth.uid(), p.id)
      )
    then p.tiktok
    else null
  end as tiktok
from public.profiles p
where p.onboarding_complete or p.id = auth.uid();

revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to authenticated;

create or replace function public.public_profile_events(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean := auth.uid() = p_user;
  result jsonb;
begin
  result := jsonb_build_object(
    'is_owner', v_owner,
    'vibes', (
      select coalesce(jsonb_agg(x order by x.starts_at desc), '[]'::jsonb)
      from (
        select
          v.id,
          v.title,
          (v.photos)[1] as photo,
          v.starts_at,
          'host'::text as role,
          (coalesce(v.ends_at, v.starts_at) <= now()) as past,
          false as reviewed
        from public.vibes v
        where v.host_id = p_user
          and v.status <> 'cancelled'
          and (v_owner or coalesce(v.ends_at, v.starts_at) <= now())
        union all
        select
          v.id,
          v.title,
          (v.photos)[1] as photo,
          v.starts_at,
          'going'::text as role,
          (coalesce(v.ends_at, v.starts_at) <= now()) as past,
          case when v_owner then exists (
              select 1
              from public.vibe_reviews r
              where r.reviewer_id = p_user
                and r.vibe_id = v.id
            )
            else false
          end as reviewed
        from public.vibe_interests vi
        join public.vibes v on v.id = vi.vibe_id
        where vi.user_id = p_user
          and vi.status = 'confirmed'
          and v.host_id <> p_user
          and v.status <> 'cancelled'
          and (v_owner or coalesce(v.ends_at, v.starts_at) <= now())
      ) x
    ),
    'flocks', (
      select coalesce(jsonb_agg(x order by x.end_date desc), '[]'::jsonb)
      from (
        select
          t.id,
          coalesce(t.destination, (t.destinations)[1]) as destination,
          t.cover_photo as photo,
          t.start_date,
          t.end_date,
          'host'::text as role,
          (t.end_date < current_date) as past
        from public.trips t
        where t.user_id = p_user
          and t.kind = 'trip'
          and t.visibility = 'public'
          and t.status <> 'cancelled'
          and (v_owner or t.end_date < current_date)
        union all
        select
          t.id,
          coalesce(t.destination, (t.destinations)[1]) as destination,
          t.cover_photo as photo,
          t.start_date,
          t.end_date,
          'going'::text as role,
          (t.end_date < current_date) as past
        from public.trip_join_requests jr
        join public.trips t on t.id = jr.trip_id
        where jr.user_id = p_user
          and jr.status = 'accepted'
          and t.visibility = 'public'
          and t.status <> 'cancelled'
          and (v_owner or t.end_date < current_date)
      ) x
    )
  );

  if v_owner then
    result := result || jsonb_build_object(
      'activities', (
        select coalesce(jsonb_agg(x order by x.end_date desc), '[]'::jsonb)
        from (
          select
            t.id,
            coalesce(t.title, t.destination) as title,
            t.cover_photo as photo,
            t.start_date,
            t.end_date,
            (t.end_date < current_date) as past
          from public.trips t
          where t.user_id = p_user
            and t.kind = 'activity'
            and t.status <> 'cancelled'
        ) x
      ),
      'trips', (
        select coalesce(jsonb_agg(x order by x.end_date desc), '[]'::jsonb)
        from (
          select
            t.id,
            coalesce(t.destination, (t.destinations)[1]) as destination,
            t.cover_photo as photo,
            t.start_date,
            t.end_date,
            (t.end_date < current_date) as past
          from public.trips t
          where t.user_id = p_user
            and t.kind = 'trip'
            and coalesce(t.visibility, 'private') <> 'public'
            and t.status <> 'cancelled'
        ) x
      )
    );
  end if;

  return result;
end;
$$;
grant execute on function public.public_profile_events(uuid) to authenticated;

create or replace function public.public_profile_stats(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean := auth.uid() = p_user;
begin
  return jsonb_build_object(
    'vibes_hosted',
      (
        select count(*)
        from public.vibes
        where host_id = p_user
          and status <> 'cancelled'
          and (
            v_owner
            or coalesce(ends_at, starts_at) <= now()
          )
      ),
    'vibes_attended',
      (
        select count(*)
        from public.vibe_interests vi
        join public.vibes v on v.id = vi.vibe_id
        where vi.user_id = p_user
          and vi.status = 'confirmed'
          and v.status <> 'cancelled'
          and (
            v_owner
            or coalesce(v.ends_at, v.starts_at) <= now()
          )
      ),
    'activities_created',
      case when v_owner then (
        select count(*)
        from public.trips
        where user_id = p_user
          and kind = 'activity'
      ) else 0 end,
    'trips_created',
      case when v_owner then (
        select count(*)
        from public.trips
        where user_id = p_user
          and kind = 'trip'
          and coalesce(visibility, 'private') <> 'public'
      ) else 0 end,
    'flocks_created',
      (
        select count(*)
        from public.trips
        where user_id = p_user
          and kind = 'trip'
          and visibility = 'public'
          and (
            v_owner
            or end_date < current_date
          )
      ),
    'flocks_joined',
      (
        select count(*)
        from public.trip_join_requests jr
        join public.trips t on t.id = jr.trip_id
        where jr.user_id = p_user
          and jr.status = 'accepted'
          and t.visibility = 'public'
          and t.status <> 'cancelled'
          and (
            v_owner
            or t.end_date < current_date
          )
      ),
    'buddies_matched',
      case when v_owner then (
        select count(*)
        from public.buddy_matches
        where user_a = p_user or user_b = p_user
      ) else 0 end
  );
end;
$$;
grant execute on function public.public_profile_stats(uuid) to authenticated;
