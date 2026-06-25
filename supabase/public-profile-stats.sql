-- Public-profile social proof: counts across all cities (bypasses RLS for counts
-- only — no private details exposed). Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.public_profile_stats(p_user uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'vibes_hosted',
      (select count(*) from public.vibes where host_id = p_user),
    'vibes_attended',
      (select count(*) from public.vibe_interests where user_id = p_user and status = 'confirmed'),
    'activities_created',
      (select count(*) from public.trips where user_id = p_user and kind = 'activity'),
    'trips_created',
      (select count(*) from public.trips
        where user_id = p_user and kind = 'trip' and coalesce(visibility, 'private') <> 'public'),
    'flocks_created',
      (select count(*) from public.trips
        where user_id = p_user and kind = 'trip' and visibility = 'public'),
    'flocks_joined',
      (select count(*) from public.trip_join_requests jr
         join public.trips t on t.id = jr.trip_id
        where jr.user_id = p_user and jr.status = 'accepted' and t.visibility = 'public'),
    'buddies_matched',
      (select count(*) from public.buddy_matches where user_a = p_user or user_b = p_user)
  );
$$;
grant execute on function public.public_profile_stats(uuid) to authenticated;
