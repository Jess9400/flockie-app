-- ============================================================================
-- Flockie - the Trip Board: browse solo trips + flocks in one list, ask to
-- join with context. Mirrors the activity board. Run in the SQL editor.
-- Idempotent / safe to re-run.
-- ============================================================================

alter table public.trip_join_requests add column if not exists note text;

-- One browsable list: other people's active solo trips (1:1) and public
-- flocks with room. Trip-first cards; the creator is context.
create or replace function public.trip_board(p_limit int default 60)
returns table (
  trip_id uuid, kind text, destination text, destinations text[],
  start_date date, end_date date, group_size int, trip_type text[],
  budget int, description text, cover_photo text, continent text,
  group_gender text, language text,
  creator_id uuid, creator_name text, creator_age int, creator_photo text,
  trips_taken int, going int, score float8, my_request_status text
)
language sql security definer set search_path = public stable as $$
  select
    t.id,
    case when t.visibility = 'public' then 'flock' else 'trip' end,
    t.destination, t.destinations, t.start_date, t.end_date, t.group_size,
    t.trip_type, t.budget, t.description, t.cover_photo, t.continent,
    t.group_gender, t.language,
    p.id, p.display_name, p.age, p.photos[1],
    (select count(*)::int from public.trips pt
      where pt.user_id = p.id and pt.end_date < current_date
        and pt.status <> 'cancelled') as trips_taken,
    (1 + (select count(*)::int from public.trip_join_requests r
           where r.trip_id = t.id and r.status = 'accepted')) as going,
    public.buddy_pair_score(auth.uid(), p.id)::float8,
    (select r.status from public.trip_join_requests r
      where r.trip_id = t.id and r.user_id = auth.uid())
  from public.trips t
  join public.profiles p on p.id = t.user_id
  where t.kind = 'trip'
    and t.status = 'active'
    and t.end_date >= current_date
    and t.user_id <> auth.uid()
    and p.onboarding_complete
    and not public.buddy_hard_block(auth.uid(), p.id)
    -- room left (host + accepted < capacity)
    and (1 + (select count(*) from public.trip_join_requests r2
              where r2.trip_id = t.id and r2.status = 'accepted'))
        < coalesce(t.group_size, 99)
  order by t.start_date asc
  limit p_limit;
$$;
grant execute on function public.trip_board(int) to authenticated;

-- Ask to join (both kinds) with a personal note + traveler context for the
-- host. Accept/decline stays on the existing respond_join_request flow, which
-- already seeds the right chat (1:1 for private trips, group for flocks).
create or replace function public.request_join_trip_v2(p_trip uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.trips; me public.profiles; v_score int; v_trips int; v_new boolean;
begin
  select * into v from public.trips where id = p_trip;
  if v.id is null or v.kind <> 'trip' or v.status <> 'active' then
    raise exception 'not joinable';
  end if;
  if v.user_id = auth.uid() then raise exception 'own trip'; end if;
  if public.buddy_hard_block(auth.uid(), v.user_id) then
    raise exception 'blocked_by_preferences';
  end if;

  insert into public.trip_join_requests (trip_id, user_id, note)
  values (p_trip, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (trip_id, user_id) do update
    set status = 'pending', approvals = '{}', created_at = now(),
        note = excluded.note
    where trip_join_requests.status = 'declined'
  returning true into v_new;

  if v_new is null then return; end if;

  select * into me from public.profiles where id = auth.uid();
  v_score := round(public.buddy_pair_score(auth.uid(), v.user_id));
  select count(*)::int into v_trips from public.trips pt
    where pt.user_id = auth.uid() and pt.end_date < current_date
      and pt.status <> 'cancelled';

  perform public.notify(
    v.user_id, 'trip_join_request',
    coalesce(me.display_name, 'Someone') || ' wants to join your '
      || coalesce(v.destination, 'trip') || ' trip',
    concat_ws(' - ',
      nullif(concat_ws(', ',
        coalesce(me.display_name, 'Someone'),
        nullif(me.age::text, ''),
        nullif(me.home_city, '')
      ), ''),
      v_trips || ' past trips',
      v_score || '% match')
      || case when p_note is not null and btrim(p_note) <> ''
           then e'\n"' || left(btrim(p_note), 280) || '"' else '' end,
    jsonb_build_object('trip_id', p_trip, 'href', '/my-trips')
  );
end $$;
grant execute on function public.request_join_trip_v2(uuid, text) to authenticated;

NOTIFY pgrst, 'reload schema';
