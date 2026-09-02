# EqualPath issue triage policy

EqualPath issues are reviewed in a planning-only workflow. Opening or updating an issue does not authorise implementation.

## Review outcomes

- `plan-ready`: the bug is reproducible or the feature is feasible, and a bounded implementation plan can be prepared.
- `needs-info`: evidence or product detail is missing and must be supplied before planning.
- `defer`: the proposal is reasonable but belongs outside the frozen Iteration 1 scope or should wait for a later iteration.
- `reject`: the proposal conflicts with product boundaries, privacy or security invariants, or cannot be justified by the supplied evidence.

## Required output for a plan-ready issue

The reviewer provides a plan containing:

1. The verified problem or user outcome.
2. Scope and affected acceptance criteria.
3. Proposed implementation steps without changing code.
4. Test and evidence requirements.
5. Dependencies, privacy, migration, regression, and rollback considerations.
6. An explicit `Awaiting repository-owner approval` status.

## Approval boundary

Triage must not create or modify product code, branches, commits, pull requests, releases, deployments, live Appwrite data, or LeanKit cards. The repository owner decides whether a plan should proceed to implementation and must give separate explicit approval before any implementation starts.
