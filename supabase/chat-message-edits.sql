-- ============================================================================
-- Flockie - Let a sender edit or delete their own messages, in every chat type
-- (1:1/flock buddy_messages, vibe vibing_messages, club club_messages).
-- Adds edited_at + own-row UPDATE/DELETE policies. Run in the SQL editor.
-- Idempotent.
-- ============================================================================

do $$
declare tbl text;
begin
  foreach tbl in array array['buddy_messages','vibing_messages','club_messages'] loop
    execute format('alter table public.%I add column if not exists edited_at timestamptz', tbl);

    execute format('drop policy if exists "msg edit own" on public.%I', tbl);
    execute format('create policy "msg edit own" on public.%I for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid())', tbl);

    execute format('drop policy if exists "msg delete own" on public.%I', tbl);
    execute format('create policy "msg delete own" on public.%I for delete to authenticated using (sender_id = auth.uid())', tbl);
  end loop;
end $$;

notify pgrst, 'reload schema';
