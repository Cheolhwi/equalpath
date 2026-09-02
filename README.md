# EqualPath Iteration 1 Demo Snapshot

This repository contains the isolated EqualPath Iteration 1 demo snapshot completed and verified on 30 August 2026. It is intended for stable demonstration, assessment, review, and recovery. Active Iteration 2 development remains in the separate main workspace and must not be carried out in this snapshot.

## Safest way to run the demo

1. Open `equalpath/EqualPath.xcodeproj` in Xcode.
2. Select the shared `EqualPath Iteration 1 Demo` scheme.
3. Choose an iPhone simulator and run the application.

The demo scheme automatically passes `-EqualPathPreviewMain` and opens the local preview experience. Preview mode uses deterministic sample data: it does not sign in with Google, write to Appwrite, send external messages, or create cloud notifications.

To demonstrate the first-entry experience, use the standard `EqualPath` scheme and select **Preview without signing in** on the welcome screen. Do not sign in through the standard scheme or modify the existing Appwrite owner data unless that action has been explicitly authorised.

## Snapshot contents

- `equalpath/`: buildable SwiftUI iOS project, tests, fonts, design QA screenshots, and a `Package.resolved` file pinned to Appwrite Apple SDK 18.3.0.
- `appwrite-backend/`: Iteration 1 Appwrite configuration, two Functions, 34 automated tests, and integration guidance.
- `design-artifacts/`: the final three-Epic, ten-User-Story, 31-Acceptance-Criteria Word baseline and Iteration 1 HTML specification.
- `design_handoff_equalpath_ios/`: the iOS design handoff source used for Iteration 1.
- `ITERATION1_HANDOVER.md`: implementation status, verified journey, non-negotiable invariants, known gaps, and the safe Iteration 2 starting point.
- `SHA256SUMS`: SHA-256 checksums for every snapshot file except the checksum manifest itself.

Build caches, `node_modules`, `.env` files, local Appwrite state, Xcode user state, and `.DS_Store` files are excluded. Locked dependencies can be restored from the checked-in lock files.

## Verified baseline

The following checks were rerun before the snapshot was published:

- iOS Simulator Debug build using the demo scheme: PASS with Xcode 26.6.
- iOS `CoverageSummaryTests`: 15 passed, 0 failed.
- Backend configuration: 15 tables, 168 columns, 37 indexes, and two Functions validated.
- Backend automated tests: 34 passed, 0 failed.
- The complete Iteration 1 journey and acceptance evidence are documented in `ITERATION1_HANDOVER.md`.

The repository CI repeats the backend validation and tests together with the iOS simulator test suite on pushes and pull requests. A `v*` tag creates an immutable source archive and SHA-256 checksum without deploying to or mutating live Appwrite.

## Restore and revalidate

For iOS, open `equalpath/EqualPath.xcodeproj`, allow Swift Package dependencies to resolve, select `EqualPath Iteration 1 Demo`, and run it on an available iPhone simulator.

For the backend:

```sh
cd appwrite-backend
npm install
npm run check
npm test
```

To verify snapshot integrity:

```sh
shasum -a 256 -c SHA256SUMS
```

## Known boundaries

Possible Paths and People remain static or read-only demo surfaces. Real plan generation, sending, caregiver confirmation, and cloud push delivery are outside the Iteration 1 scope.

Maximum Dynamic Type currently exposes the tracked accessibility issue `I1-A11Y-01`: the editorial headline can wrap inside a word and the persistent tab bar reduces the visible content area. The frozen Iteration 1 baseline is preserved for assessment; any remediation must be scheduled and regression-tested separately.

All future work must preserve the `unknown` safety state, authenticated owner isolation, idempotent materialisation and conflict scanning, and the rule that a failed scan cannot clear the last verified conflict result.
