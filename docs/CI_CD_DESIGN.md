# EqualPath Iteration 1 — CI/CD Design

Status: implemented design for the isolated Iteration 1 submission snapshot  
Baseline date: 2026-08-30  
Repository scope: `equalpath/` iOS app and `appwrite-backend/` only

## 1. Brainstorm

The delivery has three goals: make the frozen Iteration 1 build reproducible, prevent regressions, and provide a reviewable release without touching the live Appwrite owner data.

Options considered:

1. Separate iOS and backend repositories. This gives independent histories but splits one iteration baseline across two locations and complicates evidence links.
2. A monorepo containing the iOS app and Appwrite backend. This keeps the tested client/server contract and the acceptance evidence together.
3. Automatic deployment to the live Appwrite project after every push. This is fast but is unsafe for an assessment snapshot and risks modifying an existing live environment.
4. Continuous delivery to a versioned GitHub Release, with production Appwrite deployment left as an explicitly approved manual operation.

Selected approach: a monorepo with continuous integration on pushes and pull requests, plus release packaging on version tags. No workflow mutates the live Appwrite project.

## 2. Initial design

### CI quality gates

- Backend configuration validation: verify the checked-in Appwrite schema and function configuration.
- Backend tests: install exact locked dependencies for the root package and both function packages, then run all Node test files.
- iOS tests: resolve the locked Swift package, dynamically select an available iPhone simulator, and run `CoverageSummaryTests` through the shared `EqualPath` scheme.
- Evidence retention: upload the Xcode result bundle even if the iOS test job fails.

### CD boundary

- A tag matching `v*` packages the tracked repository contents into an immutable zip archive.
- The workflow creates a SHA-256 checksum and publishes both files in a GitHub Release.
- The release workflow does not run `appwrite push`, use production credentials, migrate data, or write user records.

### Issue intake

- Structured bug and feature templates collect reproduction steps, acceptance impact, privacy/data concerns, and evidence.
- Issue monitoring is advisory: feasibility is reported to the project owner; no issue is closed, labelled, or answered automatically.
- A reproducible bug or feasible feature produces a review and implementation plan only. The plan must cover scope, affected acceptance criteria, proposed steps, tests, risks, and rollback considerations.
- A positive triage result is not implementation approval. No code change, branch, commit, pull request, deployment, or live-data mutation may begin until the repository owner explicitly approves implementation.
- Push and pull-request CI remain separate from issue intake; opening or updating an issue cannot trigger a build or code change.

## 3. Codex design review

The initial design was reviewed against the Iteration 1 handover and the invariant that later iteration work and live Appwrite owner data must remain unaffected.

Improvements applied after review:

- The repository source was changed from the active workspace to a separate copy of the frozen `iteration1-demo-20260830` snapshot.
- Local `node_modules`, Xcode user state, simulator data, `.env` files, build caches, and later-iteration files are excluded.
- Backend function dependencies are installed independently because the function packages have their own lock files; this avoids the previously observed false failures caused by missing local runtime dependencies.
- The iOS simulator is selected dynamically rather than relying on a model name that may not exist on a future GitHub runner.
- The release process is delivery-only. A live Appwrite deployment remains outside CI/CD until a separate environment, secrets, rollback plan, and explicit owner approval are available.
- Test evidence distinguishes the historical authenticated journey from repeatable local preview and automated checks, so an expired OAuth session cannot be misreported as a passing current login.

## 4. Implemented workflow

- `.github/workflows/ci.yml`: backend validation/tests and iOS simulator tests.
- `.github/workflows/release.yml`: tag-triggered release packaging and checksum publication.
- `.github/ISSUE_TEMPLATE/`: structured bug and feature intake.
- `.github/dependabot.yml`: weekly dependency update proposals for the Node packages and GitHub Actions.

## 5. Review checklist

- [x] Only the isolated Iteration 1 snapshot is in repository scope.
- [x] No credential or `.env` file is committed.
- [x] CI uses lock files and repeatable commands.
- [x] Backend configuration and unit tests are separate visible gates.
- [x] iOS tests run on an available simulator and retain the result bundle.
- [x] CD produces a versioned, checksummed release artifact.
- [x] No automated workflow can mutate the live Appwrite project.
- [x] Issue automation is review-only.
- [x] Accepted issues stop at an owner-reviewable plan and require explicit implementation approval.
- [x] Iteration 2 source directories are not modified or included.
