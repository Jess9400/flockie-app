# Phase 2 backlog (implement later)

Deferred items captured during the pre-launch build. Tier-1 transactional email is
already live (see `supabase/email-notify-trigger.sql`, `src/app/api/email/`).

## Email notifications - Tier 2 (retention)
> How: for event-driven ones, add the notification `type` to the `EMAILABLE` map in
> `src/lib/email/templates.ts` (+ a CTA label). For time-based ones, add a cron that
> inserts the notification (the trigger then emails it).

- **Review reminders ⭐** - *easiest win.* The types `vibe_review_reminder`,
  `buddy_review_reminder`, and `vibe_review_ready` **already exist** (created by the
  `send_review_reminders` cron). Emailing them = literally adding those 3 strings to
  `EMAILABLE`. Directly serves the "motivate reviews" goal.
- **"Your Vibe is tomorrow"** - new cron that inserts a reminder notification for
  Vibes starting in ~24h (reduces no-shows).
- **New chat message while away** - throttled: only if a message is unread after
  ~15 min AND the user isn't active. Needs batching/debounce (don't email per
  message). Types: `vibing_message` / buddy message.

## Email notifications - Tier 3 (marketing, opt-out)
- **Weekly "Vibes near you" digest** - weekly cron querying `recommended_vibes` per
  user → one batched email. Respect `email_notifications` opt-out (consider a
  separate marketing opt-in flag for stricter compliance).

## Other deferred (flagged during build, none blocking launch)
- **Flock detail page** (`/flocks/[tripId]`) - full description + member
  languages/ages/host rating before requesting. (Cards now show key chips + a
  description preview; this is the richer "read more" view.)
- **Multi-activity Vibes** - `vibes.categories[]` is stored + shown in the form;
  still TODO: show all activities on vibe cards/detail, and optionally let
  `vibe_match` consider all categories (currently the primary `category` only).
- **`/about` page** (founder bios + roadmap). Footer BETA tag already done.
- **Publish full beta Privacy/Terms drafts** - live pages are the corrected short
  versions; the comprehensive drafts (see `docs/legal-copy-corrections.md`) aren't
  published yet.
- **Leaked-password protection** - Supabase Pro-only toggle; enable when on a paid
  plan (signup is Google-only today).
- **"Reviews to complete" banner** - a single prompt aggregating pending vibe/flock/
  buddy reviews on profile or home (currently scattered: in-app notif + post-trip gate
  + per-event buttons).

## Feed moderation & safety - next version (added 2026-07-24)
Post reporting shipped in v1 (`report_post` → `post_reports`, flag icon on
others' posts; user reports were already in `user_reports`). What v1 does NOT
do yet - build these before the feed scales past trusted beta users:

- **Report alerting** - nothing notifies anyone when a report lands. Options:
  notify founder accounts in-app, or a weekly digest email. Until then, review
  manually: `select * from post_reports order by created_at desc;` (same for
  `user_reports`).
- **Admin review flow** - a minimal internal surface (or SQL runbook) to view a
  reported post, delete it (`delete from posts where id = …` as service role),
  and record the outcome. Currently deletion is manual SQL only.
- **Hide-on-N-reports** - auto-hide a post from `feed_posts` once it has ≥N
  distinct reports pending review (cheap `not exists` clause in the RPC).
- **Block user → feed** - blocking someone should also hide their posts and
  comments from the blocker's feed (feed_posts/user_posts don't consult
  hard-block or reports today).
- **Comment reporting/deletion** - comments can only be deleted by their author;
  no report flag and the post author can't remove comments on their own post.
- **Photo moderation** - post photos upload to the public avatars bucket with
  no scanning. At scale: dedicated bucket + moderation (e.g. a vision-model
  check) before display.
- **Rate limits** - create_post / add_post_comment / toggle_follow have no
  rate_limit_hit guard (spam vector). Add buckets like the geocode routes use.
- **Legal** - Terms already cover UGC (What you can/can't post). When a formal
  DSA/DMCA-style notice channel is needed, add a report-abuse email address to
  the Terms.

## Trip Workspace - the trip/flock chat becomes the planning HQ (founder idea, 2026-07-25)
When trips unpark, the trip/flock chat grows from a message stream into the
group's workspace. Everything shared among everyone going:

- **Agenda / calendar** - day-by-day trip schedule, anyone can add items; the
  chat pins "today's plan."
- **Shared checklist** - packing/booking todos, assignable per member
  ("Marco: book the van"), check-off visible to all.
- **Costs ledger (Splitwise-style)** - who paid what, who owes whom. LEDGER
  ONLY, link out to settle (no payments/wallet - regulated territory; matches
  the communities-plan §5 note).
- **Deals widgets in context** - the Deals affiliate blocks (stays for these
  dates/city, activities, flights, car) embedded in the trip workspace. This
  is affiliate revenue exactly where booking intent lives - likely the
  strongest monetization surface of the trips product.
- Data model sketch: trip_agenda_items, trip_checklist_items (assignee),
  trip_expenses (payer, amount, split_with[]), all keyed on trip_id with
  member-only RLS (trip_join_requests accepted + host).

Effort: multiple sessions. Build AFTER trips unpark; the board (shipped
2026-07-25) is the funnel that would justify it.
