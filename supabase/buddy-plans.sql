-- Buddy plans: let two matched buddies (1:1) propose a concrete plan in their
-- chat — a category (coffee/restaurant/bar/park/activity), an optional place +
-- time — and accept it. Powers the "propose a plan" card + the honest,
-- plan-anchored "Did you meet?" review prompt.
--
-- Run in the Supabase SQL editor. Idempotent / safe to re-run.

create table if not exists public.buddy_plans (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.buddy_chats(id) on delete cascade,
  proposed_by  uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (category in ('coffee','restaurant','bar','park','activity')),
  place_name   text,
  place_url    text,
  when_at      timestamptz,
  status       text not null default 'proposed' check (status in ('proposed','accepted','declined')),
  met          boolean,                       -- did-you-meet answer (null = unanswered)
  created_at   timestamptz default now()
);
create index if not exists buddy_plans_chat_idx on public.buddy_plans (chat_id, created_at desc);

alter table public.buddy_plans enable row level security;

drop policy if exists "members see plans" on public.buddy_plans;
create policy "members see plans" on public.buddy_plans
  for select to authenticated using (public.is_buddy_chat_member(chat_id));

-- All writes go through the definer RPCs below (they enforce membership), so no
-- direct insert/update policy is granted.

-- Propose a plan. Supersedes any still-'proposed' plan in the same chat, drops a
-- system message so the other person sees it in the thread, and returns the id.
create or replace function public.propose_buddy_plan(
  p_chat uuid,
  p_category text,
  p_place_name text default null,
  p_place_url text default null,
  p_when timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_buddy_chat_member(p_chat) then
    raise exception 'not a member of this chat';
  end if;
  -- retire any outstanding proposal so there's one live plan to act on
  update public.buddy_plans set status = 'declined'
    where chat_id = p_chat and status = 'proposed';
  insert into public.buddy_plans (chat_id, proposed_by, category, place_name, place_url, when_at)
    values (p_chat, auth.uid(), p_category, nullif(btrim(p_place_name), ''), nullif(btrim(p_place_url), ''), p_when)
    returning id into v_id;
  insert into public.buddy_messages (chat_id, sender_id, content)
    values (p_chat, null, '📅 proposed a plan');
  return v_id;
end;
$$;
grant execute on function public.propose_buddy_plan(uuid, text, text, text, timestamptz) to authenticated;

-- Accept / decline a proposed plan (the recipient, or either member).
create or replace function public.respond_buddy_plan(p_plan uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select chat_id into v_chat from public.buddy_plans where id = p_plan;
  if v_chat is null or not public.is_buddy_chat_member(v_chat) then
    raise exception 'not allowed';
  end if;
  update public.buddy_plans
     set status = case when p_accept then 'accepted' else 'declined' end
   where id = p_plan and status = 'proposed';
  insert into public.buddy_messages (chat_id, sender_id, content)
    values (v_chat, null, case when p_accept then '✅ accepted the plan' else '↩️ passed on the plan' end);
end;
$$;
grant execute on function public.respond_buddy_plan(uuid, boolean) to authenticated;

-- Answer the "Did you meet?" prompt on an accepted plan.
create or replace function public.set_plan_met(p_plan uuid, p_met boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  select chat_id into v_chat from public.buddy_plans where id = p_plan;
  if v_chat is null or not public.is_buddy_chat_member(v_chat) then
    raise exception 'not allowed';
  end if;
  update public.buddy_plans set met = p_met where id = p_plan and status = 'accepted';
end;
$$;
grant execute on function public.set_plan_met(uuid, boolean) to authenticated;
