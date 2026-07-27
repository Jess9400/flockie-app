# Vibe behavior signals in shadow mode

This phase collects passive Vibe discovery signals without changing matching,
ranking, recommendations, or displayed percentages.

## What is recorded

The private `vibe_behavior_events` table records:

- A Vibe card stayed at least 60% visible for 800 milliseconds.
- A user opened a Vibe detail page.
- A Vibe detail page stayed visible for at least 10 seconds.
- A Vibe detail page stayed visible for at least 30 seconds.

Events are grouped by user, Vibe, source, event type, and UTC day. Repeated
events increase a bounded occurrence counter instead of creating unlimited
rows.

Host views of their own Vibes are ignored because management activity is not a
preference signal.

## Existing explicit signals remain canonical

This PR does not duplicate explicit actions:

| Signal | Canonical source |
|---|---|
| Interested, invited, confirmed, declined | `vibe_interests` |
| Not for me | `vibe_feedback` |
| Rating and recommendation | `vibe_reviews` |

Future analysis can join these sources with passive events. Matching must not
read the passive table until the distributions are reviewed and a separate PR
is approved.

## Privacy and storage

- Authenticated clients can call `record_vibe_behavior`.
- The RPC always writes `auth.uid()` and does not accept a user ID.
- Clients cannot read the raw event table.
- No IP address, device fingerprint, location coordinate, or free text is
  stored.
- The privacy policy describes the discovery events and retention period.
- Rows older than 180 days are deleted daily.
- Daily occurrence counters are capped at 20.

## Deployment

After this PR and its parent matching PR are merged, run:

1. `supabase/vibe-behavior-shadow.sql`

The application treats tracking as best effort. If SQL has not been deployed
yet, Vibe browsing and joining still work normally.

## Verification

After browsing a few Vibe cards and opening one detail page, an administrator
can run:

```sql
select
  event_type,
  source,
  count(*) as daily_rows,
  sum(occurrences) as occurrences
from public.vibe_behavior_events
where last_seen_at >= now() - interval '1 day'
group by event_type, source
order by event_type, source;
```

Confirm that the retention job exists:

```sql
select jobname, schedule, active, command
from cron.job
where jobname = 'flockie-vibe-behavior-retention';
```
