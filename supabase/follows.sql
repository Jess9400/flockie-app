-- ============================================================================
-- Flockie — Feed phase 2: follows + people directory + profile posts.
-- Run AFTER feed.sql. Idempotent / safe to re-run.
-- ============================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;
drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select to authenticated using (true);
drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Toggle + notify (once per pair while unread — no follow/unfollow spam).
create or replace function public.toggle_follow(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_me text; v_new boolean;
begin
  if p_user = auth.uid() then raise exception 'cannot follow yourself'; end if;
  if exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = p_user) then
    delete from public.follows where follower_id = auth.uid() and followee_id = p_user;
    return false;
  end if;
  insert into public.follows (follower_id, followee_id) values (auth.uid(), p_user)
  on conflict do nothing returning true into v_new;
  if v_new and not exists (
    select 1 from public.notifications n
    where n.user_id = p_user and n.type = 'new_follower'
      and (n.data ->> 'follower') = auth.uid()::text and n.read_at is null
  ) then
    select display_name into v_me from public.profiles where id = auth.uid();
    perform public.notify(
      p_user, 'new_follower',
      coalesce(v_me, 'Someone') || ' started following you',
      'They will see your recaps in their feed.',
      jsonb_build_object('follower', auth.uid(), 'href', '/people/' || auth.uid())
    );
  end if;
  return true;
end;
$$;
grant execute on function public.toggle_follow(uuid) to authenticated;

-- ── People directory: your city, people you've MET first ────────────────────
create or replace function public.people_directory(p_q text default null, p_limit int default 30)
returns table (
  id uuid, display_name text, age int, photo text, one_liner text, city text,
  met boolean, following boolean
)
language sql security definer set search_path = public stable as $$
  with me as (select home_city from public.profiles where id = auth.uid())
  select
    p.id, p.display_name, p.age, p.photos[1], p.one_liner, p.home_city,
    (
      exists (select 1 from public.buddy_matches m
              where (m.user_a = auth.uid() and m.user_b = p.id)
                 or (m.user_b = auth.uid() and m.user_a = p.id))
      or exists (
        select 1 from public.vibe_interests a
        join public.vibe_interests b on b.vibe_id = a.vibe_id
        where a.user_id = auth.uid() and a.status = 'confirmed'
          and b.user_id = p.id and b.status = 'confirmed'
      )
      or exists (
        select 1 from public.club_memberships a
        join public.club_memberships b on b.club_id = a.club_id
        where a.user_id = auth.uid() and a.status in ('founding', 'regular')
          and b.user_id = p.id and b.status in ('founding', 'regular')
      )
    ) as met,
    exists (select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followee_id = p.id) as following
  from public.profiles p
  cross join me
  where p.id <> auth.uid()
    and p.onboarding_complete
    and lower(coalesce(p.home_city, '')) = lower(coalesce(me.home_city, ''))
    and not public.buddy_hard_block(auth.uid(), p.id)
    and (p_q is null or btrim(p_q) = '' or p.display_name ilike '%' || btrim(p_q) || '%')
  order by met desc, p.display_name asc
  limit p_limit;
$$;
grant execute on function public.people_directory(text, int) to authenticated;

-- ── Follow lists (either direction) ─────────────────────────────────────────
create or replace function public.follow_list(p_user uuid, p_direction text)
returns table (id uuid, display_name text, age int, photo text, city text, following boolean)
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.age, p.photos[1], p.home_city,
         exists (select 1 from public.follows f2
                 where f2.follower_id = auth.uid() and f2.followee_id = p.id)
  from public.follows f
  join public.profiles p
    on p.id = case when p_direction = 'following' then f.followee_id else f.follower_id end
  where case when p_direction = 'following' then f.follower_id else f.followee_id end = p_user
  order by f.created_at desc
  limit 100;
$$;
grant execute on function public.follow_list(uuid, text) to authenticated;

-- ── A user's posts (profile) ────────────────────────────────────────────────
create or replace function public.user_posts(p_user uuid, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_name text, author_photo text,
  kind text, anchor_title text, vibe_id uuid, club_id uuid, activity_id uuid,
  body text, photos text[], city text, created_at timestamptz,
  like_count int, comment_count int, liked_by_me boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.author_id, pr.display_name, pr.photos[1],
    p.kind, p.anchor_title, p.vibe_id, p.club_id, p.activity_id,
    p.body, p.photos, p.city, p.created_at,
    (select count(*)::int from public.post_likes l where l.post_id = p.id),
    (select count(*)::int from public.post_comments c where c.post_id = p.id),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.author_id = p_user
  order by p.created_at desc
  limit p_limit;
$$;
grant execute on function public.user_posts(uuid, int) to authenticated;

-- ── Feed now also includes people you follow (any city) ─────────────────────
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
     or exists (select 1 from public.follows f
                where f.follower_id = auth.uid() and f.followee_id = p.author_id)
     or (p.club_id is not null and exists (
          select 1 from public.club_memberships cm
          where cm.club_id = p.club_id and cm.user_id = auth.uid()
            and cm.status in ('founding', 'regular')
        ))
  order by p.created_at desc
  limit p_limit;
$$;
grant execute on function public.feed_posts(int) to authenticated;

-- ── Like notification (throttled: max one unread per post) ──────────────────
create or replace function public.post_like_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_me text; v_n int;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is null or v_author = new.user_id then return new; end if;
  if exists (
    select 1 from public.notifications n
    where n.user_id = v_author and n.type = 'post_like'
      and (n.data ->> 'post_id') = new.post_id::text and n.read_at is null
  ) then return new; end if;
  select count(*)::int into v_n from public.post_likes where post_id = new.post_id;
  select display_name into v_me from public.profiles where id = new.user_id;
  perform public.notify(
    v_author, 'post_like',
    coalesce(v_me, 'Someone')
      || case when v_n > 1 then ' and ' || (v_n - 1) || ' others liked your post'
              else ' liked your post' end,
    'Nice — your recap is landing.',
    jsonb_build_object('post_id', new.post_id, 'href', '/home')
  );
  return new;
end;
$$;
drop trigger if exists post_like_notify_t on public.post_likes;
create trigger post_like_notify_t
after insert on public.post_likes
for each row execute function public.post_like_notify();
