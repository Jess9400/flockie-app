-- ============================================================================
-- Flockie — the Feed ("Strava, not Facebook").
-- Run in the Supabase SQL editor. Idempotent / safe to re-run.
--
-- Every post is ANCHORED to a real thing the author was part of — a Vibe
-- (host/confirmed), a Club (host/member), or a 1:1 activity (creator/accepted
-- joiner). No free-floating posts. City-scoped feed + likes + comments.
-- ============================================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('vibe', 'club', 'activity')),
  vibe_id uuid references public.vibes(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  activity_id uuid references public.trips(id) on delete cascade,
  anchor_title text not null,
  body text not null default '' check (char_length(body) <= 1000),
  photos text[] not null default '{}',
  city text not null,
  created_at timestamptz default now(),
  -- exactly one anchor, matching kind
  constraint posts_one_anchor check (
    (kind = 'vibe' and vibe_id is not null and club_id is null and activity_id is null)
    or (kind = 'club' and club_id is not null and vibe_id is null and activity_id is null)
    or (kind = 'activity' and activity_id is not null and vibe_id is null and club_id is null)
  )
);
create index if not exists posts_city_idx on public.posts (city, created_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (true);
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "likes read" on public.post_likes;
create policy "likes read" on public.post_likes for select to authenticated using (true);
drop policy if exists "likes insert own" on public.post_likes;
create policy "likes insert own" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "likes delete own" on public.post_likes;
create policy "likes delete own" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select to authenticated using (true);
drop policy if exists "comments insert own" on public.post_comments;
create policy "comments insert own" on public.post_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "comments delete own" on public.post_comments;
create policy "comments delete own" on public.post_comments for delete to authenticated using (author_id = auth.uid());

-- ── Create (validates you were actually part of the anchor) ─────────────────
create or replace function public.create_post(
  p_kind text,
  p_anchor uuid,
  p_body text default '',
  p_photos text[] default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_title text; v_city text; v_id uuid;
begin
  if p_kind = 'vibe' then
    select v.title, v.city into v_title, v_city
    from public.vibes v
    where v.id = p_anchor
      and (
        v.host_id = auth.uid()
        or exists (select 1 from public.vibe_interests vi
                   where vi.vibe_id = v.id and vi.user_id = auth.uid() and vi.status = 'confirmed')
      );
  elsif p_kind = 'club' then
    select c.title, c.city into v_title, v_city
    from public.clubs c
    where c.id = p_anchor
      and (
        c.owner_id = auth.uid()
        or exists (select 1 from public.club_memberships cm
                   where cm.club_id = c.id and cm.user_id = auth.uid()
                     and cm.status in ('founding', 'regular'))
      );
  elsif p_kind = 'activity' then
    select t.title, t.destination into v_title, v_city
    from public.trips t
    where t.id = p_anchor and t.kind = 'activity'
      and (
        t.user_id = auth.uid()
        or exists (select 1 from public.activity_join_requests r
                   where r.activity_id = t.id and r.user_id = auth.uid() and r.status = 'accepted')
      );
  else
    raise exception 'invalid post kind';
  end if;

  if v_title is null then
    raise exception 'you can only post about a vibe, club or activity you were part of';
  end if;
  if char_length(coalesce(p_body, '')) > 1000 then raise exception 'post is too long'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 4 then raise exception 'up to 4 photos'; end if;

  insert into public.posts (author_id, kind, vibe_id, club_id, activity_id, anchor_title, body, photos, city)
  values (
    auth.uid(), p_kind,
    case when p_kind = 'vibe' then p_anchor end,
    case when p_kind = 'club' then p_anchor end,
    case when p_kind = 'activity' then p_anchor end,
    v_title, coalesce(trim(p_body), ''), coalesce(p_photos, '{}'), coalesce(v_city, '')
  )
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_post(text, uuid, text, text[]) to authenticated;

-- ── The feed: my city + my clubs + my own posts ─────────────────────────────
create or replace function public.feed_posts(p_limit int default 30)
returns table (
  id uuid, author_id uuid, author_name text, author_photo text,
  kind text, anchor_title text, vibe_id uuid, club_id uuid, activity_id uuid,
  body text, photos text[], city text, created_at timestamptz,
  like_count int, comment_count int, liked_by_me boolean
)
language sql security definer set search_path = public stable as $$
  with me as (select home_city from public.profiles where id = auth.uid())
  select
    p.id, p.author_id, pr.display_name, pr.photos[1],
    p.kind, p.anchor_title, p.vibe_id, p.club_id, p.activity_id,
    p.body, p.photos, p.city, p.created_at,
    (select count(*)::int from public.post_likes l where l.post_id = p.id),
    (select count(*)::int from public.post_comments c where c.post_id = p.id),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  cross join me
  where p.author_id = auth.uid()
     or lower(p.city) = lower(coalesce(me.home_city, ''))
     or (p.club_id is not null and exists (
          select 1 from public.club_memberships cm
          where cm.club_id = p.club_id and cm.user_id = auth.uid()
            and cm.status in ('founding', 'regular')
        ))
  order by p.created_at desc
  limit p_limit;
$$;
grant execute on function public.feed_posts(int) to authenticated;

-- ── Comment via RPC so the post author gets a (throttled) inbox nudge ───────
create or replace function public.add_post_comment(p_post uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_author uuid; v_me text;
begin
  if nullif(btrim(coalesce(p_body, '')), '') is null then raise exception 'empty comment'; end if;
  insert into public.post_comments (post_id, author_id, body)
  values (p_post, auth.uid(), left(btrim(p_body), 500))
  returning id into v_id;

  select author_id into v_author from public.posts where id = p_post;
  -- notify the author (not for self-comments; max one unread per post)
  if v_author is not null and v_author <> auth.uid() and not exists (
    select 1 from public.notifications n
    where n.user_id = v_author and n.type = 'post_comment'
      and (n.data ->> 'post_id') = p_post::text and n.read_at is null
  ) then
    select display_name into v_me from public.profiles where id = auth.uid();
    perform public.notify(
      v_author, 'post_comment',
      coalesce(v_me, 'Someone') || ' commented on your post',
      left(btrim(p_body), 120),
      jsonb_build_object('post_id', p_post, 'href', '/home')
    );
  end if;
  return v_id;
end;
$$;
grant execute on function public.add_post_comment(uuid, text) to authenticated;
