-- P1 FIX (2026-07-02): stop attendance enumeration via vibe_interests.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Before this, the "interests read" SELECT policy included an unscoped
-- `or status = 'confirmed'` - any signed-in user could query
-- `vibe_interests?user_id=eq.X&status=eq.confirmed` and enumerate ANYONE's
-- confirmed vibes (raw rows: vibe_id + timestamps), deriving their future
-- whereabouts across the whole app.
--
-- Fix: the table policy now only allows own rows and the vibe host. The two
-- legitimate public surfaces move behind SECURITY DEFINER RPCs that expose
-- only safe, per-vibe data:
--   • vibe_attendees(p_vibe)         - the "Going" strip on the vibe page
--                                      (id, display_name, photos via the safe
--                                      public_profiles view)
--   • vibe_confirmed_counts(p_vibes) - aggregate "X going" counts for vibe
--                                      cards (home / vibes list / my-vibes);
--                                      no user ids leave the database.

-- ── attendee strip: confirmed attendees of one vibe (safe fields only) ─────
-- Reads `profiles`, NOT `public_profiles` (2026-08-20). The safe view hides
-- anyone whose onboarding is unfinished, which is correct for discovery but
-- wrong here: those people are counted in the tallies, so the host saw
-- "Going (4) - 6 confirmed attendance" and two attendees with no face. Who is
-- coming is not a discovery question. Same three safe fields either way.
create or replace function public.vibe_attendees(p_vibe uuid)
returns table (id uuid, display_name text, photos text[])
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos
  from public.vibe_interests i
  join public.profiles p on p.id = i.user_id
  where i.vibe_id = p_vibe
    and i.status = 'confirmed'
  order by i.confirmed_at nulls last, i.created_at;
$$;
revoke all on function public.vibe_attendees(uuid) from public, anon;
grant execute on function public.vibe_attendees(uuid) to authenticated;

-- ── host roster lookup: names/photos for people on the host's own vibe ─────
-- The host panels (shortlist, private requests, invited & going) looked these
-- up through `public_profiles` and silently dropped unfinished profiles from
-- lists the host must act on. Host-only, one vibe, safe fields.
create or replace function public.vibe_people(p_vibe uuid, p_ids uuid[])
returns table (id uuid, display_name text, photos text[])
language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, p.photos
  from public.profiles p
  where p.id = any (p_ids)
    and exists (
      select 1 from public.vibes v
      where v.id = p_vibe and v.host_id = auth.uid()
    )
    and exists (
      select 1 from public.vibe_interests i
      where i.vibe_id = p_vibe and i.user_id = p.id
    );
$$;
revoke all on function public.vibe_people(uuid, uuid[]) from public, anon;
grant execute on function public.vibe_people(uuid, uuid[]) to authenticated;

-- ── card counts: confirmed ("going") tallies for a set of vibes ────────────
create or replace function public.vibe_confirmed_counts(p_vibes uuid[])
returns table (vibe_id uuid, going int)
language sql security definer set search_path = public stable as $$
  select i.vibe_id, count(*)::int as going
  from public.vibe_interests i
  where i.vibe_id = any (p_vibes)
    and i.status = 'confirmed'
  group by i.vibe_id;
$$;
revoke all on function public.vibe_confirmed_counts(uuid[]) from public, anon;
grant execute on function public.vibe_confirmed_counts(uuid[]) to authenticated;

-- ── scoped SELECT policy: own rows + the vibe host only ────────────────────
-- (Canonical definition - the old broad version in vibes-module.sql is
-- tombstoned so a re-run there can't re-open the table.)
drop policy if exists "interests read" on public.vibe_interests;
create policy "interests read" on public.vibe_interests for select to authenticated
  using (
    user_id = auth.uid()
    or auth.uid() = (select host_id from public.vibes v where v.id = vibe_id)
  );
