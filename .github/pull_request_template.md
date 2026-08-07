## Scope

- [ ] This pull request has one clear concern.
- [ ] Product logic and user flows are unchanged, or the behavior change is described below.

## Security and deployment

- [ ] No secrets or environment files are included.
- [ ] `npm audit --audit-level=high` passes.
- [ ] API authentication, input validation, and rate limits were reviewed where relevant.
- [ ] SQL is not changed.

If SQL is changed, include the canonical source, the dated release record, preflight,
deployment order, verification, and rollback plan.

## Validation

- [ ] TypeScript check passes.
- [ ] Relevant tests pass.
- [ ] Build passes.
