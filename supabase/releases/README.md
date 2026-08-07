# SQL Release Records

Create one file named `YYYY-MM-DD-short-topic.md` for every pull request that
changes `supabase/*.sql`.

Use this template:

```md
# YYYY-MM-DD Short topic

## Canonical source

- `supabase/example.sql`

## Scope

- Tables, functions, policies, storage rules, and cron jobs affected.
- Whether existing data changes.

## Preconditions

- Required live function signatures, tables, extensions, or prior releases.

## Deploy

- Exact approved SQL file or bundle to run after merge.
- Runner and target environment.

## Verify

- Read-only preflight query and expected result.
- Exact normal-user path to test.

## Rollback

- Safe rollback command or the reason a rollback requires a new migration.
```
