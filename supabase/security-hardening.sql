-- Hardening: add WITH CHECK to UPDATE policies so the post-update row is
-- re-validated against the same condition (otherwise a user could UPDATE a row
-- they own and set host_id / user_id to someone else). Run in the Supabase SQL
-- editor. Safe to re-run.

drop policy if exists "vibes host update" on public.vibes;
create policy "vibes host update" on public.vibes for update to authenticated
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

drop policy if exists "interests self update" on public.vibe_interests;
create policy "interests self update" on public.vibe_interests for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
