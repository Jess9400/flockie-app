# Phase 2 backlog (implement later)

Deferred items captured during the pre-launch build. Tier-1 transactional email is
already live (see `supabase/email-notify-trigger.sql`, `src/app/api/email/`).

## Email notifications — Tier 2 (retention)
> How: for event-driven ones, add the notification `type` to the `EMAILABLE` map in
> `src/lib/email/templates.ts` (+ a CTA label). For time-based ones, add a cron that
> inserts the notification (the trigger then emails it).

- **Review reminders ⭐** — *easiest win.* The types `vibe_review_reminder`,
  `buddy_review_reminder`, and `vibe_review_ready` **already exist** (created by the
  `send_review_reminders` cron). Emailing them = literally adding those 3 strings to
  `EMAILABLE`. Directly serves the "motivate reviews" goal.
- **"Your Vibe is tomorrow"** — new cron that inserts a reminder notification for
  Vibes starting in ~24h (reduces no-shows).
- **New chat message while away** — throttled: only if a message is unread after
  ~15 min AND the user isn't active. Needs batching/debounce (don't email per
  message). Types: `vibing_message` / buddy message.

## Email notifications — Tier 3 (marketing, opt-out)
- **Weekly "Vibes near you" digest** — weekly cron querying `recommended_vibes` per
  user → one batched email. Respect `email_notifications` opt-out (consider a
  separate marketing opt-in flag for stricter compliance).

## Other deferred (flagged during build, none blocking launch)
- **Flock detail page** (`/flocks/[tripId]`) — full description + member
  languages/ages/host rating before requesting. (Cards now show key chips + a
  description preview; this is the richer "read more" view.)
- **Multi-activity Vibes** — `vibes.categories[]` is stored + shown in the form;
  still TODO: show all activities on vibe cards/detail, and optionally let
  `vibe_match` consider all categories (currently the primary `category` only).
- **`/about` page** (founder bios + roadmap). Footer BETA tag already done.
- **Publish full beta Privacy/Terms drafts** — live pages are the corrected short
  versions; the comprehensive drafts (see `docs/legal-copy-corrections.md`) aren't
  published yet.
- **Leaked-password protection** — Supabase Pro-only toggle; enable when on a paid
  plan (signup is Google-only today).
- **"Reviews to complete" banner** — a single prompt aggregating pending vibe/flock/
  buddy reviews on profile or home (currently scattered: in-app notif + post-trip gate
  + per-event buttons).
