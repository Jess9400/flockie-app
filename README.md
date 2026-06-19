# Flockie — app

The authenticated Flockie product (Next.js + Supabase). Deploys to app.findflockie.com.
See `supabase/schema.sql` for the database and `.env.local.example` for required env vars.

## Onboarding vibe check

New sign-ins move through a short profile-build flow and five-question vibe check before the existing full profile onboarding. Apply `supabase/onboarding-vibe-check.sql` in the Supabase SQL Editor before deploying this flow.

The migration is additive: it adds birthday and early-vibe result fields to `profiles`, plus the `vibe_responses` table used for save-and-resume behavior.
