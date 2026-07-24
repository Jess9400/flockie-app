-- ============================================================================
-- Flockie Feed — review auto-posts + join CTA on upcoming-vibe posts.
-- Run AFTER feed.sql + follows.sql. Idempotent / safe to re-run.
--
-- 1. A positive vibe review WITH text auto-becomes a feed post (anchored to
--    the vibe, authored by the reviewer, badged as a review). Event reviews
--    only — person-to-person reviews stay private feedback.
-- 2. feed_posts/user_posts now return the anchored vibe's start time, so the
--    UI can put a "Join this vibe" CTA on posts about upcoming vibes.
-- ============================================================================

alter table public.posts add column if not exists is_review boolean not null default false;

-- ── Review → auto-post ──────────────────────────────────────────────────────
create or replace function public.vibe_review_to_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare v vibes%rowtype;
begin
  -- Only recommended reviews with something written; one post per review.
  if new.recommend is distinct from true then return new; end if;
  if nullif(btrim(coalesce(new.comment, '')), '') is null then return new; end if;
  select * into v from public.vibes where id = new.vibe_id;
  if not found then return new; end if;
  if exists (
    select 1 from public.posts p
    where p.author_id = new.reviewer_id and p.vibe_id = new.vibe_id and p.is_review
  ) then return new; end if;

  insert into public.posts (author_id, kind, vibe_id, anchor_title, body, photos, city, is_review)
  values (new.reviewer_id, 'vibe', new.vibe_id, v.title, btrim(new.comment), '{}', v.city, true);
  return new;
end;
$$;
drop trigger if exists vibe_review_to_post_t on public.vibe_reviews;
create trigger vibe_review_to_post_t
after insert on public.vibe_reviews
for each row execute function public.vibe_review_to_post();

-- ── feed_posts v3 (adds is_review + anchor_starts_at) ───────────────────────
drop function if exists public.feed_posts(int);
create or replace function public.feed_posts(p_limit int default 30)
returns table (
  id uuid, author_id uuid, author_name text, author_photo text,
  kind text, anchor_title text, vibe_id uuid, club_id uuid, activity_id uuid,
  body text, photos text[], city text, created_at timestamptz,
  like_count int, comment_count int, liked_by_me boolean,
  is_review boolean, anchor_starts_at timestamptz
)
language sql security definer set search_path = public stable as $$
  with me as (select home_city from public.profiles where id = auth.uid())
  select
    p.id, p.author_id, pr.display_name, pr.photos[1],
    p.kind, p.anchor_title, p.vibe_id, p.club_id, p.activity_id,
    p.body, p.photos, p.city, p.created_at,
    (select count(*)::int from public.post_likes l where l.post_id = p.id),
    (select count(*)::int from public.post_comments c where c.post_id = p.id),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.is_review,
    (select v.starts_at from public.vibes v where v.id = p.vibe_id)
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

-- ── user_posts v3 (same additions) ──────────────────────────────────────────
drop function if exists public.user_posts(uuid, int);
create or replace function public.user_posts(p_user uuid, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_name text, author_photo text,
  kind text, anchor_title text, vibe_id uuid, club_id uuid, activity_id uuid,
  body text, photos text[], city text, created_at timestamptz,
  like_count int, comment_count int, liked_by_me boolean,
  is_review boolean, anchor_starts_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.author_id, pr.display_name, pr.photos[1],
    p.kind, p.anchor_title, p.vibe_id, p.club_id, p.activity_id,
    p.body, p.photos, p.city, p.created_at,
    (select count(*)::int from public.post_likes l where l.post_id = p.id),
    (select count(*)::int from public.post_comments c where c.post_id = p.id),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.is_review,
    (select v.starts_at from public.vibes v where v.id = p.vibe_id)
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.author_id = p_user
  order by p.created_at desc
  limit p_limit;
$$;
grant execute on function public.user_posts(uuid, int) to authenticated;

-- ── Edit own posts (body only, via the ⋯ menu) ──────────────────────────────
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
