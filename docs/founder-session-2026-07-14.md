# Flockie — Founder Session Prep (for Taisiya) — 2026-07-14

Working doc for our next sync. Covers: what shipped from the Poker Night test, our friend's review, a fresh platform audit (UX/IA/flow/algo), the **onboarding-is-too-long** fix (with exact keep/cut question lists), shelving Find‑a‑Buddy, known gaps, and the Communities MVP. Ends with a decisions-needed list.

> Guiding principle for this round: **keep it simple and usable for a total newbie who just wants to join one event.** Everything below is measured against that.

---

## 0. TL;DR & priority triage

**The whole doc in three sentences:** The platform *works* (the Poker Night test proved the core loop end-to-end), but it's **too complex for a newbie** — 24-screen onboarding, 7 overlapping products, and copy that contradicts itself about who decides who gets in. The single biggest unlock is to **become Vibes-only for now** (shelve Find-a-Buddy behind "Soon") and **cut onboarding to ~4 questions** — that alone fixes or shrinks most of the friend's list. Everything else is a prioritized clean-up behind those two moves.

### 🔑 Two strategic decisions that gate everything (need you + Taisiya)
1. **Shelve Find-a-Buddy behind "Soon"** → app becomes Vibes-only. Unlocks the onboarding cut; kills the 4-products confusion, the nav-label mismatch, and the numeric-ratings surface at once. *(This is the local-belonging vs travel-matching fork — a conscious call.)* → §5
2. **Cut onboarding to Profile + 5-question quiz + reveal**, make the short path the default, trim the activity form 9→4. Defer trip/personality forms to Buddy launch. → §4

### ⚡ Quick wins — copy / small code, low-risk, high-trust (can ship this week without a decision)
| Fix | Why it matters | Where |
|---|---|---|
| "Confirm within **24 hours**" → dynamic ("{hours}h") | Copy is a code-confirmed **lie** (real window is 6h/1h) — erodes trust | §3b.8c |
| One honest **host-vs-algorithm** sentence everywhere; delete "no host approval needed" | Two contradictory models ship on the *same screen* | §3b.8d |
| Remove numeric **`4.8 (12)`** stars from Find-a-Buddy cards; delete dead `ProfileReviews` | Violates the "don't rate people" decision | §3b.7 |
| Don't show **"Join now"** on the public invite page | Bait-and-switch (downgrades to "I'm interested" on the vibe page) | §3b.8e |
| Delete the orphan **"Join a vibe"** heading on Home; remove the **duplicate category chip** on cards | Broken hierarchy / wasted space | §3b.2–3 |
| One label for `/match`, one active-nav color; lock **"Vibe" = event** casing | Same thing has 3 names; word is overloaded | §3b.1, §2 #5 |
| Inbox: relative **timestamps + countdown**; **Undo** on dismiss | Users can't tell if a window's open; one tap deletes an invite forever | §3b.5 |

### 🛠️ Medium — real UX work, a few days each (behind the two decisions)
- **Strip the vibe card** to a title/date/location spine + one signal. → §3b.3
- **Home** → one hero CTA + ~3 blocks (not 5 carousels). → §3b.2
- **Collapse the join flow** (4 modals/prompts → 1–2). → §3b.8b
- **Status clarity** — progress stepper (Interested → Shortlisted → Invited), sticky Join bar, recolored waiting states. → §3b.8a
- **Inbox** — tappable cards + a "Dismissed" archive + grouping. → §3b.5

### 🎯 Bigger bets — design + decision (the roadmap after the cleanup)
- **Onboarding redesign** (4-question form + progressive profiling). → §4
- **Split Profile** (public `/profile` vs `/settings`). → §3b.6
- **Collapse nav/IA** to one 5-item model. → §3b.1
- **Communities** new tab (turn-a-vibe-into-a-club + auto-heartbeat). → §7

> **Suggested order:** decide the two gates (§4–§5) → ship the ⚡ quick wins (mostly copy, big trust payoff) → then the 🛠️ medium cleanup → then the 🎯 bigger bets. Read on for the full evidence behind each.

---

## 1. What shipped since last sync (Poker Night live test + fixes)

All live on prod unless noted.

**Reliability / security**
- 🔒 **RLS fix** on `trip_join_requests` (was API-exposed — advisor P0). Full-schema RLS audit now clean.
- Confirmed the Supabase project URL / anon key being public is normal (not a leak); `service_role` verified server-only.

**Vibe experience**
- ⏰ **Timezone fix everywhere** — vibe times now render in the *vibe's own* timezone (card, detail page, chat header, My Vibes, invite link, emails). Before, the detail page showed UTC (e.g. "11:30am" instead of "5pm").
- 📍 **Location system rebuilt** (this ate most of the test):
  - New vibes **auto-pin exact coordinates at creation** (client-side Google Places, works any city).
  - **City auto-fills from the venue, not the host's profile** (root cause of a Bengaluru vibe inheriting "Thane").
  - Map links are **coordinate pins** (no more messy address / hotel-search).
  - Confirmed attendees get a **tappable Google Maps link** on the vibe page; confirmation + reminder **emails carry a map link**.
- ✉️ **New 6-hour "starts soon" reminder email** (address + map) to confirmed guests, on top of the 24h "tomorrow" reminder.
- ⚡ **One-tap join**: after matching, a same-city person tapping "I'm interested" is **instantly confirmed** ("Join now"); different-city falls back to soft interest (never silently confirmed into an out-of-town event).
- 🔄 **Late-joiner backfill**: if standby is exhausted and a seat opens, a genuine late "interested" person is auto-promoted (first-come-first-serve — deliberate, so last-minute joiners get in fast).
- ➕ **Host can edit spots (capacity)** from the vibe settings.
- 🗂️ **My Vibes redesign**: split into **You're going** (confirmed upcoming), **In the running** (pending), **Past Vibes** (now includes vibes you *attended*, not just hosted).

**Manual data ops on the Poker Night test vibe** (one-offs, documented so they're not mistaken for features): pulled 2 ghosted guests in as confirmed; backfilled the vibe's coordinates.

---

## 2. Friend's review (the ChatGPT audit) — problems + our solutions

Her 10 "most serious problems," each with a proposed fix. Several collapse into the two big moves in §4–§5.

| # | Problem (from the review) | Proposed solution |
|---|---|---|
| 1 | **Host vs algorithm is contradictory** — screens variously say the algo decides / the host picks / no approval. Real logic: algo shortlists → host may remove a few → invites go out. | Pick **one sentence** and use it everywhere: *"Our algorithm builds the guest list; the host can trim it; then invites go out."* Audit every surface (vibe page, emails, My Vibes, tooltips) to that one line. |
| 2 | **Invitation timing inconsistent** — copy says "24 hours," actual normal window is ~6h (and it's really dynamic, capped near start). | Make the copy **dynamic** — show the real countdown from `_vibe_confirm_deadline` ("Confirm by 5:30pm / in 4h") instead of a hardcoded "24 hours." Kill every hardcoded "24 hours" string. |
| 3 | **People still get numeric ratings** — Find a Buddy shows `4.8` despite the decision not to rate people like service providers. | **Shelving Find‑a‑Buddy (§5) removes this surface now.** When it returns, replace numeric scores with non-numeric trust signals (showed-up / vouches), never a star number. |
| 4 | **Dismissed notifications vanish** — still in DB, gone from the app. | Add a **"Earlier / dismissed"** section (or an archive toggle) in the inbox so history is recoverable. Low effort, we already store them. |
| 5 | **"Vibe" means too many things** — event, personality, match %, activity prefs, trip prefs, tags. | **Lock the vocabulary.** "Vibe" = *the event* only. Personality → "your vibe check" result; match → "% match"; tags → "tags." Do a copy pass to stop overloading the word. |
| 6 | **Mobile cards overloaded** — 9–11px text, many tags, %, host, capacity, location, status, ✕, two columns. | **Strip the card** to: image, title, day/time, one line (city · N going), one status chip. Move tags/%/host into the detail page. (See §3 UI.) |
| 7 | **Navigation changes meaning** — desktop "Find a Buddy" vs mobile "Match"; My Trips prominent on desktop, hidden in the mobile menu. | Solved largely by **§5** (Find‑a‑Buddy goes behind "Soon"). Otherwise: **one label per destination** across desktop/mobile; keep the drawer to the agreed 5 items. |
| 8 | **Find a Buddy = two levels of switches** (Buddy/Flock, Trip/Activity) — a newbie must grok 4 products before doing anything. | **§5 removes this entirely for now.** Ship Vibes as the single product; reintroduce Buddy later, one concept at a time. |
| 9 | **Home tries to show everything** — people, Vibes, Flocks, discovery, reviews, invitations, creation. | Home = **one job**: "Vibes near you this week" + one primary CTA. Push reviews/invites into the inbox, creation into a single + button. |
| 10 | **Profile feels like an admin dashboard** (esp. mobile). | Split **"Profile" (how others see you)** from **"Settings/Account" (admin)**. Profile = photo, name, vibe-check result, past vibes. Everything else → Settings. |

---

## 3. My own audit (UX / IA / flow / algo)

Beyond the friend's list:

**Onboarding (the biggest problem) — see §4 for the fix**
- **24 answer screens** before a newbie can meaningfully use the app. For someone who just wants to *join one event*, this is Tinder-length friction with none of Tinder's payoff. This is almost certainly the #1 driver of the "onboarding too long" complaints.

**Algo / data integrity**
- **`activity_skills` is used by matching but never collected.** `_rank_vibe_core` weights it **0.35** and `vibe_match` **0.12**, but **no onboarding step writes it** → it always falls back to neutral. So the biggest single weight in the host-shortlist ranking is effectively dead. **Decision:** either collect one skill question or **remove it from the algo and rebalance** (I recommend remove-for-now).
- **Dead/orphan fields** defined but unused: `travel_style`, `one_liner`/`activity_one_liner`, `relationship_status`. Safe to drop.
- **Dealbreaker lists are mostly decorative** — only 3–4 specific values are actually enforced (`buddy_hard_block`: same-gender travel/events, sober-only, drinking-fine). The other options collect but do nothing. Trim to what's enforced.

**Flow**
- **Confirm-window copy** ("24 hours") vs real dynamic window — same as friend's #2; it's a real trust bug (people think they have longer than they do).
- **Reviewing/limbo states** are invisible to guests (a vibe can sit in `reviewing` while a guest waits with no signal).

**UI**
- Cards, Home, Profile overload (matches friend's #6/#9/#10).
- "Soon"/empty states are missing — sections just vanish when empty instead of guiding a newbie.

**Synthesis:** the two moves in §4 (**shorten onboarding**) and §5 (**shelve Find‑a‑Buddy**) resolve or shrink the majority of both lists — #3, #7, #8 outright, and #1, #5, #9, #10 substantially (fewer products = less to explain, less contradictory copy).

---

## 3b. Deep UX/UI + flow teardown (screen by screen)

Grounded in the actual components. Each item: **current reality → why it hurts a newbie → concrete fix.**

### 3b.1 Information architecture / navigation
**Current:** there are **three parallel nav systems** (desktop left rail = 6 rows, mobile bottom bar = 5 tabs, top bar = logo/BETA/bell/avatar), and **the same destination has different labels**: `/match` is **"Find a Buddy"** on desktop but **"Match"** on mobile, and Home calls it **"Find a buddy for an activity."** **My Trips is on the desktop rail but dropped from the mobile bottom bar** (only reachable via hamburger). Active state is `flockie-blue` in the sidebar but `flockie-coral` in the bottom bar. Two separate unread badges (bell → `/inbox`, and a badge on the Chats tab). A user must hold **seven overlapping concepts**: Vibes, My Vibes, Buddies/Match, Flocks, My Trips, Activities, Deals.
**Hurts newbie:** they can't build a mental model — one thing has three names, a whole product branch hides on mobile, and two badges compete for "something needs me."
**Fix:** one **5-item model shared across breakpoints**, **one label per destination** (pick "Buddies" for `/match` everywhere), one active color, one notification surface. With Buddy shelved (§5), nav becomes: **Vibes · My Vibes · Inbox · Profile** (+ Create).

### 3b.2 Home
**Current:** a **wall of 5 back-to-back carousels** (people, near-you vibes, world vibes, flocks) — four of them "join a group" variants distinguished only by prose subtitles. There's an **orphan "Join a vibe" heading with no cards under it** (the vibes render under the *next* heading, "Happening near you"). The **hero has no CTA**. The "72% = vibe match" legend appears at the very top, far above the first % it explains. "Create a vibe" appears in a bottom triple-CTA card *and* in the floating +. "Vibe" is capitalized inconsistently within the same screen.
**Hurts newbie:** no single obvious next step; endless horizontal scrolling; two stacked headers before any content reads as broken.
**Fix:** give the hero **one primary CTA** ("Browse Vibes near you"); cut to **~3 blocks** (near-you Vibes, People, one "explore more"); delete the empty heading; move the % legend inline onto the first card that shows a %; drop the redundant bottom create card.

### 3b.3 Vibe browse + the card
**Current:** the card packs **~11 elements into a ~160px mobile cell** — category chip, status/rating chip, ✕ dismiss, title, date, location, up to 3 tags, +N overflow, host avatar, host name, capacity `N/cap`, and a "% match" pill — at type from **9px to 13px**. The **primary category is printed twice** (image chip *and* first body tag). Three near-identical numbers (capacity, match %, past rating) compete for meaning. Filtering is split across **three disconnected controls** (a separate search form, a "When"-only filter sheet, and an Upcoming/Past toggle), and category — which the card leans on — isn't filterable.
**Hurts newbie:** the densest layout lands on the smallest screens; sub-11px type is hard to read; they can't tell which "N" is people-going vs compatibility.
**Fix:** strip the card to a **title + date + location** spine, **one** category chip (remove the duplicate), host as an avatar-only credit, and **one** emphasized signal (promote match% or capacity, not both). Raise smallest type to ~11px, cap tags at 2 + overflow. Unify search + When + **Category** + Upcoming/Past into one filter surface.

### 3b.4 Onboarding — the #1 problem (expands §4)
**Current:** to reach the "100% complete" state the **reveal screen explicitly demands** (Lock icon: *"Your full reading unlocks at 100%"*), a new user goes through **~25 screens / 35+ taps**: Profile (5 required fields incl. **mandatory photo + crop** as the very first task) → 5-question quiz (well-designed, has a pause sheet) → reveal → **Trip vibe (9 separate screens)** → **Activity vibe (9 screens, opening on a 43-option grid, max 6)**. The two 9-page forms have **no ✕/skip during onboarding** (`onClose` isn't passed), most steps are `required`, single-selects auto-advance 160ms after a tap (a misclick jumps forward), and **there's no global progress** — Trip is "1 of 9," then Activity resets to "1 of 9." The **quick path still forces all 9 activity screens**.
**Hurts newbie who just wants to join one event:** mandatory photo+crop on screen 1, the 43-item grid, and discovering a *second* 9-page form after finishing the first are three hard bail points — and the result is *withheld* until they finish. This is the likeliest single cause of the "onboarding too long" complaints.
**Fix:** **onboarding = Profile + 5-question quiz + reveal.** Show the reading at 5 answers (you already compute "≈{percent}% confident") — **drop the "unlocks at 100%" gate.** Make Trip/Activity genuinely **post-signup** ("sharpen later"), pass `onClose`+"Skip for now," and collapse each 9-screen wizard to **~3–4 grouped pages** with one continuous progress bar. On the quick path, ≤3 activity taps or a "Join now, tune later" button.

### 3b.5 Inbox / notifications
**Current:** flat reverse-chron list, **no grouping** (a `weekly_digest` sits at equal weight next to a 24h-expiring invite). **Dismiss (×) is permanent with no history** — it writes `dismissed_at` and the query excludes those rows forever; **no archive, no undo.** Opening the inbox **blanket marks everything read on mount**, so the "unhandled" cue vanishes on the same visit. The **card body isn't a link** — only the small colored CTA navigates, while the always-live × is the biggest easy target (Fitts's law backwards). **No timestamps or countdowns** are rendered, even though bodies say "Confirm within 24 hours."
**Hurts newbie:** one stray tap deletes an invite they meant to accept; they can't tell if a window is still open; digests bury time-critical items.
**Fix:** make the **whole card the tap target**; demote × to swipe/overflow with an **Undo toast**; add a **"Dismissed" archive** (data already stored); render **relative time + a live countdown** on invites; group by date/type and pin actionable items above digests; mark-read on interaction, not on mount.

### 3b.6 Profile
**Current:** the owner profile is literally titled **"Profile dashboard"** ("Manage what people see and what Flockie uses for matching") and stacks **5+ panels** — identity card, a duplicate Share/Settings header row, "Match setup," a "Visibility summary" ACL grid, "My upcoming plans," "Reviews" — with **engineer-facing copy** ("raw preferences," "behavioral signals," "enforced by the profile privacy layer"). **Share and Settings each appear twice.** The actual **public-you is buried** as one card you must click "Public profile" to view.
**Hurts newbie:** their "profile" feels like an admin console, not a personal page; the jargon is intimidating.
**Fix:** split **`/profile` (public: photo, name, vibe-check result, past vibes, reviews)** from **`/settings` (matching setup + visibility + account)**; lead with the identity card; drop the jargon; de-duplicate Share/Settings to one place; rename off "Profile dashboard."

### 3b.7 Numeric ratings still on people (friend's #3, confirmed in code)
**Current:** despite the decision not to rate people numerically, **`SwipeDeck.tsx` renders `⭐ 4.8 (12)`** on each person's Find-a-Buddy card (from `loadUserRatings` avg). `ProfileReviews.tsx` also renders numeric stars (it's currently dead code but keeps the pattern alive), and the reminder copy says **"Rate the buddies you flocked with."** The live profile surfaces correctly show only "Verified interaction" + comment — so the decision was applied there but **not** to Find a Buddy.
**Fix:** drop the `Stars`/`toFixed(1)` badge from `SwipeDeck` (keep `review_count` only, non-numeric); delete dead `ProfileReviews`/`ProfileTabs`; revise "Rate the buddies…" to a qualitative model. **Shelving Buddy (§5) removes the live offender immediately.**

### 3b.8 Host-vs-algorithm, join flow & status (the trust layer)

**(a) The join CTA is buried, and status states are ambiguous.**
The vibe page order is: category → cover → when → where → going → description → activity link → what-to-bring → host → tags → attendees → reviews → *(host-only panels)* → **Join button** → share. So the primary action sits **dead last, below reviews.** And of the **13 viewer states**, **two say the literally identical phrase "You're in the running"** — `interested` (*"· tap to remove"*) and `shortlisted` (*"invites go out once matching is finalized"*) — so a user can't tell they advanced. `standby`, `requested`, `shortlisted` are all the same grey pill. `removed` reads *"This Vibe is no longer available"* (sounds like the vibe vanished, not that the host removed *them*).
**Fix:** sticky bottom **Join** bar for non-hosts; a shared **progress stepper** (Interested → Shortlisted → Invited) so the waiting states are legible; recolor standby/requested; reword `removed` to *"The host removed you from this Vibe"* with the appeal beneath it.

**(b) One tap → up to 4 interruptions.**
Tapping "I'm interested" as a new user can fire, in sequence: **activity-form modal → OS geolocation prompt → "Where are you based?" city modal → (maybe) ineligible error → success popup → a nudge to go do a *fourth* form** (*"Take the 60-second Vibe form so the algorithm reads you right"*). The nudge comes **after** they've already committed — the algorithm the copy keeps citing can't use a form you ask for post-hoc.
**Fix:** collapse the gates — capture city inside the activity form (one modal), defer geolocation to a non-blocking background capture, and move the vibe-form ask to the first interest gate, not after.

**(c) Confirm-window copy is a real, code-confirmed lie.**
The actual window (`_vibe_confirm_deadline`): **6 hours** if the vibe is ≥24h out, **1 hour** if <24h out. But the inbox/push copy `vibe_invitation.body` says **"Confirm within 24 hours to grab your spot."** — in **all three locales**. The SQL comment itself flags it: *"6h to confirm (was 24h — too long)."* So users think they have a day; they have 6h (or 1h). *(The in-app `invited` control is fine — it shows a live "{h}h {m}m left" countdown; only the notification copy lies.)*
**Fix:** make `vibe_invitation.body` dynamic ("Confirm within {hours}h") or at least drop the "24 hours"; add the countdown to the email; fix pt/es.

**(d) Host-vs-algorithm — two contradictory models ship at once (friend's #1, exact quotes).**
- *Model A — "algorithm decides, no host say":* `detail.matchingSubtitle` (host's own dashboard) = **"The algorithm ranks and invites — no host approval needed."**; `invite.helperPublic` = *"the host's algorithm picks the most compatible people"*; `interest.shortlistedMsg` = *"invites go out once matching is finalized."*
- *Model B — "host picks":* `myVibes.inTheRunningHelp` (shown to the applicant) = **"we'll let you know as the host picks their group."**; `host.shortlistHelp` = *"The algorithm ranked these by match. **Remove up to {cap}**, then send."*; email `vibe_review_ready` = *"**Pick who's coming along.**"*
- **The head-on contradiction:** the host page says *"no host approval needed"* while, **three sections down the same page**, the host tool lets them reject up to 25% of capacity (`previewRejectCap = floor(capacity*0.25)`). The truth in code is **neither**: *algorithm ranks → host may drop a capped few → invites auto-send.*
**Fix:** one honest sentence everywhere — **"The algorithm ranks everyone by compatibility; the host can drop a few before invites go out."** Kill `matchingSubtitle`'s false line; align the applicant-facing strings.

**(e) The "Join now" bait-and-switch starts on the invite page.**
The public `/invite` page computes `directConfirm` **without the viewer's city** (its own comment: *"this public page can't know the viewer's city, so it shows the optimistic label"*), so a different-city viewer sees **"Join now"** → taps through → the vibe page forces `directConfirm=false` and silently downgrades it to **"I'm interested."** Also, all 3 invite CTAs (instant-confirm host code vs soft "I'm interested") are the same coral pill, and the eyebrow is always *"You're invited to a Vibe"* even on the public path where nobody invited them.
**Fix:** don't show "Join now" on the public invite page (reserve it for the code/host paths that truly confirm instantly); rank the CTAs visually by commitment; swap the public eyebrow to *"There's a Vibe you might like."*

---

### The golden paths (what the flows *should* be)

**First-time joiner (the flow to optimize for):**
1. Land → **Home = "Vibes near you this week"** with one CTA.
2. Tap a vibe → clear **what / when / where** + one **Join** button.
3. First join triggers **4 quick questions** (activities, vibe, group size, energy) — not 25 screens.
4. **Confirmed** → chat + exact address + reminders (already solid post-this-session).
5. After the event → "How was it?" (qualitative) + **"Join this community?"** (§7).

**Host:**
1. **Create** (auto-pin location — done) → share.
2. Matching builds the list → host trims a few → invites go out (state this **one way** everywhere).
3. Confirmed guests → chat → reminders → run the event → **"Turn this into a community?"**

The whole app should read as **one product (Vibes)** with a clean joiner path and a clean host path — everything else (Buddies, Flocks, Trips, the deep forms) is deferred until it's genuinely needed.

---

## 4. THE BIG ONE — onboarding is too long

**Your instinct is right and worth stating clearly:** a dating app's long form is *expected and intentional* — you're there to be matched 1:1. Someone who just wants to **join an event** has no such patience; every extra question is pure drop-off. The fix is to **match form length to intent.**

### Where the length comes from (measured, not guessed)
| Form | Pages | Feeds… |
|---|---|---|
| Profile basics | 1 | everything (identity + eligibility) |
| Personality quiz | 5 | `vibe_scores` → **Buddy 1:1** matching (cosine) |
| **Trip vibe** | **9** | **Buddy/Trip** matching (the 6 sliders, trip_vibe, priorities) |
| **Activity vibe** | **9** | **Vibe** matching (activities, activity_vibe, social) |
| **Total** | **24 screens** | |

**Two paths already exist (important):**
- **Quick path** (`?quick=1`, used when someone signs up *via a vibe invite/interest link*): `profile → activity-vibe → done`. **Already skips the quiz + trip form** — this was Jess's earlier change, and it's live. But it still runs the **9-page activity form**.
- **Default path** (normal signup, no invite): still the full `profile → quiz (5) → trip (9) → activity (9)` = 24 screens.

**Key realization:** the two 9-page forms + the 5-page quiz mostly feed **Find‑a‑Buddy (1:1)** — which we're shelving (§5). So most of the length exists to power a product we're turning off. Turning it off lets us cut the form massively **without hurting Vibe matching.**

**So there are two concrete moves here:**
1. **Make the short (quick) path the default for *all* signups**, not just invite arrivals — the full quiz+trip chain shouldn't gate anyone right now.
2. **Cut the 9-page activity form itself down to ~4 questions** (below). This is the "9 vibe pages" complaint.

### What Vibe matching *actually* needs (must-keep)
From the live matching functions (`recommended_vibes`/`vibe_match`, `_rank_vibe_core`, `invite_city_fallback`, `vibe_eligible`):
- **`activities`** — what you're into (category match). *Highest vibe-match weight.*
- **`activity_vibe`** — your energy/vibe tags (event-tag match).
- **`activity_social`** — group-size comfort (used in `vibe_match`).
- **`home_city`** — discovery + city gating (already in profile basics).
- **`gender`, `age`** — eligibility (already in profile basics).
- *(the 6 personality sliders feed `_rank_vibe_core` at only 0.20 and buddy matching — droppable for a vibes-only product; see note.)*

### Proposed minimal Vibe onboarding — **2 pages, 4 questions** (your target)
Everything else deferred (§ "defer" below). Basics (photo, name, birthday, gender, city) stay in the one profile step that already exists.

**Page 1 — "What are you into?"**
- **Q1 · Activities** → `activities` *(multi-select; MUST — drives category match & the city-fallback gate)*
- **Q2 · Your vibe** → `activity_vibe` *(pick up to 2 energy/vibe tags; MUST — event-tag match)*

**Page 2 — "How you like to show up"**
- **Q3 · Group size you enjoy** → `activity_social` *(small / medium / big; used by `vibe_match`)*
- **Q4 · Energy level** → one slider (chill ↔ high-energy) *(keep as the single "spontaneity/energy" signal)*

That's **4 questions to start joining vibes**, down from 23 (+ profile). Assertive, fast, newbie-proof.

### Per-form: MUST-KEEP vs REMOVE (so we cut safely)

**Personality quiz (5 Qs)** — feeds only Buddy `vibe_scores`.
- **Remove from initial onboarding** (defer to Buddy launch). Keep the questions in code; just don't gate vibe-joining on them.

**Trip vibe form (9 Qs)** — feeds Buddy/Trip.
- **Remove from initial onboarding entirely** (Buddy is shelved). Keep: `pace, budget, social_energy, planning, nightlife, adventurousness, trip_vibe, dealbreakers, match_priorities` in code for when Buddy returns.

**Activity vibe form (9 Qs → keep 3–4)**
- **MUST-KEEP:** `activities` (Q1), `activity_vibe` (Q7), `activity_social` (Q3). Optionally one energy slider.
- **REMOVE / defer:** `activity_motivation`, `social_style`, `activity_intensity`, `initiator`, `activity_dealbreakers` (only 3 values are enforced — keep those as a tiny optional toggle if needed), `activity_priorities` (weighting question — only matters for buddy).

**Data cleanup to pair with this:**
- **`activity_skills`**: matched (0.35 in rank-core) but never collected → **remove from the algo & rebalance** (or it stays neutral forever).
- Drop orphans: `travel_style`, `one_liner`, `activity_one_liner`, `relationship_status`.

### Honest note on algo impact
Cutting the 6 sliders drops the 0.20 "personality" block from the host-shortlist ranking (it falls back to neutral). That's acceptable because (a) vibe matching leans on **activities + tags + city**, which we keep, and (b) the largest rank-core weight (`activity_skills`, 0.35) isn't even collected today. Net: **vibe matching quality is essentially preserved**, and we can reintroduce the deep signals *with* Buddy, when the long form is contextually justified.

> **Progressive profiling** is the pattern: collect the 4 vibe questions up front; ask the deeper questions later, in context (e.g. when someone opens Find‑a‑Buddy), never all at once.

---

## 5. Shelve "Find a Buddy" (travel / flock) behind a **"Soon"** tag

**Rationale:** 1:1 buddy matching needs liquidity (lots of users) to feel good — a cold deck of 3 people is a bad first impression. Until we have density, it makes the app look empty and *forces newbies to understand 4 products* (friend's #8) before doing anything.

**Proposal:** disable Buddy / Flock / Trip / Activity buddy surfaces and show a **"Soon"** tag (visible but non-interactive), so the app is **Vibes-only** for now.

**What this fixes immediately:**
- Removes the two-level Buddy/Flock + Trip/Activity switch confusion (#8).
- Removes the numeric-rating surface (#3).
- Removes the desktop/mobile "Find a Buddy"/"Match" label mismatch (#7).
- **Lets us cut onboarding to the 4 vibe questions (§4)** — the trip form + personality quiz aren't needed without Buddy.
- One product to learn → dramatically simpler for newbies.

**Decision for Taisiya:** this leans further into **local-belonging (Vibes/Communities)** vs the **travel-matching** deck/TiE story. Consistent with the Communities bet (§7), but it's the same strategic fork — worth a conscious call.

---

## 6. Known gaps / FYIs

- **City guard not applied on the invite link** *(you flagged this).* The same-city one-tap-confirm guard runs through `express_interest` (the public "I'm interested" path). The invite link's **host-code** path (`redeem_host_code` → instant confirm) and **private-request** path (`request_private_vibe`) **bypass it**. That's arguably *correct* for host-initiated invites (a host may deliberately invite a traveler), but **we should confirm it's intended** and make the copy honest ("the host invited you directly"). If we want the guard on public invite-link joins too, that path already uses `express_interest`, so it's covered — the gap is only the host-code/private paths.
- **Confirm-window copy** hardcodes "24 hours" in several places while the real window is dynamic — fix alongside friend's #2.
- **Reviewing-state invisibility** — a guest in a `reviewing`/limbo vibe gets no status signal.

---

## 7. Communities — the new tab (keep it simple)

From `docs/communities-plan.md`. For a first ship, build **only the floor** — the rest is a later "delight" layer. Goal: a newbie understands it in one sentence — *"a vibe that keeps happening."*

**Minimal MVP steps (in order):**
1. **Turn a vibe into a community** — after a vibe that went well, host sees: *"Turn this into a community?"* → picks a **frequency** (weekly / 2 weeks / monthly) → invites the attendees. (Starts from people who already clicked, not a stranger pool.)
2. **Its own tab + group chat** — the community lives as one place.
3. **The automatic heartbeat (the one non-negotiable)** — the *system* schedules the next meeting on the frequency and drops a **pre-filled one-tap** reminder in the chat: *"Wine club, Thursday, same place — you in? 4 going."* This is what makes the group survive when the host goes quiet. **If we build one thing, it's this.**
4. **Membership earned in person** — you can't click to join; you **browse clubs → attend one event → after attending, "want to join this club?"**

**Defer to later (do NOT build now):** the two modes (host-run vs system-run), the graceful handoff, gamification/toolkit. Keep v1 to: *make a community from a vibe → it has a chat → it auto-schedules the next meet → you join by showing up.*

**Decision for Taisiya:** confirm Communities is the headline bet (local-belonging), which also justifies §5.

---

## 8. Decisions needed from Taisiya

1. **Shelve Find‑a‑Buddy behind "Soon"?** (Unlocks the onboarding cut + simplifies the whole app.) → strategic fork: local-belonging vs travel-matching story.
2. **Approve the 2-page / 4-question vibe onboarding** (activities, activity_vibe, group size, energy). Defer the quiz + trip form to Buddy launch.
3. **`activity_skills`**: remove from the algo (recommended) or add a collection step?
4. **Host-vs-algo one-liner**: agree the single sentence and we standardize it everywhere.
5. **Numeric ratings**: confirm they're gone with Buddy; agree the non-numeric trust signal for when it returns.
6. **Communities MVP scope**: confirm we build only the floor (turn-into-community + chat + heartbeat + attend-to-join).

---

*Companion docs: `communities-plan.md` (full Communities plan), `user-feedback-solutions.md` (earlier v1 feedback triage), `qa-checklist-2026-07.md`.*
