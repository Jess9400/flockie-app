-- Follow-up to rpc-anon-lockdown.sql — from the 2026-08-04 security audit.
--
-- (1) [HIGH] The matching-engine INTERNALS were executable by any signed-in
--     user with no host/identity check: POST /rpc/backfill_vibe (etc.) with a
--     victim's vibe id could force lifecycle transitions, fire 24h invites,
--     bypass the host review window, and mass-notify a whole city. They only
--     ever run inside other SECURITY DEFINER functions (which execute as the
--     owner and need no caller EXECUTE), so revoke callers entirely. The
--     host-gated entry points (rank_vibe, host_commit_matching) keep their
--     authenticated grants and still work.
-- (2) [REGRESSION] The lockdown's revoke loop also stripped anon from
--     submit_vouch, breaking the logged-out friend-vouch page. Restore it —
--     the function is token-gated (writes only against a valid vouch_token),
--     which is why it was anon-callable in the first place.
--
-- Run in the Supabase SQL editor. Safe to re-run.

revoke execute on function public._rank_vibe_core(uuid) from public, anon, authenticated;
revoke execute on function public.backfill_vibe(uuid) from public, anon, authenticated;
revoke execute on function public.invite_city_fallback(uuid) from public, anon, authenticated;
revoke execute on function public.commit_vibe_matching(uuid) from public, anon, authenticated;
revoke execute on function public._vibe_algo_remaining(uuid) from public, anon, authenticated;

grant execute on function public.submit_vouch(uuid, text, int, int, int, int, int, int, text[], text[], text[], text, text) to anon;

-- Verify (both should error with "permission denied" for authenticated users
-- calling internals via PostgREST, and the vouch page should work logged out):
--   select has_function_privilege('authenticated', 'public.backfill_vibe(uuid)', 'execute');  -- false
--   select has_function_privilege('anon', 'public.submit_vouch(uuid,text,int,int,int,int,int,int,text[],text[],text[],text,text)', 'execute');  -- true
