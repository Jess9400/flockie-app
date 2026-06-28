-- Vibe Matching v2: pre-invite host preview + reject (≤25%).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- New flow:  open → (matching runs) → REVIEWING (host sees ranked shortlist,
-- can reject up to 25%, then sends) → ranking (invites out) → ...
-- This is PRE-invite only and coexists with the post-invite removal feature.
-- Also drops the old >=60 score floor (everyone can be ranked for now).

alter table public.vibes
  add column if not exists shortlisted_at timestamptz,
  add column if not exists preview_rejects_used int not null default 0;

-- SUPERSEDED: canonical _rank_vibe_core is in supabase/vibe-v2-private-link.sql
-- (the live version; this copy lacks the source<>'private' filter). Wrapped out
-- 2026-06-28 — repo-only, no DB change.
/*
-- ── Matching now produces a SHORTLIST for host review (no invites yet) ───────
create or replace function public._rank_vibe_core(p_vibe uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_confirmed int; v_active int; v_remaining int; v_shortlisted int := 0; v_standby int := 0; c record; rnk int := 0;
begin
  select * into v from public.vibes where id = p_vibe;
  if v.id is null or v.status = 'cancelled' then return jsonb_build_object('shortlisted',0,'standby',0); end if;

  select count(*) into v_confirmed from public.vibe_interests where vibe_id=p_vibe and status='confirmed';
  select count(*) into v_active from public.vibe_interests
    where vibe_id=p_vibe and status in ('invited','shortlisted')
      and (invitation_expires_at is null or invitation_expires_at > now());
  v_remaining := greatest(v.capacity - v_confirmed - v_active, 0);

  for c in
    select vi.user_id,
      ( 0.35 * (case when v.required_skill_level is null then 0.7 else coalesce((
            select 1 - abs(((p.activity_skills ->> k)::int) - v.required_skill_level)::float / 4
            from jsonb_object_keys(coalesce(p.activity_skills,'{}'::jsonb)) k
            where lower(k) like '%'||lower(v.category)||'%' limit 1), 0.3) end)
      + 0.30 * (case when array_length(v.event_vibe_tags,1) is null then 0.5 else coalesce((
            select count(*)::float / array_length(v.event_vibe_tags,1) from unnest(v.event_vibe_tags) t
            where exists (select 1 from unnest(coalesce(p.trip_vibe,'{}')||coalesce(p.activity_vibe,'{}')) uv
                          where lower(uv) like '%'||lower(t)||'%')), 0.0) end)
      + 0.20 * (case when p.planning is null or h.planning is null then 0.5 else 1 - (
            (abs(p.planning-h.planning)+abs(p.pace-h.pace)+abs(p.social_energy-h.social_energy)
            +abs(p.budget-h.budget)+abs(p.nightlife-h.nightlife)+abs(p.adventurousness-h.adventurousness))::float/24) end)
      + 0.10 * public.vibe_review_fit(vi.user_id, p_vibe)
      + 0.05 * (case when v.diversity_floor_enabled then random() else 0 end)
      ) * 100 as score
    from public.vibe_interests vi
    join public.profiles p on p.id = vi.user_id
    left join public.profiles h on h.id = v.host_id
    where vi.vibe_id=p_vibe and vi.status='interested'
    order by score desc
  loop
    rnk := rnk + 1;
    if rnk <= v_remaining then            -- 60-score floor dropped
      update public.vibe_interests set status='shortlisted', match_score=c.score
        where vibe_id=p_vibe and user_id=c.user_id;
      v_shortlisted := v_shortlisted + 1;
    else
      update public.vibe_interests set status='standby', match_score=c.score
        where vibe_id=p_vibe and user_id=c.user_id;
      v_standby := v_standby + 1;
    end if;
  end loop;

  update public.vibes set status='reviewing', shortlisted_at=now(), preview_rejects_used=0
    where id=p_vibe and status <> 'cancelled';
  perform public.notify(v.host_id, 'vibe_review_ready', 'Your matched list for '||v.title||' is ready',
          'Review it — remove up to a few before invites go out, or send them now.',
          jsonb_build_object('vibe_id', p_vibe));
  return jsonb_build_object('shortlisted', v_shortlisted, 'standby', v_standby);
end $$;
grant execute on function public._rank_vibe_core(uuid) to authenticated;
*/

-- ── Host rejects someone from the shortlist (≤25% of capacity), re-ranks ────
create or replace function public.host_reject_shortlisted(p_vibe uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_cap int; v_next uuid;
begin
  select * into v from public.vibes where id=p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can review the list'; end if;
  if v.status <> 'reviewing' then raise exception 'the list is not open for review'; end if;

  select status into v_status from public.vibe_interests where vibe_id=p_vibe and user_id=p_user;
  if v_status is null or v_status <> 'shortlisted' then raise exception 'that person is not on the shortlist'; end if;

  v_cap := greatest(1, floor(v.capacity * 0.25)::int);
  if v.preview_rejects_used >= v_cap then raise exception 'reject limit reached'; end if;

  -- Remove from the shortlist (terminal + invisible to them).
  update public.vibe_interests set status='declined' where vibe_id=p_vibe and user_id=p_user;
  update public.vibes set preview_rejects_used = preview_rejects_used + 1 where id=p_vibe;

  -- Promote the next-best standby into the shortlist.
  select user_id into v_next from public.vibe_interests
    where vibe_id=p_vibe and status='standby' order by match_score desc nulls last limit 1;
  if v_next is not null then
    update public.vibe_interests set status='shortlisted' where vibe_id=p_vibe and user_id=v_next;
  end if;

  return jsonb_build_object('rejects_used', v.preview_rejects_used + 1, 'reject_cap', v_cap);
end $$;
grant execute on function public.host_reject_shortlisted(uuid, uuid) to authenticated;

-- ── Commit: turn the shortlist into invites, then fill the rest ─────────────
create or replace function public.commit_vibe_matching(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v public.vibes; c record; v_invited int := 0;
begin
  select * into v from public.vibes where id=p_vibe;
  if v.id is null or v.status <> 'reviewing' then return 0; end if;

  for c in select user_id from public.vibe_interests where vibe_id=p_vibe and status='shortlisted' loop
    update public.vibe_interests set status='invited', invitation_sent_at=now(),
      invitation_expires_at=public._vibe_confirm_deadline(v.starts_at)
      where vibe_id=p_vibe and user_id=c.user_id;
    perform public.notify(c.user_id, 'vibe_invitation', 'You''re invited to '||v.title,
            'Confirm your spot to unlock the location & chat.', jsonb_build_object('vibe_id', p_vibe));
    v_invited := v_invited + 1;
  end loop;

  update public.vibes set status='ranking' where id=p_vibe;
  perform public.backfill_vibe(p_vibe);
  perform public.invite_city_fallback(p_vibe);
  return v_invited;
end $$;

create or replace function public.host_commit_matching(p_vibe uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_host uuid;
begin
  select host_id into v_host from public.vibes where id=p_vibe;
  if v_host is null then raise exception 'vibe not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can send invites'; end if;
  return public.commit_vibe_matching(p_vibe);
end $$;
grant execute on function public.host_commit_matching(uuid) to authenticated;

-- ── Auto-commit: if the host doesn't act, send invites after a 6h review
--    window (never later than 2h before the event). Flockie curates if passive.
create or replace function public.auto_commit_due_reviews()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.vibes
    where status = 'reviewing'
      and now() >= least(coalesce(shortlisted_at, now()) + interval '6 hours', starts_at - interval '2 hours')
  loop
    perform public.commit_vibe_matching(r.id);
  end loop;
end $$;
do $$ begin perform cron.unschedule('flockie-auto-commit'); exception when others then null; end $$;
select cron.schedule('flockie-auto-commit', '*/5 * * * *', $$ select public.auto_commit_due_reviews(); $$);

-- ── Upkeep: only fill committed (ranking) vibes; reviewing waits for commit ──
create or replace function public.autofill_open_vibes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.vibes where status = 'ranking' loop
    perform public.backfill_vibe(r.id);
    perform public.invite_city_fallback(r.id);
  end loop;
end $$;
