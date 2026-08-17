-- DEMOCRATIC CLUB ENTRY (founder call 2026-08-17, Stage C). Joining a club
-- becomes a member decision:
--   1. The applicant writes a short intro with their request (affinities,
--      history, skills, why they deserve in - LinkedIn style).
--   2. The request lands in the club chat as an automatic system message and
--      every active member is called to vote YES/NO.
--   3. Decision at MAJORITY of the electorate (active members + host, minus
--      the candidate) - not literally "all must vote", so one silent member
--      can't deadlock entry. The host/moderator manual approve/decline stays
--      as an override and clears the vote.
--   4. YES: the applicant becomes a regular, gets the acceptance notification
--      pointing at the club page welcome (?welcome=1 - choose free or paid
--      membership there). NO: a kind decline pointing at similar clubs.
--
-- Access model: votes table has NO direct writes (RPC-only), tallies readable
-- by active members; all functions SECURITY DEFINER with explicit search_path,
-- authenticated-only, anon revoked. Supersedes: request_club_membership
-- (clubs-foundation.sql - old 1-arg signature DROPPED), approve/decline_club_
-- membership (club-moderators.sql - now also clear votes). Requires
-- club-moderators.sql. Run in the Supabase SQL editor. Safe to re-run.

-- ── The intro message ───────────────────────────────────────────────────────
alter table public.club_memberships
  add column if not exists request_message text check (char_length(request_message) <= 600);

-- ── Votes ───────────────────────────────────────────────────────────────────
create table if not exists public.club_join_votes (
  club_id uuid not null references public.clubs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  vote boolean not null,
  created_at timestamptz not null default now(),
  primary key (club_id, candidate_id, voter_id)
);
alter table public.club_join_votes enable row level security;

drop policy if exists "join votes member read" on public.club_join_votes;
create policy "join votes member read" on public.club_join_votes for select to authenticated
  using (public.is_club_member(club_id));

-- Electorate: active members plus the host (if not on the roster), minus the
-- candidate. Internal helper - no caller execute.
create or replace function public._club_electorate(p_club uuid, p_candidate uuid)
returns int
language sql security definer set search_path = public stable as $$
  select (
    select count(*) from public.club_memberships
    where club_id = p_club and status in ('founding', 'regular') and user_id <> p_candidate
  ) + (
    select case when exists (
      select 1 from public.club_memberships m
      join public.clubs c on c.id = m.club_id
      where m.club_id = p_club and m.user_id = c.owner_id and m.status in ('founding', 'regular')
    ) then 0 else 1 end
  );
$$;
revoke all on function public._club_electorate(uuid, uuid) from public, anon, authenticated;

-- ── Request with intro (drops the old 1-arg signature) ──────────────────────
drop function if exists public.request_club_membership(uuid);

create or replace function public.request_club_membership(p_club uuid, p_message text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
  v_host_id uuid;
  v_name text;
begin
  select title, owner_id
  into v_club_title, v_host_id
  from public.clubs
  where id = p_club and status = 'active';

  if not found then
    raise exception 'this club is not accepting membership requests';
  end if;
  if not exists (
    select 1 from public.club_attendance
    where club_id = p_club and user_id = auth.uid()
  ) then
    raise exception 'attend a club gathering before requesting membership';
  end if;

  insert into public.club_memberships (club_id, user_id, status, request_message, updated_at)
  values (p_club, auth.uid(), 'requested', nullif(trim(coalesce(p_message, '')), ''), now())
  on conflict (club_id, user_id) do update
    set status = 'requested',
        request_message = nullif(trim(coalesce(p_message, '')), ''),
        updated_at = now(),
        show_on_profile = false
    where public.club_memberships.status in ('left', 'declined', 'removed');

  if not found then
    raise exception 'membership is already active or awaiting a decision';
  end if;

  -- Fresh application, fresh ballot.
  delete from public.club_join_votes where club_id = p_club and candidate_id = auth.uid();

  v_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');

  -- The automatic poll message in the club chat.
  insert into public.club_messages (club_id, sender_id, content)
  values (p_club, null,
    '📊 ACCEPT NEW MEMBER: ' || v_name || '? '
    || coalesce('"' || nullif(trim(coalesce(p_message, '')), '') || '" ', '')
    || 'Vote YES or NO on the club page.');

  perform public.notify(
    v_host_id,
    'club_membership_request',
    'New member vote: ' || v_name,
    v_name || ' asked to join ' || v_club_title || '. The club is voting - your vote counts too.',
    jsonb_build_object('href', '/clubs/' || p_club)
  );
end;
$$;
revoke execute on function public.request_club_membership(uuid, text) from public, anon;
grant execute on function public.request_club_membership(uuid, text) to authenticated;

-- ── Vote + automatic decision at majority ───────────────────────────────────
create or replace function public.vote_club_member(p_club uuid, p_candidate uuid, p_vote boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_title text; v_city text; v_name text;
  v_yes int; v_no int; v_electorate int; v_decision text := 'open';
begin
  if not (public.is_club_member(p_club) or public.is_club_host(p_club)) then
    raise exception 'active club members only';
  end if;
  if p_candidate = auth.uid() then raise exception 'you cannot vote on yourself'; end if;
  if not exists (
    select 1 from public.club_memberships
    where club_id = p_club and user_id = p_candidate and status = 'requested'
  ) then
    raise exception 'no open vote for this person';
  end if;

  insert into public.club_join_votes (club_id, candidate_id, voter_id, vote)
  values (p_club, p_candidate, auth.uid(), p_vote)
  on conflict (club_id, candidate_id, voter_id) do update set vote = excluded.vote, created_at = now();

  select count(*) filter (where vote), count(*) filter (where not vote)
  into v_yes, v_no
  from public.club_join_votes
  where club_id = p_club and candidate_id = p_candidate;
  v_electorate := public._club_electorate(p_club, p_candidate);

  select title, city into v_title, v_city from public.clubs where id = p_club;
  v_name := coalesce((select display_name from public.profiles where id = p_candidate), 'The applicant');

  if v_yes * 2 > v_electorate then
    v_decision := 'accepted';
    update public.club_memberships
    set status = 'regular', regular_since = now(), updated_at = now()
    where club_id = p_club and user_id = p_candidate and status = 'requested';
    delete from public.club_join_votes where club_id = p_club and candidate_id = p_candidate;
    insert into public.club_messages (club_id, sender_id, content)
    values (p_club, null, '🎉 The club voted YES - welcome, ' || v_name || '!');
    perform public.notify(p_candidate, 'club_accepted',
      'You''re in! ' || v_title || ' voted YES',
      'The members voted to accept you. Come pick how you want to join.',
      jsonb_build_object('href', '/clubs/' || p_club || '?welcome=1'));
  elsif v_no * 2 > v_electorate then
    v_decision := 'declined';
    update public.club_memberships
    set status = 'declined', updated_at = now(), show_on_profile = false
    where club_id = p_club and user_id = p_candidate and status = 'requested';
    delete from public.club_join_votes where club_id = p_club and candidate_id = p_candidate;
    perform public.notify(p_candidate, 'club_membership_declined',
      'Update on ' || v_title,
      'The club went another way this time - it says nothing about you. There are more clubs near ' || coalesce(v_city, 'you') || ' that would be lucky to have you.',
      jsonb_build_object('href', '/clubs?city=' || coalesce(v_city, '')));
  end if;

  return jsonb_build_object('yes', v_yes, 'no', v_no, 'electorate', v_electorate, 'decision', v_decision);
end;
$$;
revoke execute on function public.vote_club_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.vote_club_member(uuid, uuid, boolean) to authenticated;

-- ── Candidates + tallies for the voting panel (active members) ──────────────
create or replace function public.club_membership_candidates(p_club uuid)
returns table (
  user_id uuid, display_name text, photo text, message text,
  yes_votes int, no_votes int, my_vote boolean, electorate int
)
language sql security definer set search_path = public stable as $$
  select
    m.user_id,
    p.display_name,
    p.photos[1],
    m.request_message,
    (select count(*)::int from public.club_join_votes v
      where v.club_id = p_club and v.candidate_id = m.user_id and v.vote),
    (select count(*)::int from public.club_join_votes v
      where v.club_id = p_club and v.candidate_id = m.user_id and not v.vote),
    (select v.vote from public.club_join_votes v
      where v.club_id = p_club and v.candidate_id = m.user_id and v.voter_id = auth.uid()),
    public._club_electorate(p_club, m.user_id)
  from public.club_memberships m
  join public.profiles p on p.id = m.user_id
  where m.club_id = p_club
    and m.status = 'requested'
    and (public.is_club_member(p_club) or public.is_club_host(p_club))
  order by m.updated_at asc;
$$;
revoke all on function public.club_membership_candidates(uuid) from public, anon;
grant execute on function public.club_membership_candidates(uuid) to authenticated;

-- ── Manual host/moderator decisions clear the ballot too ────────────────────
create or replace function public.approve_club_membership(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
begin
  if not public.is_club_manager(p_club) then
    raise exception 'only the club host or a moderator can approve membership';
  end if;

  select title into v_club_title
  from public.clubs
  where id = p_club;

  update public.club_memberships
  set status = 'regular', regular_since = now(), updated_at = now()
  where club_id = p_club and user_id = p_user and status = 'requested';

  if not found then
    raise exception 'a pending membership request is required';
  end if;

  delete from public.club_join_votes where club_id = p_club and candidate_id = p_user;

  perform public.notify(
    p_user,
    'club_membership_approved',
    'You''re a regular in ' || v_club_title,
    'Your membership was approved. See what''s next with the club.',
    jsonb_build_object('href', '/clubs/' || p_club || '?welcome=1')
  );
end;
$$;
revoke execute on function public.approve_club_membership(uuid, uuid) from public, anon;
grant execute on function public.approve_club_membership(uuid, uuid) to authenticated;

create or replace function public.decline_club_membership(p_club uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club_title text;
  v_city text;
begin
  if not public.is_club_manager(p_club) then
    raise exception 'only the club host or a moderator can decide membership requests';
  end if;

  select title, city into v_club_title, v_city
  from public.clubs
  where id = p_club;

  update public.club_memberships
  set status = 'declined', updated_at = now(), show_on_profile = false
  where club_id = p_club and user_id = p_user and status = 'requested';

  if not found then
    raise exception 'a pending membership request is required';
  end if;

  delete from public.club_join_votes where club_id = p_club and candidate_id = p_user;

  perform public.notify(
    p_user,
    'club_membership_declined',
    'Update on ' || v_club_title,
    'The club went another way this time - it says nothing about you. There are more clubs near ' || coalesce(v_city, 'you') || ' that would be lucky to have you.',
    jsonb_build_object('href', '/clubs?city=' || coalesce(v_city, ''))
  );
end;
$$;
revoke execute on function public.decline_club_membership(uuid, uuid) from public, anon;
grant execute on function public.decline_club_membership(uuid, uuid) to authenticated;
