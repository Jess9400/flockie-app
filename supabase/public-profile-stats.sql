-- Public-profile social proof. Private-plan and buddy-match counts are owner-only.
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.public_profile_stats(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_owner boolean := (auth.uid() = p_user);
begin
  return jsonb_build_object(
    'vibes_hosted',
      (select count(*) from public.vibes
        where host_id = p_user
          and status <> 'cancelled'
          and (v_owner or coalesce(ends_at, starts_at) <= now())),
    'vibes_attended',
      (select count(*) from public.vibe_interests vi
        join public.vibes v on v.id = vi.vibe_id
        where vi.user_id = p_user
          and vi.status = 'confirmed'
          and v.status <> 'cancelled'
          and (v_owner or coalesce(v.ends_at, v.starts_at) <= now())),
    'activities_created',
      case when v_owner then
        (select count(*) from public.trips where user_id = p_user and kind = 'activity')
      else 0 end,
    'trips_created',
      case when v_owner then
        (select count(*) from public.trips
          where user_id = p_user and kind = 'trip' and coalesce(visibility, 'private') <> 'public')
      else 0 end,
    'flocks_created',
      (select count(*) from public.trips
        where user_id = p_user and kind = 'trip' and visibility = 'public'
          and (v_owner or end_date < current_date)),
    'flocks_joined',
      (select count(*) from public.trip_join_requests jr
         join public.trips t on t.id = jr.trip_id
        where jr.user_id = p_user and jr.status = 'accepted'
          and t.visibility = 'public'
          and t.status <> 'cancelled'
          and (v_owner or t.end_date < current_date)),
    'buddies_matched',
      case when v_owner then
        (select count(*) from public.buddy_matches where user_a = p_user or user_b = p_user)
      else 0 end
  );
end;
$$;
grant execute on function public.public_profile_stats(uuid) to authenticated;
