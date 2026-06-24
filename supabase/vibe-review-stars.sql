-- Real 1–5 star Vibe reviews. Run in the Supabase SQL editor. Safe to re-run.
-- `recommend` is kept as a derived flag (rating >= 4 = "more like this"), so the
-- matching boost (vibe_review_fit) keeps working off the >3-star signal.

alter table public.vibe_reviews
  add column if not exists rating int check (rating between 1 and 5);

-- Backfill a rating for legacy thumbs-up/down reviews.
update public.vibe_reviews set rating = case when recommend then 5 else 2 end where rating is null;

-- Replace the boolean submit with a star-based one.
drop function if exists public.submit_vibe_review(uuid, boolean, text[], text);
create or replace function public.submit_vibe_review(
  p_vibe uuid, p_rating int, p_tags text[], p_comment text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_start timestamptz;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1 to 5';
  end if;
  select starts_at into v_start from public.vibes where id = p_vibe;
  if v_start is null then raise exception 'vibe not found'; end if;
  if v_start > now() then raise exception 'you can review a vibe once it has started'; end if;
  if not exists (
    select 1 from public.vibe_interests
    where vibe_id = p_vibe and user_id = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'only confirmed attendees can review this vibe';
  end if;

  insert into public.vibe_reviews (reviewer_id, vibe_id, rating, recommend, tags, comment)
  values (auth.uid(), p_vibe, p_rating, p_rating >= 4, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  on conflict (reviewer_id, vibe_id)
  do update set rating = excluded.rating, recommend = excluded.recommend,
                tags = excluded.tags, comment = excluded.comment, updated_at = now();
end $$;
grant execute on function public.submit_vibe_review(uuid, int, text[], text) to authenticated;
