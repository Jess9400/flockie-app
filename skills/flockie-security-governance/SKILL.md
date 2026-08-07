---
name: flockie-security-governance
description: Apply Flockie's required security, SQL deployment, secret-handling, and change-isolation rules whenever inspecting, editing, reviewing, or deploying this repository.
---

# Flockie Security Governance

Read `docs/AI_ENGINEERING_GUARDRAILS.md` before acting. It is the canonical
shared policy for Codex and Claude Code.

## Required behavior

1. Confirm the current branch and clean working-tree state before editing.
2. Keep security, database, dependency, and product-logic changes in separate pull requests.
3. Do not run production SQL. Follow `supabase/DEPLOYMENT.md` after merge.
4. For SQL changes, update the source map, deployment guide, and dated release record.
5. Reject new anonymous RPCs unless they are in `supabase/public-rpc-allowlist.json`.
6. Never expose secrets or add real environment files to Git.
7. Run the repository checks before handoff.
