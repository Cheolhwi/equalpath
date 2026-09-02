# EqualPath Iteration 1 Web Preview design

## Purpose

Provide a small, public, interactive web representation of the frozen EqualPath Iteration 1 experience for assessment and product walkthroughs. The preview is an explanatory artefact, not a browser port of the native iOS application and not a production client.

## Guardrails

- Use deterministic local sample data only.
- Do not provide Google OAuth, Appwrite credentials, network mutations, account deletion, messaging, booking, or notification delivery.
- Label the experience as a safe preview in the first viewport and in the persistent shell.
- Preserve the frozen `v0.1.0` source release and do not touch the active Iteration 2 workspace.
- Keep Unknown visually and semantically distinct from No gap.
- Name the records used to explain a conflict instead of claiming an unexplained result.

## Brainstorm

### Option A — publish the existing design-component prototype

Fastest, but rejected. It depends on a design runtime and external React scripts, covers setup more than the daily product, uses a fixed desktop canvas, and its handoff explicitly says not to ship the HTML.

### Option B — compile SwiftUI to the web

Rejected for Iteration 1. The native app has no supported web target, and introducing a Swift-to-Web framework would materially expand the dependency and maintenance surface for an assessment preview.

### Option C — purpose-built static preview

Selected. Plain HTML, CSS and JavaScript can truthfully represent the core journey, remain easy to inspect, build without third-party packages, and deploy safely through GitHub Pages.

## Selected experience

The public route opens with a clear preview notice and a single `Enter safe preview` action. The product shell then offers four familiar surfaces:

1. **Tonight** — uncovered-time ring, source records, explanation drawer and safe-state language.
2. **Schedule** — selectable 14-day strip with covered, uncovered and Unknown examples.
3. **People** — static support-person availability with an explicit read-only label.
4. **Me** — local preview preferences and a reset action; no account controls that could imply a real session.

Interactions are keyboard and touch accessible. The layout adapts from a phone-sized card to a two-column desktop presentation without pretending to be a fully responsive production web application.

## State model

The preview state contains the active surface, selected schedule day, evidence-drawer state, local-reminder preference and whether the welcome notice has been acknowledged. All transitions are local and resettable. No state is uploaded or persisted across devices.

The schedule fixtures deliberately contain:

- an uncovered day with exact source evidence;
- a no-gap day backed by sufficient coverage;
- an Unknown day where evidence is missing.

## CI/CD design

`web-preview/scripts/build.mjs` validates the required source files and produces a clean `web-preview/dist` directory. Node's built-in test runner verifies the state reducer, status vocabulary, evidence mapping and build-output contract.

The GitHub Pages workflow:

1. checks out the repository;
2. installs the locked, dependency-free preview package;
3. runs tests and the deterministic build;
4. uploads only `web-preview/dist` as the Pages artefact;
5. deploys through the protected `github-pages` environment.

It has read-only repository permission plus only the `pages: write` and `id-token: write` permissions required for deployment. It never receives Appwrite secrets and cannot deploy backend configuration.

## Codex design review

The first concept focused on a clickable onboarding sequence. Review identified three weaknesses: it duplicated a design-only artefact, did not demonstrate the nightly value proposition, and could be mistaken for a real sign-in path. The design was improved by centring the daily conflict journey, adding persistent preview labelling, including all three truth states, and omitting authentication entirely.

The first deployment concept copied source files directly. Review added a deterministic build step, a pure state model with unit tests, a generated build metadata file, minimal Pages permissions, and path-scoped workflow triggers. These controls make the preview repeatable without turning CI into a live-deployment mechanism.

## Review checklist

- [ ] Welcome notice states that data is local and no account is created.
- [ ] Tonight, Schedule, People and Me are interactive.
- [ ] Uncovered, No gap and Unknown are visibly and textually distinct.
- [ ] Normal mobile and wide layouts remain usable.
- [ ] Buttons have accessible names, focus styles and at least 44 px targets.
- [ ] Reduced-motion users do not receive looping animation.
- [ ] Tests and deterministic build pass locally and in GitHub Actions.
- [ ] GitHub Pages URL responds successfully after deployment.
