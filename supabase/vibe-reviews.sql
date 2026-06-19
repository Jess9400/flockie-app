-- Vibe reviews: attendees rate the EVENT (not each other). Aggregated into
-- weighted percentages ("80% said Fun"). Run in the Supabase SQL editor.
-- Safe to re-run.

create table if not exists public.vibe_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  recommend boolean not null default true,
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reviewer_id, vibe_id)
);
create index if not exists vibe_reviews_vibe_idx on public.vibe_reviews (vibe_id);

alter table public.vibe_reviews enable row level security;

drop policy if exists "vibe reviews readable" on public.vibe_reviews;
create policy "vibe reviews readable" on public.vibe_reviews for select to authenticated using (true);

-- Submit/update a vibe review. Gated: confirmed attendee + the vibe has started.
create or replace function public.submit_vibe_review(
  p_vibe uuid, p_recommend boolean, p_tags text[], p_comment text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_start timestamptz;
begin
  select starts_at into v_start from public.vibes where id = p_vibe;
  if v_start is null then
    raise exception 'vibe not found';
  end if;
  if v_start > now() then
    raise exception 'you can review a vibe once it has started';
  end if;
  if not exists (
    select 1 from public.vibe_interests
    where vibe_id = p_vibe and user_id = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'only confirmed attendees can review this vibe';
  end if;

  insert into public.vibe_reviews (reviewer_id, vibe_id, recommend, tags, comment)
  values (auth.uid(), p_vibe, p_recommend, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  on conflict (reviewer_id, vibe_id)
  do update set recommend = excluded.recommend, tags = excluded.tags,
                comment = excluded.comment, updated_at = now();
end $$;
grant execute on function public.submit_vibe_review(uuid, boolean, text[], text) to authenticated;

-- Host track record: recommend % across all of a host's reviewed vibes.
-- Used for social proof on Vibe cards while browsing upcoming events.
create or replace function public.host_recommend_stats(p_hosts uuid[])
returns table (host_id uuid, review_count int, recommend_pct int)
language sql security definer set search_path = public stable as $$
  select v.host_id,
         count(*)::int as review_count,
         round(100.0 * count(*) filter (where vr.recommend) / count(*))::int as recommend_pct
  from public.vibe_reviews vr
  join public.vibes v on v.id = vr.vibe_id
  where v.host_id = any(p_hosts)
  group by v.host_id;
$$;
grant execute on function public.host_recommend_stats(uuid[]) to authenticated;
