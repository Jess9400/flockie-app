# Flockie 1:1 matching V2

## What the number means

The displayed percentage is a fit index for doing activities together. It is
not a probability, a popularity score, or a judgment of either person.

The same fixed formula applies to every user. Scores are never ranked against
the current member pool and are never increased just because a city has few
people.

## Eligibility comes first

Location, relevant travel dates, availability, discovery settings, safety
rules, and hard dealbreakers decide whether a person can appear. They do not
add or remove percentage points.

This keeps two separate questions clear:

1. Can these people realistically make a plan together?
2. If they can, how well do their activity preferences fit?

## Cold-start score

Every new member completes the Vibes onboarding, so the first score uses only
those answers:

| Component | Weight |
|---|---:|
| Interests | 35% |
| Activity style | 25% |
| Preferred group size | 20% |
| Reason for joining | 10% |
| Adjustable Vibe traits | 10% |

Exact answers receive full credit. Clearly related interests and styles receive
partial credit. Missing components are removed from the denominator instead of
being treated as disagreement.

The raw onboarding fit is calibrated to a 55 to 90 display range:

`55 + 35 × raw onboarding fit`

With the required onboarding answers, a fully unrelated pair lands around 60.
A normal useful fit should usually land in the 70s. Strong overlap reaches the
80s, and an identical cold-start profile reaches 90.

Candidates below 60 are not recommended.

## Behavior learning

Behavior starts with zero weight. It gradually replaces onboarding evidence as
both people make explicit choices:

`behavior weight = min(80%, 8% × shared evidence count)`

The shared evidence count is the smaller number of explicit Vibe choices made
by either person. This prevents one experienced user from overwhelming a new
user's onboarding answers.

Current explicit signals:

| Signal | Direction | Strength |
|---|---:|---:|
| Self-expressed interest | Positive | 1 |
| Confirmed attendance | Positive | 2 |
| Positive Vibe review | Positive | 3 |
| Not for me | Negative | 2 |
| Negative Vibe review | Negative | 3 |

The engine compares the categories and tags behind those choices. Shared likes
and shared dislikes increase fit. Opposite reactions reduce fit. Unrelated
behavior stays neutral.

Automated invitations, passive browsing, popularity, profile attractiveness,
message volume, and host approval decisions do not affect the percentage.

## Score ceiling

Onboarding can reach 90. Strong, consistent behavior evidence can raise the
display score to 95. The remaining five points are intentionally reserved so
the product does not claim certainty about human compatibility.

## Source of truth

The canonical database function is `public.buddy_pair_score` in
`supabase/vibe-traits.sql`. Candidate lists may filter or rank its result, but
they must not recalculate the percentage with a second formula.

## Production deployment order

After the PR is merged, run these canonical files in this order:

1. `supabase/vibe-traits.sql`
2. `supabase/vibe-express-interest-autoconfirm.sql`
3. `supabase/home-carousels.sql`
4. `supabase/activity-candidate-decisions.sql`
5. `supabase/buddy-match-v2-check.sql`

The first file expands the interest-source constraint before the second file
starts writing `source = 'self'`. The final file is read-only and raises an
exception if a core similarity rule has changed unexpectedly.
