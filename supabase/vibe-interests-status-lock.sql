-- P0 FIX (2026-06-28): lock the vibe_interests self-write policies to status
-- 'interested' only. Run in the Supabase SQL editor. Safe to re-run.
--
-- Before this, the INSERT/UPDATE policies only checked `user_id = auth.uid()`, so
-- any signed-in user could directly POST/PATCH their own interest row to
-- status='confirmed' for ANY vibe — bypassing the invite/matching/capacity flow
-- and unlocking exact GPS (public.vibe_private_logistics) + the vibe chat
-- (public.is_vibe_member) with no host approval.
--
-- The UI only ever inserts status='interested' (InterestButton) and deletes.
-- All privileged transitions run through SECURITY DEFINER RPCs that bypass RLS,
-- so this change breaks nothing legitimate.

drop policy if exists "interests self insert" on public.vibe_interests;
create policy "interests self insert" on public.vibe_interests for insert to authenticated
  with check (user_id = auth.uid() and status = 'interested');

drop policy if exists "interests self update" on public.vibe_interests;
create policy "interests self update" on public.vibe_interests for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'interested');

-- OPTIONAL audit — find rows whose status was self-elevated WITHOUT a matching
-- invitation timestamp (i.e. set outside the RPC flow). Review before deleting.
-- select vi.* from public.vibe_interests vi
--   where vi.status = 'confirmed' and vi.invitation_sent_at is null;
