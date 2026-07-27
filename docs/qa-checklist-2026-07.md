# QA checklist - everything deployed (2026-07)

Test each change in the live app. Grouped by area. Each item: **what changed → how to test → expected.**
Legend: 🗄️ = enabled by SQL you ran · 💻 = client change (deployed with `main`) · ⏰ = cron/time-based (can't trigger instantly).

> Tip: to test "eligibility" / "cross-city" / "who-liked-me" you'll need **2 test accounts** (ideally in the same city, one male + one female, plus one in a different city).

---

## 1. Vibe eligibility (gender/age) 🗄️
- [ ] As a **male** account, browse "Picked for you" / Vibes → a **women-only** vibe should **NOT** appear.
- [ ] Open a women-only vibe's link directly as that male account → tapping **"I'm interested"** should show *"This vibe has preferences that don't include your profile"* (not a raw error, not success).
- [ ] As an eligible account, interest works normally.
- [ ] (Host side) A women-only vibe's shortlist should never include ineligible people.

## 2. Multi-activity Vibes 🗄️💻
- [ ] Create a Vibe and pick **multiple categories** in the form.
- [ ] On the **vibe card** (home/list): see all categories as chips (up to 3 + "+N"), not just one.
- [ ] On the **vibe detail** page: all categories shown.
- [ ] "Picked for you" match % should reflect a match on **any** of the categories (not only the primary one).

## 3. Home "Find a buddy for an activity" carousel (`city_people`) 🗄️
- [ ] Shows **only people in your city** (label reads "People in {your city}…").
- [ ] A user you've **hard-blocked** (dealbreaker conflict, e.g. same-gender-only / sober-vs-drinks) does **not** appear.
- [ ] Someone who **swiped no** on you does **not** reappear (reciprocity).
- [ ] More **recently-active** people tend to rank higher; the order **rotates** week to week (not identical every load).
- [ ] Empty city → warm "You're early in {city} 🌱" state + invite CTA (not a wall of Dubai).

## 4. Say-hi / swipe hard-block 🗄️
- [ ] Try to "Say hi" / swipe on someone you have a **hard dealbreaker** conflict with → friendly *"You two have conflicting match preferences"* (not a raw error, and no match created).

## 5. City picker + normalization 🗄️💻
- [ ] **Onboarding** ("Your city right now") and **Profile edit** ("Home city"): typing shows a **city autocomplete dropdown** (type "lis" → Lisbon). Selecting sets a clean value.
- [ ] Free-text still allowed for small towns; on blur it's trimmed/title-cased.
- [ ] Two accounts in the same city (even if one was typed with odd spacing) **see each other** in the city carousel.

## 6. Flock (group-trip) request loop 🗄️💻
- [ ] Request to join a public Flock → the **host gets a notification**.
- [ ] Host **approves** → you get a **"You're in!"** notification that opens the **group chat** (not a dead "My Trips").
- [ ] Host **declines** → you get a **"went with other travelers"** notification, and that Flock shows **"Request to join"** again (you can re-request).
- [ ] **Flock detail page** (`/flocks/[id]`): full description, linked host, going count, budget/facts, request button. Creating a Flock lands you **on its detail page**.

## 7. Retake quiz actually resets 🗄️ (Taisiya #175)
- [ ] Profile → **Retake vibe quiz** → confirm → the quiz genuinely **resets** and you can redo it (previously the button was dead).

## 8. Account deletion (cancellation-aware) 🗄️💻
- [ ] Host an upcoming Vibe/Flock with a confirmed attendee/member, then **delete your account** (Settings).
- [ ] The **attendee/member gets a cancellation notification** ("The host left Flockie…").
- [ ] Your uploaded **photos/video are gone** from storage (old profile image URLs stop working).

## 9. Email notifications - Tier 2/3 ⏰🗄️
These fire on schedules, so they're **hard to trigger on demand** - verify the in-app notification appears and (if email is on) an email arrives:
- [ ] **Review reminder** - after an event/trip ends, you get a "How was …?" notification **+ email** with a "Leave a review" link.
- [ ] **"Your Vibe is tomorrow"** - a confirmed attendee gets a reminder ~24h before the vibe.
- [ ] **New message while away** - if you have an unread chat message >15 min old and you're away, you get **one** nudge email (not per-message).
- [ ] **Weekly "Vibes near you"** digest - one email per week summarizing vibes in your city.
- [ ] Turning off email notifications suppresses these.

## 10. Privacy / security (verify behavior) 🗄️
- [ ] On `/people/[id]`, you can see people who **liked you** (match-back), but there's **no way to see who swiped *no*** on you.
- [ ] On a vibe page you see the "Going" avatars/count, but you **can't enumerate** another user's upcoming confirmed events elsewhere.

---

## Client-only changes that shipped alongside (no SQL, but test them) 💻
- [ ] **Bottom tab bar** on mobile (Home / Vibes / Match / Chats / Profile); drawer is the short 5-item version (no My Vibes/Deals/Settings rows).
- [ ] **Branded confirm dialogs + toasts** everywhere (no more browser `alert/confirm` popups) - leave match, report user, delete, etc.
- [ ] **Loading skeletons** on navigation (no more blank waits).
- [ ] **Chat**: your sent message appears **instantly** (and shows "Failed - tap to retry" if it doesn't send).
- [ ] **"In the running"** section in My Vibes (vibes you've joined: interested/shortlisted/invited/confirmed).
- [ ] Vibe grids are **2-col on phones**; pinch-zoom works.
- [ ] Taisiya's UI: fixed narrow mobile activity cards, aligned profile badges, Match-setup redesign, centered AirHelp action, aligned Vibe/Flock card footers.

## Perf (not directly visible) 🗄️💻
- [ ] Pages that parallelized their reads (Home, Match, Chats, Vibe detail, buddy/flock chat, My Trips, public profile, Flocks) should feel a bit snappier. (Deeper latency work is still on the list - see `user-feedback-solutions.md` #10.)

---

## NOT yet done (so don't expect these - they're in the feedback backlog)
- Time-filter chips still reload the whole page (feedback #4).
- Match% / attendee-count sizing on vibe cards (feedback #6).
- Invite message textarea (#1), budget on flock card (#8b), join-without-creating (#7), no-show gating (#5).
- `/about` page + full legal docs (#7 of V2 - needs your bios/legal).
