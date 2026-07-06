-- Store each vibe's timezone (IANA, e.g. 'Asia/Kolkata') captured from the host's
-- browser at creation. starts_at is a UTC instant; pairing it with the timezone
-- lets emails (server-rendered in UTC) and cross-timezone viewers show the correct
-- LOCAL time instead of a wrong hour. Existing vibes stay null → callers fall back
-- to date-only. Idempotent.
alter table public.vibes add column if not exists timezone text;
