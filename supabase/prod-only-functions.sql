-- Prod-only objects - schema-drift capture (2026-07-02).
--
-- These objects EXISTED on production but had NO definition in the repo - the
-- same drift class that previously hid the `trip_join_requests using (true)`
-- hole. Captured 2026-07-02 by dumping them from prod (pg_get_functiondef /
-- information_schema / pg_constraint / pg_policies) and transcribing here.
--
-- ⚠️ They ALREADY EXIST on prod - you do NOT need to re-run this file there.
-- Its purpose is (a) code review and (b) making a fresh database reproducible.
-- For a fresh DB, run this AFTER the core schema (it references profiles, vibes,
-- vibing_chats, vibing_messages, and is_vibe_member).
--
-- Security review (2026-07-02) - all clean:
--   • set_my_location   - writes profiles.location for auth.uid() ONLY; sp pinned.
--   • accept_terms      - stamps auth.uid() only; coalesce() won't overwrite an
--                         earlier consent time.
--   • get_or_create_chat- gates on is_vibe_member before returning/creating.
--   • vibe_chat_summaries- filters `where is_vibe_member(c.vibe_id)`; only the
--                         caller's chats are returned.
--   • chat_reads        - RLS on; policy scoped to user_id = auth.uid().
-- Note: profiles.location (exact GPS) is written here but never exposed - the
-- profiles SELECT policy is owner-only and public_profiles excludes location.

-- ── chat_reads: per-(user,chat) read cursor (written by mark_chat_read) ──────
create table if not exists public.chat_reads (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  chat_id      uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);
-- (Prod has no FK on chat_id - it spans vibing_chats/buddy_chats - so none here.)

alter table public.chat_reads enable row level security;
drop policy if exists "own reads" on public.chat_reads;
create policy "own reads" on public.chat_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── set_my_location: write my own GPS point ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_my_location(p_lng double precision, p_lat double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  begin
    update public.profiles
      set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      where id = auth.uid();
  end
$function$;

-- ── accept_terms: stamp legal-consent time (once) ───────────────────────────
CREATE OR REPLACE FUNCTION public.accept_terms()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  begin
    update public.profiles set terms_accepted_at = coalesce(terms_accepted_at, now())
    where id = auth.uid();
  end
$function$;

-- ── get_or_create_chat: membership-gated vibe chat lookup/creation ──────────
CREATE OR REPLACE FUNCTION public.get_or_create_chat(p_vibe uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  declare cid uuid;
  begin
    if not public.is_vibe_member(p_vibe) then raise exception 'not a member'; end if;
    select id into cid from public.vibing_chats where vibe_id = p_vibe;
    if cid is null then
      insert into public.vibing_chats (vibe_id) values (p_vibe)
        on conflict (vibe_id) do nothing returning id into cid;
      if cid is null then select id into cid from public.vibing_chats where vibe_id = p_vibe; end if;
    end if;
    return cid;
  end
$function$;

-- ── vibe_chat_summaries: the caller's vibe chats + unread counts ────────────
-- (The RETURNS TABLE tail - last_at / unread - was reconstructed from the body,
--  since the prod dump was truncated in the viewer.)
CREATE OR REPLACE FUNCTION public.vibe_chat_summaries()
 RETURNS TABLE(vibe_id uuid, chat_id uuid, title text, photo text, starts_at timestamptz, last_at timestamptz, unread int)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.id, c.id, v.title, (v.photos)[1], v.starts_at,
    coalesce(lm.last_at, c.created_at) as last_at,
    coalesce((select count(*) from public.vibing_messages m
      where m.chat_id = c.id and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select last_read_at from public.chat_reads r
          where r.user_id = auth.uid() and r.chat_id = c.id), 'epoch')), 0)::int
    from public.vibing_chats c
    join public.vibes v on v.id = c.vibe_id
    left join lateral (
      select max(created_at) last_at from public.vibing_messages m where m.chat_id = c.id
    ) lm on true
    where public.is_vibe_member(c.vibe_id)
    order by last_at desc;
$function$;
