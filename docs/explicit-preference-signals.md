# Explicit preference signals

This rollout collects real actions for analysis. It does not change matching,
ranking, recommendations, or displayed match percentages yet.

## Signals collected

| Signal | Meaning | Evidence level |
| --- | --- | --- |
| `vibe_attended` | A Vibe host recorded a confirmed participant as present. Club gathering attendance uses the existing Club host record. | Verified |
| `liked_post` | A user liked a Feed post anchored to a Vibe, Club, or activity. | Explicit |
| `club_belonging` | A user is a founding or regular member of a Club. | Explicit |
| `activity_created` | A user created a 1:1 activity. | Explicit |
| `activity_joined` | A host accepted a user's request to join a 1:1 activity after this rollout. | Explicit |
| `invitation_rejected` | A user declined an invitation before confirming a Vibe. | Explicit negative |

## Guardrails

- A confirmation is not attendance. Only a host record creates `vibe_attended`.
- A host declining or removing someone is not treated as that person's preference.
- Leaving after confirmation is not counted as an invitation rejection.
- Existing accepted activity requests have no invented acceptance timestamp. Only
  decisions made after this rollout appear as `activity_joined`.
- Feed likes describe interest in an anchored post. They are not yet assumed to
  mean a user wants to attend the same plan.
- The app cannot query the ledger views. They are for SQL-editor analysis only.

## Admin analysis

Use these SQL-editor-only views after deployment:

- `public.preference_signal_events` for individual signal records.
- `public.preference_signal_user_summary` for per-user coverage.

Before a later scoring rollout, validate that each signal predicts repeat
interest, positive reviews, and actual attendance. Add only validated signals
to the matching formula and document their weights in `vibe-traits.sql`.
