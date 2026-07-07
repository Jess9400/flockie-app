# Flockie Communities — plan (merged)

> Merges Taisiya's "Communities / Recurring Clubs" draft + Jess's MVP brief into one plan for the founder session. **The MVP "floor" is the recurring-club loop (Taisiya); the toolkit + gamification is the later "delight" layer (Jess), built only after the loop is proven.** (Supersedes `communities-mvp-brief.md`.)

## 0. The decision that gates everything
This local, recurring-**belonging** direction is **different from the travel-matching product** in the pitch deck + the TiE application already sent. You can't build both cores with a small team. **Decide consciously:** is Flockie a local-belonging company (this plan) or a travel-matching one (the deck) — and when does the story/deck catch up to the product? Everything below assumes local-belonging is the bet.

## 1. The thesis
Friendship forms through **repetition, not matching.** The whole category (Timeleft, 222, TripBFF, NomadTable) optimizes the *first meeting*; nobody has solved *the same group coming back* — the only thing that actually creates belonging.

## 2. Core idea + flow
A community forms **from a vibe that already went well** (people who met and clicked) — a stronger foundation than any algorithm, and the thing no competitor does.
1. A vibe (single event) ends.
2. Host prompt: **"Turn this into a community?"** (e.g. monthly wine tasting, weekly run).
3. If yes → host picks a **frequency** (weekly / every 2 weeks / monthly).
4. Host invites the attendees they want (keeps it known people, not a re-opened stranger pool).
5. Community created — its own tab, its own group chat.

## 3. The MVP floor (build only this)

### 3a. The automatic heartbeat — the one thing that must work
**The system, not the host, keeps the group meeting.** On the chosen frequency it schedules the next meeting and drops a **pre-filled, one-tap** reminder into the chat: *"Wine club, Thursday, same place — you in? 4 going."*
- Most hosts fade (high on day 1, gone by week 3); any group that depends on a human to organize the next meeting eventually dies. Automatic rhythm = the group survives even when the host goes quiet. **If we build only one thing well, it's this.**
- Design: pre-filled "same time, same place, you in?" — **not** an open "who wants to organize?" (that's how group chats die). The taps also give a **health signal** (who's still showing up).

### 3b. Two modes: host-run vs system-run (+ the graceful handoff)
At creation the host picks how it runs:
- **"I'll run it" (host-run)** — host schedules, invites, sets the newcomer dial, leads. Full control + responsibility. For people who want the club to be *theirs*.
- **"Flockie keeps it going" (system-run)** — the algorithm schedules on the frequency, sends the reminders, tops up the group when it shrinks. The host just shows up like everyone else.

**The graceful handoff:** a host-run club dies when the host goes quiet, so the system watches (no meeting scheduled, host silent, attendance slipping) and steps in *before* it dies:
1. Host quiet → gentle: *"Looks like things have gone quiet — want Flockie to take over keeping this going?"*
2. Still quiet, about to miss a meeting → *"We'll keep your club going unless you'd rather run it."*
3. Still nothing → **auto-switch to system-run** so the group survives — *"We've kept your club going — flip back to running it yourself anytime."*

Default outcome is always **"the group survives,"** fully reversible, and we never *silently* strip a host of control.

### 3c. Membership is earned in person, not online
**You can't click to join a club — you can only show up to one.** New people **browse clubs → see upcoming events** (things to show up to, not a roster of strangers) → **attend one** → *after* attending, the app asks **"want to join this club?"** — they decide after actually being in the room.
- Request routes **by mode**: host-run → host (and optionally regulars) approve; system-run → system decides on fit + room. (One decision at creation cascades through scheduling, refresh, *and* approvals.)
- Keeps clubs made of people who've actually been there — the proven-chemistry foundation, and it fits the familiarity-based safety story.
- **Tradeoff to accept:** clubs grow only as fast as people physically attend — **no viral "join" link, slower scale.** The right tradeoff for belonging, but name it.

### 3d. Refresh (keep the group alive over time)
Groups shrink naturally (people move, get busy):
- **System-run:** algo actively finds + adds good-fit people to keep a healthy size — automatically.
- **Host-run:** host sets the dial (0 = tight, or open it up); algo suggests good-fit candidates for whatever they open.
- **Soft steer:** regulars stay the majority (50%-new-*every*-time just recreates Timeleft's rotating-strangers model). Nudge toward it, keep it flexible.

## 4. Community vs Flock
- **Community** = persistent, recurring, local, tooled group → the conversion target for a vibe.
- **Flock** = a group *trip*. A local vibe becomes a **Community**, not a Flock.
- A Community can later **plan a Flock** — travel as an *outcome of belonging* (also differentiates hard from TripBFF: they match strangers for one trip; we let a group that already gels go travel together).

## 5. Later layers (parked — decoration on a loop that must work first)
Build only after the loop is proven:
- **Category hero tool** (one per vertical): Book club = **Sync-read** (same book, chapter-gated discussion, quotes); wine = tasting notes; music = playlist; sports = sessions/RSVP; travel = trip planner + expense **ledger** (NOT payments/combined-wallet — a regulated company; do the ledger + link out to settle).
- **MSN-nostalgia base toolkit** (warm, playful, WhatsApp-can't): Nudge/Buzz (shake + haptic; iOS Safari has no vibration API → visual shake on web), status quote, now-playing, presence + away message, winks, join chime, group games.
- **Co-op gamification:** the community collectively "beats the platform" → unlocks premium free; a weekly collective goal doubles as the heartbeat; reward = temporary premium (a taste → upsell).
- Distributed co-host approvals / auto-promoting regulars (at scale).
- Full monetization (though worth testing whether a small fee filters for serious people, à la Timeleft).

## 6. Launch shape + the metric
Build only the floor: (1) a vibe people create/join [exists], (2) the **"turn into a community"** moment (frequency + host invites attendees), (3) the **automatic recurring heartbeat** with tappable reminders.
- **Launch in one dense Bangalore pocket** — enough that the first gatherings feel full (Timeleft's "don't launch a city until enough sign up" rule).
- **Measure one thing: % of communities still meeting in week 4 and week 6.** *Three groups still meeting at week 6 = success. A thousand downloads and no group meeting twice = failure.*
- This validates the ONE question everything rides on: **do the same people come back a 2nd and 3rd time?** (Untested — the launch exists to answer it.)

## 7. Open decisions for the session
1. **Travel-matching vs local-belonging** — the headline call (§0).
2. **Host incentives** (for hosts who *want* to run their club): status/badges → perks (free premium, boosted gatherings) → actual money (cut of paid gatherings / size+consistency milestones). Not urgent; the strongest version makes **monetization and retention the same engine** — reward the people who create the belonging.
3. **Approvals scope** in host-run: host only, or host + regulars?
4. **First vertical** to seed (picks the first hero tool, later). Lean **Book club** (Sync-read is the stickiest/most novel).
5. **Naming** ("Community" vs "Club" — the draft's "club" reads warm).
