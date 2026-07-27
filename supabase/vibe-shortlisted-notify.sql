-- "You're in the running": notify a user the moment they're shortlisted.
-- Before, _rank_vibe_core only notified the HOST (vibe_review_ready) - shortlisted
-- people got nothing. This trigger fires on vibe_interests when a row becomes
-- 'shortlisted' (via ranking) and sends the user a 'vibe_shortlisted' notification
-- (which is now emailable → in-app + email). Fires once per shortlisting (guarded
-- so a host re-run doesn't re-notify already-shortlisted people). Idempotent.
create or replace function public.notify_shortlisted()
returns trigger language plpgsql security definer set search_path = public as $$
declare v public.vibes;
begin
  if new.status = 'shortlisted'
     and (tg_op = 'INSERT' or old.status is distinct from 'shortlisted') then
    select * into v from public.vibes where id = new.vibe_id;
    if v.id is not null and v.status <> 'cancelled' then
      perform public.notify(new.user_id, 'vibe_shortlisted',
        'You''re in the running for ' || coalesce(v.title, 'a Vibe'),
        'You made the shortlist - we''ll confirm your spot soon.',
        jsonb_build_object('vibe_id', new.vibe_id));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists vibe_interests_shortlisted_notify on public.vibe_interests;
create trigger vibe_interests_shortlisted_notify
  after insert or update of status on public.vibe_interests
  for each row execute function public.notify_shortlisted();
