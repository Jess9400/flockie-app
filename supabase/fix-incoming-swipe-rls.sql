-- Fix: invitees couldn't see the "Match back & chat" button.
--
-- The /people/[id] page detects an incoming like by reading the other user's
-- swipe row (swiper_id = them, target_id = me). The existing "own swipes" policy
-- only allows reading rows where swiper_id = auth.uid(), so that read was blocked
-- by RLS and the match-back button never showed.
--
-- Add a SELECT-only policy so you can also READ swipes that target you. Writes
-- (insert/update/delete) stay restricted to your own rows via the existing
-- "own swipes" policy. Run in the Supabase SQL editor. Safe to re-run.
--
-- P2 FIX (2026-07-02): scope the incoming clause with `and liked`. The first
-- version exposed ALL rows where target_id = auth.uid(), so users could also see
-- who swiped NO on them. The app only ever needs incoming liked=true rows
-- (the match-back check on /people/[id]).

drop policy if exists "see incoming swipes" on public.buddy_swipes;
create policy "see incoming swipes" on public.buddy_swipes
  for select to authenticated
  using (swiper_id = auth.uid() or (target_id = auth.uid() and liked));
