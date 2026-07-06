-- "You're in the running" now fires the moment a user expresses interest, not
-- after the host/algo ranks — one less step (the in-app popup already says this).
-- Replaces the shortlist-time trigger from the previous version.
-- NOTE: at interest time everyone is "in the running"; if a vibe later
-- oversubscribes, some interested people become standby — a "you're on the
-- waitlist" nuance can be added later. Idempotent.
drop trigger if exists vibe_interests_shortlisted_notify on public.vibe_interests;
drop function if exists public.notify_shortlisted();

create or replace function public.notify_in_the_running()
returns trigger language plpgsql security definer set search_path = public as $$
declare v public.vibes;
begin
  if tg_op = 'INSERT' and new.status = 'interested' then
    select * into v from public.vibes where id = new.vibe_id;
    if v.id is not null and v.status <> 'cancelled' and v.starts_at > now() then
      perform public.notify(new.user_id, 'vibe_shortlisted',
        'You''re in the running for ' || coalesce(v.title, 'a Vibe'),
        'We''ve got you in the running — we''ll confirm your spot soon.',
        jsonb_build_object('vibe_id', new.vibe_id));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists vibe_interests_interested_notify on public.vibe_interests;
create trigger vibe_interests_interested_notify
  after insert on public.vibe_interests
  for each row execute function public.notify_in_the_running();
