-- Host invite code: each vibe gets a code. Sharing it (link or typed in the
-- interest form) confirms the person straight into one of the host's spots —
-- no algo, no manual approval. Run in the Supabase SQL editor. Safe to re-run.

alter table public.vibes
  add column if not exists host_invite_code text;

update public.vibes
  set host_invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 6))
  where host_invite_code is null;

alter table public.vibes
  alter column host_invite_code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));

-- Redeem a host code → directly confirmed into a host spot.
create or replace function public.redeem_host_code(p_vibe uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.vibes; v_status text; v_algo_base int; v_host_spots int; v_private_held int; v_confirmed int;
begin
  select * into v from public.vibes where id = p_vibe for update;
  if v.id is null then raise exception 'vibe not found'; end if;
  if v.status = 'cancelled' then raise exception 'vibe is cancelled'; end if;
  if v.host_id = auth.uid() then raise exception 'you host this vibe'; end if;
  if v.host_invite_code is null or upper(trim(p_code)) <> upper(v.host_invite_code) then
    raise exception 'invalid invite code';
  end if;

  select status into v_status from public.vibe_interests where vibe_id = p_vibe and user_id = auth.uid();
  if v_status = 'confirmed' then return; end if;  -- already in

  -- A host invite code is an explicit host override: the only real ceiling is the
  -- vibe's total capacity (counting confirmed + live invites). It is NOT limited
  -- by the algo/host-share split, so a code never fails while seats are open
  -- (the old static host-spots cap rejected joiners — and with algo_share=100 it
  -- meant zero host spots, killing the code entirely).
  select count(*) into v_confirmed from public.vibe_interests
    where vibe_id = p_vibe
      and (status = 'confirmed'
           or (status = 'invited' and (invitation_expires_at is null or invitation_expires_at > now())));
  -- a returning 'invited' redeemer already holds a seat, so don't double-count them
  if v_confirmed >= v.capacity and v_status is distinct from 'invited' then
    raise exception 'vibe is full';
  end if;

  insert into public.vibe_interests (vibe_id, user_id, status, source, confirmed_at)
    values (p_vibe, auth.uid(), 'confirmed', 'private', now())
  on conflict (vibe_id, user_id) do update set status = 'confirmed', source = 'private', confirmed_at = now();

  insert into public.vibing_chats (vibe_id) values (p_vibe) on conflict (vibe_id) do nothing;
  perform public.notify(auth.uid(), 'vibe_confirmed', 'You''re in for ' || v.title,
    'You joined with the host''s invite code — Vibing Chat is open.', jsonb_build_object('vibe_id', p_vibe));
  perform public.notify(v.host_id, 'vibe_private_request', 'Someone joined ' || v.title || ' with your code',
    'They''re confirmed in one of your spots.', jsonb_build_object('vibe_id', p_vibe));
end $$;
grant execute on function public.redeem_host_code(uuid, text) to authenticated;
