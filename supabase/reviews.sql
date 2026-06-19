-- Reviews: travel buddies rate each other after a trip. Run in the Supabase SQL
-- editor. Safe to re-run.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reviewer_id, subject_id)
);
create index if not exists reviews_subject_idx on public.reviews (subject_id);

alter table public.reviews enable row level security;

-- Reviews are public (shown on profiles).
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews readable" on public.reviews for select to authenticated using (true);

-- Submit/update a review. Gated: you can only review someone you were matched
-- with as travel buddies, and never yourself. Upserts so editing is allowed.
create or replace function public.submit_review(p_subject uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_subject = auth.uid() then
    raise exception 'cannot review yourself';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1-5';
  end if;
  if not exists (
    select 1 from public.buddy_matches
    where (user_a = auth.uid() and user_b = p_subject)
       or (user_a = p_subject and user_b = auth.uid())
  ) then
    raise exception 'you can only review a travel buddy you matched with';
  end if;

  insert into public.reviews (reviewer_id, subject_id, rating, comment)
  values (auth.uid(), p_subject, p_rating, nullif(trim(p_comment), ''))
  on conflict (reviewer_id, subject_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end $$;
grant execute on function public.submit_review(uuid, int, text) to authenticated;
