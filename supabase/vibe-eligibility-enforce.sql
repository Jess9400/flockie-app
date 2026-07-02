-- Vibe eligibility enforcement: the host's gender/age preferences, checked at
-- every funnel entry point. Run in the Supabase SQL editor BEFORE re-running
-- vibe-interests-status-lock.sql (whose INSERT policy now calls this helper).
-- Safe to re-run.
--
-- Before this, gender_pref / age_min / age_max were only enforced by the cold
-- same-city fallback (and even there the age filter had been lost) — the main
-- funnel (interest button → _rank_vibe_core shortlist → recommended_vibes)
-- ignored them entirely, so e.g. men could be shortlisted for women-only vibes.
--
-- vibe_eligible(user, vibe) — does the user's profile satisfy the vibe's
-- gender_pref / age_min / age_max?
--   * no prefs set (or gender_pref = 'any')  -> eligible
--   * gender_pref set, gender unknown        -> NOT eligible (the host explicitly
--       restricted; same semantics as invite_city_fallback's inline gender check)
--   * age range set, age unknown             -> eligible (matches the age filter
--       the matching SQL has always used: null age passes)
-- Used by: _rank_vibe_core (vibe-v2-private-link.sql), recommended_vibes
-- (recommended-vibes.sql), invite_city_fallback (vibe-auto-matching.sql), the
-- vibe_interests INSERT policy (vibe-interests-status-lock.sql), and the
-- InterestButton pre-check in the app.

create or replace function public.vibe_eligible(p_user uuid, p_vibe uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.vibes v
    left join public.profiles p on p.id = p_user
    where v.id = p_vibe
      and (v.gender_pref is null or v.gender_pref = 'any'
           or (v.gender_pref = 'women' and p.gender = 'woman')
           or (v.gender_pref = 'men' and p.gender = 'man'))
      and (v.age_min is null or p.age is null or p.age >= v.age_min)
      and (v.age_max is null or p.age is null or p.age <= v.age_max)
  );
$$;
grant execute on function public.vibe_eligible(uuid, uuid) to authenticated;
