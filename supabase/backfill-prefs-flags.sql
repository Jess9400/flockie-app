-- P1 fix: backfill the prefs-complete flags for legacy users who finished the
-- vibe forms before the flag columns existed. Without this they're gated out of
-- matching (/match trip mode requires trip_prefs_complete) while their profile
-- shows the vibe tab as complete — a dead end.
--
-- Uses the app's own "filled" definition (ProfileTabs): trip vibe is done when
-- `planning` is set; activity vibe is done when `activities` is non-empty.
-- Pure data backfill. Safe to re-run.

update public.profiles
set trip_prefs_complete = true
where coalesce(trip_prefs_complete, false) = false
  and planning is not null;

update public.profiles
set activity_prefs_complete = true
where coalesce(activity_prefs_complete, false) = false
  and coalesce(array_length(activities, 1), 0) > 0;
