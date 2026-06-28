-- Explicit negative Vibe signal: "Not for me".
-- Keeps taste history for recommendations without notifying hosts.

create table if not exists public.vibe_feedback (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid references public.vibes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  signal text not null check (signal in ('not_for_me')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vibe_id, user_id, signal)
);

create index if not exists vibe_feedback_user_signal_idx
  on public.vibe_feedback (user_id, signal, created_at desc);

alter table public.vibe_feedback enable row level security;

drop policy if exists "vibe feedback own read" on public.vibe_feedback;
create policy "vibe feedback own read" on public.vibe_feedback for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "vibe feedback own insert" on public.vibe_feedback;
create policy "vibe feedback own insert" on public.vibe_feedback for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "vibe feedback own delete" on public.vibe_feedback;
create policy "vibe feedback own delete" on public.vibe_feedback for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.mark_vibe_not_for_me(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.vibes where id = p_vibe and host_id = auth.uid()) then
    raise exception 'hosts cannot hide their own vibe';
  end if;

  insert into public.vibe_feedback (vibe_id, user_id, signal)
  values (p_vibe, auth.uid(), 'not_for_me')
  on conflict (vibe_id, user_id, signal)
  do update set updated_at = now();
end $$;
grant execute on function public.mark_vibe_not_for_me(uuid) to authenticated;

create or replace function public.undo_vibe_not_for_me(p_vibe uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.vibe_feedback
  where vibe_id = p_vibe and user_id = auth.uid() and signal = 'not_for_me';
end $$;
grant execute on function public.undo_vibe_not_for_me(uuid) to authenticated;

create or replace function public.vibe_negative_fit(p_user uuid, p_vibe uuid)
returns numeric language plpgsql security definer set search_path = public stable as $$
declare
  v_cat text;
  v_tags text[];
  cat_negative numeric := 0;
  tag_negative numeric := 0;
  n_tags int;
  n_match int;
begin
  select category, event_vibe_tags into v_cat, v_tags from public.vibes where id = p_vibe;
  if v_cat is null and coalesce(array_length(v_tags, 1), 0) = 0 then return 0; end if;

  cat_negative := case when exists (
    select 1
    from (
      select vf.vibe_id
      from public.vibe_feedback vf
      where vf.user_id = p_user and vf.signal = 'not_for_me'
      union
      select vr.vibe_id
      from public.vibe_reviews vr
      where vr.reviewer_id = p_user and coalesce(vr.rating, case when vr.recommend then 5 else 2 end) <= 2
    ) disliked
    join public.vibes dv on dv.id = disliked.vibe_id
    where dv.category is not null and lower(dv.category) = lower(coalesce(v_cat, ''))
  ) then 1 else 0 end;

  n_tags := coalesce(array_length(v_tags, 1), 0);
  if n_tags > 0 then
    select count(distinct tg) into n_match
    from unnest(v_tags) tg
    where exists (
      select 1
      from (
        select vf.vibe_id
        from public.vibe_feedback vf
        where vf.user_id = p_user and vf.signal = 'not_for_me'
        union
        select vr.vibe_id
        from public.vibe_reviews vr
        where vr.reviewer_id = p_user and coalesce(vr.rating, case when vr.recommend then 5 else 2 end) <= 2
      ) disliked
      join public.vibes dv on dv.id = disliked.vibe_id
      where tg = any(coalesce(dv.event_vibe_tags, '{}'))
    );
    tag_negative := n_match::numeric / n_tags;
  end if;

  return least(1.0, 0.65 * cat_negative + 0.35 * tag_negative);
end $$;
grant execute on function public.vibe_negative_fit(uuid, uuid) to authenticated;

-- SUPERSEDED 2026-06-28: stale vibe_match copy — raw `::int` cast (no #98 regex
-- guard, line below) and a different scoring formula. Canonical guarded vibe_match
-- is in recommended-vibes.sql (verified live on prod). Wrapped so re-running this
-- file (it owns the live vibe_negative_fit above) can't downgrade the score.
-- (vibe_negative_fit / mark_/undo_vibe_not_for_me above remain ACTIVE.)
/*
create or replace function public.vibe_match(p_user uuid, p_vibe uuid)
returns int language plpgsql security definer set search_path = public stable as $$
declare
  pr public.profiles%rowtype;
  v public.vibes%rowtype;
  cat_fit numeric;
  tag_fit numeric;
  skill_fit numeric;
  social_fit numeric;
  review_fit numeric;
  negative_fit numeric;
  positive_score numeric;
  n_tags int;
  n_match int;
  event_social int;
  matched_skill int;
begin
  select * into pr from public.profiles where id = p_user;
  select * into v from public.vibes where id = p_vibe;
  if v.id is null then return null; end if;

  if coalesce(array_length(pr.activities, 1), 0) = 0 or v.category is null or v.category = 'other' then
    cat_fit := 0.5;
  elsif exists (select 1 from unnest(pr.activities) a where lower(a) like '%' || lower(v.category) || '%') then
    cat_fit := 1.0;
  else
    cat_fit := 0.2;
  end if;

  n_tags := coalesce(array_length(v.event_vibe_tags, 1), 0);
  if n_tags = 0 or coalesce(array_length(pr.activity_vibe, 1), 0) = 0 then
    tag_fit := 0.5;
  else
    select count(*) into n_match
    from unnest(v.event_vibe_tags) tg
    where lower(array_to_string(pr.activity_vibe, ' ')) like '%' || lower(tg) || '%';
    tag_fit := n_match::numeric / n_tags;
  end if;

  if v.required_skill_level is null then
    skill_fit := 1.0;
  else
    select (pr.activity_skills->>a)::int into matched_skill
    from unnest(pr.activities) a
    where lower(a) like '%' || lower(v.category) || '%' and pr.activity_skills ? a
    limit 1;
    if matched_skill is null then skill_fit := 0.5;
    else skill_fit := 1 - abs(v.required_skill_level - matched_skill)::numeric / 4; end if;
  end if;

  event_social := case
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('party', 'social', 'energetic')) then 5
    when exists (select 1 from unnest(v.event_vibe_tags) t where t in ('quiet', 'chill')) then 2
    else 3
  end;
  if pr.activity_social is null then social_fit := 0.5;
  else social_fit := 1 - abs(event_social - pr.activity_social)::numeric / 4; end if;

  review_fit := public.vibe_review_fit(p_user, p_vibe);
  negative_fit := public.vibe_negative_fit(p_user, p_vibe);
  positive_score := 100 * (0.35 * cat_fit + 0.25 * tag_fit + 0.12 * skill_fit + 0.13 * social_fit + 0.15 * review_fit);

  return greatest(0, least(100, round(positive_score - 30 * negative_fit)));
end $$;
grant execute on function public.vibe_match(uuid, uuid) to authenticated;
*/
