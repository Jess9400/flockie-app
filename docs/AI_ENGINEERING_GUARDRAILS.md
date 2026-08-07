# Flockie AI Engineering Guardrails

This is the shared operating contract for people and AI assistants working in
Flockie. `AGENTS.md` directs Codex here. `CLAUDE.md` directs Claude Code here.

## Non-negotiable rules

1. Update from `main`, inspect the working tree, and read this file before editing.
2. Keep one concern per pull request. Do not mix product behavior, UI work, SQL,
   dependency upgrades, and security hardening unless the dependency is documented.
3. Never commit, paste, log, or expose a secret. Local environment files are ignored.
   Use deployment-provider environment settings for real credentials.
4. Never run production SQL automatically. A repository merge does not deploy SQL.
5. Treat `supabase/SQL-MAP.md` as the canonical-source map. Do not revive a
   tombstoned file or run a historical bundle.
6. Any SQL pull request must update `supabase/SQL-MAP.md`, `supabase/DEPLOYMENT.md`,
   and add a dated record in `supabase/releases/`.
7. Any new or changed `security definer` function must set an explicit
   `search_path`, use least privilege, and state its access model in the release record.
8. Any anonymous RPC must be explicitly listed in
   `supabase/public-rpc-allowlist.json` with an owner and a public-use reason.
9. Do not weaken RLS, storage policies, auth checks, rate limits, or privacy defaults
   to make a feature work. Stop and request a security review instead.
10. Do not modify matching, ranking, onboarding, notifications, or user-facing copy
    while working on an isolated security or infrastructure pull request.

## Required workflow

### Before editing

1. Run `git fetch origin main` and inspect `git status --short`.
2. Identify the canonical source and existing deployment dependencies.
3. State the scope and what is intentionally out of scope in the pull request.

### During editing

1. Make the smallest reversible change.
2. Preserve public interfaces and existing data unless the pull request explicitly
   includes a migration and rollback plan.
3. Store sensitive chat or private-user data only in access-controlled storage.
   Do not add it to a public bucket.
4. Authenticate every API route before paid, private, or state-changing work.
5. Validate request size and untrusted input before calling a third-party service.

### Before review

1. Run `npm audit --audit-level=high`, TypeScript checks, relevant tests, and build.
2. Run `node scripts/check-security-governance.mjs --base origin/main`.
3. Run `bash scripts/check-no-em-dashes.sh` on every edited documentation or copy file.
4. For SQL, complete the release record and do not apply it to production yet.
5. Record risks, deployment steps, rollback, and manual verification in the pull request.

## Stop and ask for review

- An RLS policy, storage policy, cron, SQL function signature, or API authentication
  rule needs to change.
- A change needs a service-role key, webhook secret, or a new public endpoint.
- Existing data needs to be migrated, deleted, or made private.
- A dependency upgrade changes major versions or deployment runtime requirements.

## Enforcement

GitHub Actions runs the dependency audit, secret scan, and governance script on
every pull request and `main` push. A failing check blocks merge until the change
is corrected or an explicitly reviewed exception is documented.
