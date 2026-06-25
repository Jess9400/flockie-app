-- Let you review people you actually shared something with — not just matched
-- travel buddies, but anyone in the same flock (joined via accepted requests).
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.submit_review(p_subject uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_subject = auth.uid() then raise exception 'cannot review yourself'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5'; end if;

  if not (
    -- a matched travel buddy / activity buddy
    exists (
      select 1 from public.buddy_matches
      where (user_a = auth.uid() and user_b = p_subject)
         or (user_a = p_subject and user_b = auth.uid())
    )
    -- OR you shared a flock: both host or accepted on the same public trip
    or exists (
      select 1 from public.trips t
      where t.visibility = 'public' and t.kind = 'trip'
        and ( t.user_id = auth.uid()
              or exists (select 1 from public.trip_join_requests j
                         where j.trip_id = t.id and j.user_id = auth.uid() and j.status = 'accepted') )
        and ( t.user_id = p_subject
              or exists (select 1 from public.trip_join_requests j
                         where j.trip_id = t.id and j.user_id = p_subject and j.status = 'accepted') )
    )
  ) then
    raise exception 'you can only review someone you matched or shared a flock with';
  end if;

  insert into public.reviews (reviewer_id, subject_id, rating, comment)
  values (auth.uid(), p_subject, p_rating, nullif(trim(p_comment), ''))
  on conflict (reviewer_id, subject_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end $$;
grant execute on function public.submit_review(uuid, int, text) to authenticated;
