-- Extra Vibe fields: what to bring / cost split, event language, age range.
-- Run in the Supabase SQL editor before deploying. Safe to re-run.

alter table public.vibes
  add column if not exists what_to_bring text,
  add column if not exists language text,
  add column if not exists age_min int,
  add column if not exists age_max int;
