# Authentication (current)

**As of 2026-06-19, Flockie supports Google sign-in only.**

## Why
Email/password was removed for launch. Rationale (co-founder decision):
- Forgotten-password / reset flows generate the most support load for a tiny team.
- Email confirmation adds a drop-off step and a "check your email, then come back" gap.
- Google is one tap, no password to forget, verified email, and a profile photo/name we can prefill.

## How it works
- **Login page:** `src/app/login/page.tsx` — a single **"Continue with Google"** button on the navy hero, plus passive "By continuing, you agree to Terms & Privacy" text (no checkbox gate).
- **OAuth:** `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: \`${origin}/auth/callback?next=<redirect>\` } })`.
- **Callback:** `src/app/auth/callback/route.ts` exchanges the code and redirects to `next` (defaults `/match`). Deep links (e.g. invite → `/vibes/[id]?interested=1`) are preserved via the `redirect`/`next` param set by the middleware and login page.
- **Terms:** `localStorage["flockie-pending-terms"]` is set before the Google redirect so terms acceptance can be recorded for brand-new accounts after callback.

## What was removed (vs. the previous version)
The email/password UI and handlers were deleted from `src/app/login/page.tsx`:
- `signin`/`signup` mode toggle
- email + password inputs and the `<form onSubmit={handleEmail}>`
- `supabase.auth.signUp(...)` and `supabase.auth.signInWithPassword(...)` calls
- the "agree to Terms" **checkbox gate** (replaced by passive text)
- the "Already have an account? / New here?" toggle

The Supabase **Email** auth provider can stay enabled in the dashboard (harmless) — there's just no UI for it. Re-enabling the UI is the v2 task; see **`docs/V2-EMAIL-AUTH.md`**.

## Supabase config that must stay correct
- **Google** provider enabled with the correct Client ID/Secret.
- Auth → URL Configuration → **Site URL** `https://app.findflockie.com` and **Redirect URLs** include `https://app.findflockie.com/**` (and `http://localhost:3000/**` for dev).
