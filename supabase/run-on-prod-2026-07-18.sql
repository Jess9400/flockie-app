-- ============================================================================
-- Flockie — pending prod migrations, bundled (2026-07-18).
-- Idempotent and safe to re-run. Paste the WHOLE file into the Supabase SQL
-- editor and Run once. Re-running fixes any half-applied earlier attempt
-- (e.g. respond_buddy_plan / set_plan_met that failed on a `pgsql` typo).
-- ============================================================================

-- ── 1) buddy_plans: "propose a plan" + plan-anchored review ─────────────────
create table if not exists public.buddy_plans (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.buddy_chats(id) on delete cascade,
  proposed_by  uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (category in ('coffee','restaurant','bar','park','activity')),
  place_name   text,
  place_url    text,
  when_at      timestamptz,
  status       text not null default 'proposed' check (status in ('proposed','accepted','declined')),
  met          boolean,
  created_at   timestamptz default now()
);
create index if not exists buddy_plans_chat_idx on public.buddy_plans (chat_id, created_at desc);

alter table public.buddy_plans enable row level security;
drop policy if exists "members see plans" on public.buddy_plans;
create policy "members see plans" on public.buddy_plans
  for select to authenticated using (public.is_buddy_chat_member(chat_id));

create or replace function public.propose_buddy_plan(
  p_chat uuid, p_category text, p_place_name text default null,
  p_place_url text default null, p_when timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_buddy_chat_member(p_chat) then raise exception 'not a member of this chat'; end if;
  update public.buddy_plans set status='declined' where chat_id=p_chat and status='proposed';
  insert into public.buddy_plans (chat_id, proposed_by, category, place_name, place_url, when_at)
    values (p_chat, auth.uid(), p_category, nullif(btrim(p_place_name),''), nullif(btrim(p_place_url),''), p_when)
    returning id into v_id;
  insert into public.buddy_messages (chat_id, sender_id, content) values (p_chat, null, '📅 proposed a plan');
  return v_id;
end; $$;
grant execute on function public.propose_buddy_plan(uuid, text, text, text, timestamptz) to authenticated;

create or replace function public.respond_buddy_plan(p_plan uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select chat_id into v_chat from public.buddy_plans where id=p_plan;
  if v_chat is null or not public.is_buddy_chat_member(v_chat) then raise exception 'not allowed'; end if;
  update public.buddy_plans set status=case when p_accept then 'accepted' else 'declined' end
    where id=p_plan and status='proposed';
  insert into public.buddy_messages (chat_id, sender_id, content)
    values (v_chat, null, case when p_accept then '✅ accepted the plan' else '↩️ passed on the plan' end);
end; $$;
grant execute on function public.respond_buddy_plan(uuid, boolean) to authenticated;

create or replace function public.set_plan_met(p_plan uuid, p_met boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select chat_id into v_chat from public.buddy_plans where id=p_plan;
  if v_chat is null or not public.is_buddy_chat_member(v_chat) then raise exception 'not allowed'; end if;
  update public.buddy_plans set met=p_met where id=p_plan and status='accepted';
end; $$;
grant execute on function public.set_plan_met(uuid, boolean) to authenticated;


-- ── 2) Review gate: don't review a match created AFTER the activity ended ───
create or replace function public.pending_reviews()
returns table (buddy_id uuid, display_name text, photo text, destination text)
language sql security definer set search_path = public stable as $$
  select
    (case when m.user_a = auth.uid() then m.user_b else m.user_a end) as buddy_id,
    other.display_name, other.photos[1] as photo, t.destination
  from public.buddy_matches m
  join public.trips t
    on t.id = (case when m.user_a = auth.uid() then m.trip_a else m.trip_b end)
  join public.profiles other
    on other.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  where auth.uid() in (m.user_a, m.user_b)
    and t.end_date < current_date
    and m.created_at::date <= t.end_date
    and not exists (
      select 1 from public.reviews r
      where r.reviewer_id = auth.uid()
        and r.subject_id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
    );
$$;
grant execute on function public.pending_reviews() to authenticated;

create or replace function public.trips_creation_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if exists (
    select 1
    from public.buddy_matches m
    join public.trips t
      on t.id = (case when m.user_a = new.user_id then m.trip_a else m.trip_b end)
    where new.user_id in (m.user_a, m.user_b)
      and t.end_date < current_date
      and m.created_at::date <= t.end_date
      and not exists (
        select 1 from public.reviews r
        where r.reviewer_id = new.user_id
          and r.subject_id = (case when m.user_a = new.user_id then m.user_b else m.user_a end)
      )
  ) then
    raise exception 'Review your past travel buddies before creating a new trip or activity.';
  end if;
  return new;
end; $$;


-- ── 3) Soften buddy_hard_block (drop sober↔drinking; keep same-gender) ──────
create or replace function public.buddy_hard_block(p_a uuid, p_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with a as (select * from public.profiles where id = p_a),
       b as (select * from public.profiles where id = p_b)
  select
    ( ( 'I prefer same-gender travel partners' = any(coalesce(a.dealbreakers, '{}'))
        or 'I prefer same-gender travel partners' = any(coalesce(b.dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(a.activity_dealbreakers, '{}'))
        or 'Same-gender preferred' = any(coalesce(b.activity_dealbreakers, '{}')) )
      and a.gender is not null and b.gender is not null
      and a.gender <> b.gender )
  from a, b;
$$;
grant execute on function public.buddy_hard_block(uuid, uuid) to authenticated;
