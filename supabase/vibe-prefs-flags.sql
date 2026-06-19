-- Gated-form completion flags for the 3-form vibe redesign.
-- The app degrades open (no gate) until these columns exist, so this can be
-- run any time. After running, the Trip/Activity wizards set them on finish.

alter table public.profiles
  add column if not exists trip_prefs_complete boolean not null default false,
  add column if not exists activity_prefs_complete boolean not null default false;

-- Backfill: anyone who already finished the old combined vibe check and has
-- travel answers is treated as having done the trip vibe; anyone with picked
-- activities is treated as having done the activity vibe. Adjust if undesired.
update public.profiles
  set trip_prefs_complete = true
  where coalesce(onboarding_complete, false)
    and planning is not null;

update public.profiles
  set activity_prefs_complete = true
  where coalesce(array_length(activities, 1), 0) > 0;
