-- Flockie ranking + confirm + realtime. Run in Supabase SQL Editor. Safe to re-run.

-- SUPERSEDED: the live rank_vibe is the thin auth wrapper in
-- supabase/vibe-auto-matching.sql. This older direct-ranking copy is wrapped out
-- 2026-06-28 — repo-only, no DB change. (confirm_vibe below stays active.)
/*
-- ── rank_vibe: score interested candidates, invite up to capacity, standby rest
create or replace function public.rank_vibe(p_vibe uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v public.vibes;
  v_confirmed int;
  v_active int;
  v_remaining int;
  v_invited int := 0;
  v_standby int := 0;
  c record;
  rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can run matching'; end if;

  select count(*) into v_confirmed
    from public.vibe_interests where vibe_id = p_vibe and status = 'confirmed';
  select count(*) into v_active
    from public.vibe_interests
    where vibe_id = p_vibe
      and status = 'invited'
      and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);

  for c in
    select vi.user_id,
      (
        0.35 * (
          case when v.required_skill_level is null then 0.7
          else coalesce((
            select 1 - abs(((p.activity_skills ->> k)::int) - v.required_skill_level)::float / 4
            from jsonb_object_keys(coalesce(p.activity_skills, '{}'::jsonb)) k
            where lower(k) like '%' || lower(v.category) || '%'
            limit 1
          ), 0.3) end
        )
        + 0.30 * (
          case when array_length(v.event_vibe_tags, 1) is null then 0.5
          else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags, 1)
            from unnest(v.event_vibe_tags) t
            where exists (
              select 1 from unnest(coalesce(p.trip_vibe,'{}') || coalesce(p.activity_vibe,'{}')) uv
              where lower(uv) like '%' || lower(t) || '%'
            )
          ), 0.0) end
        )
        + 0.20 * (
          case when p.planning is null or h.planning is null then 0.5
          else 1 - (
            (abs(p.planning - h.planning) + abs(p.pace - h.pace)
             + abs(p.social_energy - h.social_energy) + abs(p.budget - h.budget)
             + abs(p.nightlife - h.nightlife) + abs(p.adventurousness - h.adventurousness)
            )::float / 24
          ) end
        )
        + 0.10 * 0.8
        + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id = p_vibe and vi.status = 'interested'
    order by score desc
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining and c.score >= 60 then
      update public.vibe_interests
        set status = 'invited', match_score = c.score,
            invitation_sent_at = now(), invitation_expires_at = now() + interval '24 hours'
        where vibe_id = p_vibe and user_id = c.user_id;
      insert into public.notifications (user_id, type, title, body, data)
        values (c.user_id, 'vibe_invitation', 'You''re invited to ' || v.title,
                'Confirm within 24 hours.', jsonb_build_object('vibe_id', p_vibe));
      v_invited := v_invited + 1;
    else
      update public.vibe_interests
        set status = 'standby', match_score = c.score
        where vibe_id = p_vibe and user_id = c.user_id;
      insert into public.notifications (user_id, type, title, body, data)
        values (c.user_id, 'vibe_standby', v.title || ' filled with a specific vibe',
                'Here are events that match yours better.', jsonb_build_object('vibe_id', p_vibe));
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status = 'ranking' where id = p_vibe;
  return jsonb_build_object('invited', v_invited, 'standby', v_standby);
end $$;

grant execute on function public.rank_vibe(uuid) to authenticated;
*/

-- ── confirm_vibe: an invited user accepts; opens chat + confirms
create or replace function public.confirm_vibe(p_vibe uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_updated int;
begin
  select * into v from public.vibes where id = p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  select count(*) into v_confirmed from public.vibe_interests where vibe_id = p_vibe and status = 'confirmed';
  if v_confirmed >= v.capacity then raise exception 'vibe is full'; end if;

  update public.vibe_interests
    set status = 'confirmed', confirmed_at = now()
    where vibe_id = p_vibe and user_id = auth.uid() and status = 'invited'
      and (invitation_expires_at is null or invitation_expires_at > now());
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'invitation required or expired'; end if;

  insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;

  insert into public.notifications (user_id, type, title, body, data)
    values (auth.uid(), 'vibe_confirmed', 'You''re in for ' || v.title,
            'Vibing Chat is now open.', jsonb_build_object('vibe_id', p_vibe));
end $$;

grant execute on function public.confirm_vibe(uuid) to authenticated;

-- ── realtime for notifications (for the unread badge)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
