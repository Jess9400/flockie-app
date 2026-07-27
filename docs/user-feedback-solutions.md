# User feedback → proposed solutions (for discussion with Taisiya)

Raw feedback from a user who ran the v1/MVP. **Overall score they gave: 6/10 for an MVP - "pretty strong."** Nothing here is implemented yet - this is a solutions/triage doc to work through together and prioritize before building.

Each item: the user's words → proposed fix → rough effort → **Quick win** (ship now) vs **Decision** (design call for us).

---

## ✅ What's working (keep - no action)

- **#2 - "I like homepage where I see people around you."**
- **#9 - "I like the profile page a lot - very strong page (for my own profile)."**

Good signal on what NOT to touch.

---

## 🐛 Bugs & quick fixes

### #4 - Time filters reload the whole page & jump to top  · Quick win
> "when I click the time (24h, anytime, etc) in the happening near you section, it reloads the whole page… it should reload only the section… now it sends me to the top of the page."

**Cause:** those chips are `<Link>`s doing a full server navigation (the pre-launch audit flagged this too).
**Fix:** make "Happening near you" a client component that filters in state (or `<Link scroll={false}>` + client-side filtering) so only that section updates and scroll position is preserved.
**Effort:** small.

### #6 - Match % and attendee count too small on vibe cards  · Quick win
> "the text size for match %age is too small and the number of people who went or are going to the event."

**Fix:** bump the font size of the match-% badge and the going/went count on `VibeCard`.
**Effort:** trivial (CSS).

---

## ✍️ Small feature

### #1 - Write a message when inviting someone  · Quick win
> "Invite for a coffee/etc → I think it's not enough, I want to write a few sentences when I invite someone… an input text box will be helpful."

**Now:** the Say-hi / activity invite has preset options + a short "something else" one-liner.
**Fix:** add a proper **message textarea** to the invite flow so the sender can say why / add context.
**Effort:** small.

---

## 🎛️ Product decisions (need Jess + Taisiya)

### #3 - Should "Find a Vibe" sit above the people section?  · Decision
> "Should the find a vibe section be above the people section? I think it should be vibe-based matching first and then people based."

Reordering home to "vibes first, then people" is a 5-minute change - but it's a **positioning call**: are we event-first or person-first? Decide deliberately (and possibly A/B).

### #7 + the closing idea - Non-creators can't participate  · Decision (biggest one)
> "I am not a huge fan of the find a buddy page - because it asks me to create a new event - but say I am not a creator… it should ideally still show me some people who I match with, so I can just join their events?"
> "…let people swipe activities posted in their city 1:1 and not just wait for a match if they are not interested in creating an activity - just see what's available."

**We agree with the user.** Today the activity/buddy flow makes you *post* first. Most people are joiners, not hosts, so this gates the funnel.
**Proposed:** let users **browse & swipe existing activities/people in their city and express interest 1:1 without creating anything** - join what's already there.
**Effort:** medium; real matching/UX work. High funnel impact. **Top design topic for Taisiya.**

### #8 - "Find a Flock" is confusing + budget missing  · Decision + Quick win
> "Find a flock section in the find a buddy page is confusing… does it mean travel to a destination with a group? If yes - it should be clearer. Also budget is extremely important for me on the main image itself."

Two parts:
- **(a) Clarify what a Flock is** - better label/subtitle ("Travel somewhere as a group"). *Trivial copy.*
- **(b) Put budget on the flock card itself** - user won't decide without it. *Small.*

---

## 🔒 Trust / safety

### #5 - Global event applicants who won't show up  · Decision
> "If you show events to people from everywhere, you need to confirm if people will actually show up. I applied for one in Bangkok, and I definitely will not be there. So if I get in, I will just eat someone's spot. Not ideal for host."

Same theme as the sparse-city / geographic-density work. **Options to weigh:**
- Gate event interest to the user's actual city (or "confirmed traveling there").
- Add an "Are you actually going to be in {city}?" confirmation before applying to an out-of-city event.
- Show the host each applicant's home city so they can judge fit.

Design once, properly, with Taisiya - it interacts with the eligibility/geo model.

---

## ⚡ Performance

### #10 - App feels slow between pages  · In progress + diagnosis
> "Overall app is slow - latency when clicking on different pages… can ask Claude to diagnose why."

**Already in motion:** Taisiya's parallelize-page-reads PRs (#159, #168–#173), reuse-verified-user (#160), loading skeletons (#151), and removing the blocking affiliate script (#164).
**Next levers if still slow:** cache the AppShell profile/unread fetch (re-runs on every navigation), RSC streaming, trim per-page query counts.
**Next step:** a focused latency diagnosis to name specific culprits, then targeted fixes.

---

## Suggested sequencing

**Ship-now quick wins** (small, low-risk, no big decision):
- #4 (time-filter reload bug) · #6 (match%/count sizing) · #1 (invite message box) · #8b (budget on flock card)

**Design topics for the Taisiya session:**
- #7 + swipe-activities (join without creating - biggest funnel lever) · #5 (no-show / cross-city trust) · #3 (vibes-first vs people-first) · #8a (Flock clarity)

**Parallel track:**
- #10 latency - run the diagnosis, then targeted fixes on top of the parallelize PRs already merged.
