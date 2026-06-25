-- Public-profile event lists: the vibes & flocks a person hosts/joins (public),
-- plus their activities & private trips when they view their own profile.
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.public_profile_events(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_owner boolean := (auth.uid() = p_user);
declare result jsonb;
begin
  result := jsonb_build_object(
    'is_owner', v_owner,
    'vibes', (
      select coalesce(jsonb_agg(x order by x.starts_at desc), '[]'::jsonb) from (
        select v.id, v.title, (v.photos)[1] as photo, v.starts_at,
               'host'::text as role, (coalesce(v.ends_at, v.starts_at) <= now()) as past
        from public.vibes v
        where v.host_id = p_user and v.status <> 'cancelled'
        union all
        select v.id, v.title, (v.photos)[1] as photo, v.starts_at,
               'going'::text as role, (coalesce(v.ends_at, v.starts_at) <= now()) as past
        from public.vibe_interests vi
        join public.vibes v on v.id = vi.vibe_id
        where vi.user_id = p_user and vi.status = 'confirmed'
          and v.host_id <> p_user and v.status <> 'cancelled'
      ) x
    ),
    'flocks', (
      select coalesce(jsonb_agg(x order by x.end_date desc), '[]'::jsonb) from (
        select t.id, coalesce(t.destination, (t.destinations)[1]) as destination, t.cover_photo as photo,
               t.start_date, t.end_date, 'host'::text as role, (t.end_date < current_date) as past
        from public.trips t
        where t.user_id = p_user and t.kind = 'trip' and t.visibility = 'public' and t.status <> 'cancelled'
        union all
        select t.id, coalesce(t.destination, (t.destinations)[1]) as destination, t.cover_photo as photo,
               t.start_date, t.end_date, 'going'::text as role, (t.end_date < current_date) as past
        from public.trip_join_requests jr
        join public.trips t on t.id = jr.trip_id
        where jr.user_id = p_user and jr.status = 'accepted' and t.visibility = 'public'
      ) x
    )
  );

  if v_owner then
    result := result || jsonb_build_object(
      'activities', (
        select coalesce(jsonb_agg(x order by x.end_date desc), '[]'::jsonb) from (
          select t.id, coalesce(t.title, t.destination) as title, t.cover_photo as photo,
                 t.start_date, t.end_date, (t.end_date < current_date) as past
          from public.trips t
          where t.user_id = p_user and t.kind = 'activity' and t.status <> 'cancelled'
        ) x
      ),
      'trips', (
        select coalesce(jsonb_agg(x order by x.end_date desc), '[]'::jsonb) from (
          select t.id, coalesce(t.destination, (t.destinations)[1]) as destination, t.cover_photo as photo,
                 t.start_date, t.end_date, (t.end_date < current_date) as past
          from public.trips t
          where t.user_id = p_user and t.kind = 'trip'
            and coalesce(t.visibility, 'private') <> 'public' and t.status <> 'cancelled'
        ) x
      )
    );
  end if;

  return result;
end $$;
grant execute on function public.public_profile_events(uuid) to authenticated;
