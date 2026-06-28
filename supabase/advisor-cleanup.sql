-- Supabase Security Advisor cleanup (2026-06-28). Run in the SQL editor.
-- Safe to re-run.
--
-- Addresses the genuine, zero-risk items from the advisor:
--   1. function_search_path_mutable on public.set_updated_at  (pin search_path)
--   2. anon/authenticated SECURITY DEFINER exposure of INTERNAL-only functions
--      (cron jobs, triggers, the notify() helper). These are never called from
--      the client (verified against src/), so revoking EXECUTE from every role
--      removes them from BOTH the 0028 (anon) and 0029 (authenticated) lists
--      with no chance of breaking a flow. They still run fine: cron runs as the
--      job owner, triggers fire as the table owner, and notify() is only ever
--      called from inside other SECURITY DEFINER functions (which execute as the
--      function owner, not the caller — so the caller never needs EXECUTE).
--
-- NOT touched here (intentional — see CHANGES / advisor triage):
--   • The ~80 authenticated-callable RPCs (0029) — that IS the app's API surface,
--     each gated internally on auth.uid(). "Intentional" per the linter's own note.
--   • get_vouch_subject / submit_vouch / public_vibe — genuinely need anon
--     (the /vouch and /invite pages are public, logged-out routes).
--   • postgis / pg_trgm extension_in_public and st_estimatedextent — managed by
--     the PostGIS extension; moving them is high-risk and low-value.

-- 1. Pin search_path on the updated_at trigger function.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Lock down internal-only functions: no client role should reach these.
do $$
declare
  fn text;
  internal_fns text[] := array[
    -- cron jobs
    'autofill_open_vibes()',
    'auto_rank_due_vibes()',
    'auto_commit_due_reviews()',
    'send_review_reminders()',
    'expire_invitations()',
    -- trigger functions
    'handle_new_user()',
    'trips_creation_gate()',
    'set_updated_at()',
    -- internal helper, only ever called from other definer functions
    'notify(uuid, text, text, text, jsonb)'
  ];
begin
  foreach fn in array internal_fns loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;
