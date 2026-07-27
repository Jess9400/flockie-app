-- Cleanup (2026-07-02): drop the legacy buddy-matching functions from
-- supabase/buddy-matching.sql. Run in the Supabase SQL editor. Safe to re-run.
--
-- These were the original flat-weight deck - no hard-block filtering, still
-- granted to authenticated, and unused by the client. Canonical replacements:
--   • buddy_candidates_trip            (supabase/match-priorities.sql)
--   • buddy_swipe(uuid, boolean, text) (supabase/buddy-swipe-notify-once.sql)
--
-- Signatures are exact so the live 3-arg buddy_swipe(uuid, boolean, text)
-- is untouched.

drop function if exists public.buddy_city_count();
drop function if exists public.buddy_candidates(int);
drop function if exists public.buddy_swipe(uuid, boolean);
