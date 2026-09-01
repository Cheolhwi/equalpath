# EqualPath Iteration 1 Handover

Last verified: 30 August 2026, Asia/Kuala_Lumpur  
Audience: the agent or developer starting Iteration 2  
Repository root: `/Users/cheolhwi/Documents/fit5120`

## Read this first

Iteration 1 is an implemented, journey-checked iOS and Appwrite baseline. It is not a complete end-to-end care-booking or carer-confirmation product.

The product decisions already fixed for this iteration are:

- Authentication is Appwrite Google OAuth only. EqualPath has no password, email-code or Sign in with Apple flow.
- Notifications are local iPhone notifications. There is no APNs provider, cloud push, device-token table or email fallback.
- The planning horizon is a rolling 14 local-calendar days.
- Weekly work, required-care and coverage patterns are materialised into dated occurrences.
- Travel inputs are three manually entered minute values. There is no map lookup or live location tracking.
- Conflict results must distinguish `uncovered`, `unknown` and verified no-gap states.
- Handover feasibility is calculated in both directions, but suggested responses are review-only. Iteration 1 cannot contact or obtain confirmation from another person.

Do not broaden or silently change these decisions while starting Iteration 2. Record any proposed change as a new product decision.

## Current completion snapshot

| Area | Current state | Backing |
|---|---|---|
| Google sign-in and session | Implemented | Appwrite Auth and iOS keychain-backed SDK session |
| Eight-step first-time setup | Implemented | SwiftUI; owner, children, care/work patterns, travel, support and preferences are written to Appwrite |
| Owner isolation | Implemented | Row permissions plus server-side `user_id` enforcement |
| Tomorrow result | Implemented | Owner-scoped Appwrite rows and latest verified sweep |
| Combined schedule | Implemented | Rolling 14-day Appwrite-backed view |
| One-off Work / Care needed / Care coverage | Implemented | Authenticated Function mutation boundary |
| Weekly patterns | Implemented | Create, materialise, whole-pattern edit/delete, day override and skip |
| Cross-midnight entries | Implemented | Linked local-day rows and continuation pruning |
| Care-gap detection | Implemented | Interval merge, subtraction and positive-duration work intersection |
| Inbound/outbound handover gaps | Implemented | Responsibility, work boundary and manual travel inputs |
| Conflict explanations | Implemented | Child, exact interval, duration, priority and source records |
| Local reminders | Implemented | Rebuilt on-device after successful sync for the preceding evening at 21:00 |
| Sign-out and account deletion | Implemented | Local cleanup; destructive server deletion requires explicit `DELETE` |
| Possible paths | Review UI only | Static sample paths; no solver result, delivery or confirmation |
| People screen | Static UI only | Sample people; `Add someone` currently has no action |
| Cloud notifications | Not implemented | Deferred until an Apple Developer account and a separate design decision exist |

The accepted Iteration 1 documentation baseline is **3 epics, 10 user stories and 31 Given/When/Then acceptance criteria**.

## Actual zero-to-returning-user journey

The journey was run on 30 August 2026 on an iPhone 17 Pro / iOS 26.5 simulator, starting without an EqualPath session:

1. Opened the welcome screen and selected **Continue with Google**.
2. Completed the real Appwrite Google OAuth provider flow. The human user selected the Google account and approved the provider consent screen.
3. Completed all eight setup steps: profile, children, registered care, work week, local notification preference, broad areas and three travel estimates, support people, and initial sweep.
4. Allowed iOS local notifications.
5. With explicit user permission, setup wrote real owner-scoped Appwrite rows and ran `initial_sweep`.
6. The first result showed two children with a combined 3-hour gap. The day evidence showed a 16:00–17:30 uncovered interval for each child, produced from coverage ending at 16:00, required care ending at 18:00 and work ending at 17:30.
7. Opened Tomorrow and See the day. The result named its source work, care-needed and coverage records.
8. Opened Possible paths. Both paths were visibly review-only; opening one stated that sending and confirmation were not enabled.
9. Opened Schedule. The 14-day selector loaded real Appwrite records, gap markers, weekly-pattern provenance and the scope menu for day-only versus whole-pattern actions.
10. Opened New Entry, checked Work / Care needed / Care coverage, weekly repeat and effective-date controls, then exited without saving an additional test entry.
11. Opened People and Me, checked account/privacy/local-notification messaging, terminated the app and relaunched it.
12. The existing Appwrite session resumed directly into the owner experience without repeating Google sign-in or onboarding.

The account identity and any credentials are intentionally omitted from this file. A real owner dataset from this journey exists in Appwrite. Do not sign out, delete the account, repeat onboarding or mutate those rows unless the user asks for that action.

## What is genuinely Appwrite-backed

The iOS app reads owner-permitted rows directly and routes user-owned mutations through the authenticated `iteration1-core` Function. The Function ignores a client-supplied `user_id`, derives the owner from Appwrite execution context and assigns owner permissions.

Current public configuration, which is not secret:

- Endpoint: `https://sgp.cloud.appwrite.io/v1`
- Project ID: `6a916a6c0030a70a9d75`
- Database ID: `equalpath`
- iOS bundle ID: `com.equalpath.ios`
- Core Function ID: `iteration1-core`
- Account deletion Function ID: `delete-account`
- Active `iteration1-core` deployment verified during Iteration 1: `6a93c81a572336037c84`
- Default timezone: `Asia/Kuala_Lumpur`
- Horizon: 14 days
- Scheduled maintenance: hourly (`0 * * * *`)

There are 15 configured tables, 168 columns and 37 indexes. The principal runtime tables are:

- Identity: `users`, `children`
- Schedule: `schedule_patterns`, `work_commitments`, `care_commitments`
- Detection: `sweeps`, `conflicts`
- Planning/support provisioned for later work: `support_network`, `plans`, `plan_segments`, `plan_feedback`, `confirmation_requests`
- Reference: `childcare_providers`, `district_population`, `strategy_library`

The planning tables being provisioned does **not** mean the plan solver, outbound request workflow or carer confirmation flow is implemented.

## Runtime flow and invariants

```text
Google OAuth
    -> Appwrite Auth session
    -> owner profile
    -> onboarding writes patterns/support/profile
    -> materialise rolling 14-day occurrences
    -> per-child conflict sweep
    -> sweeps + conflicts
    -> iOS Tomorrow/Schedule reads
    -> successful sync rebuilds local iPhone reminders
```

Preserve these invariants in Iteration 2:

- Local schedule dates use `YYYY-MM-DD` plus minute-of-day boundaries; do not convert weekly schedules into naive UTC timestamps.
- Overlapping coverage is merged before required-care subtraction.
- Touching intervals have zero duration and are not conflicts.
- A child's coverage must never cover another child.
- Unknown coverage or missing handover inputs remain `unknown`/review; they are not proof of no gap.
- Handover-out uses the applicable preceding work end plus travel to care. Handover-in uses the applicable following work start minus travel from care.
- Home work uses home-to-care travel; other work uses care-to-work travel. Home-to-work remains part of the complete user-entered journey context.
- Conflict identity is deterministic and does not depend on mutable interval boundaries, so partial resolution updates one logical conflict.
- Repeated materialisation and detection must be idempotent.
- A failed sweep records failure and cannot clear the last verified conflicts or rebuild reminders from unverified state.
- Pattern edits must preserve deliberate single-day overrides and skips.
- Cross-midnight data is split into linked local-day rows.
- Account deletion removes Auth last, after owned data and outstanding confirmation-request cleanup.

## Main code map

### iOS

- App lifecycle and state transitions: [`equalpath/EqualPath/App/AppState.swift`](equalpath/EqualPath/App/AppState.swift)
- Root phase routing and foreground refresh: [`equalpath/EqualPath/RootView.swift`](equalpath/EqualPath/RootView.swift)
- Domain/view models and validation: [`equalpath/EqualPath/Core/Models.swift`](equalpath/EqualPath/Core/Models.swift)
- Google OAuth, Appwrite reads and Function mutations: [`equalpath/EqualPath/Services/AppwriteEqualPathService.swift`](equalpath/EqualPath/Services/AppwriteEqualPathService.swift)
- Local notification scheduling: [`equalpath/EqualPath/Services/LocalNotificationManager.swift`](equalpath/EqualPath/Services/LocalNotificationManager.swift)
- Welcome and Google entry: [`equalpath/EqualPath/Features/Onboarding/WelcomeView.swift`](equalpath/EqualPath/Features/Onboarding/WelcomeView.swift)
- Eight-step setup and first result: [`equalpath/EqualPath/Features/Onboarding/OnboardingFlowView.swift`](equalpath/EqualPath/Features/Onboarding/OnboardingFlowView.swift)
- Tomorrow: [`equalpath/EqualPath/Features/Tonight/TonightView.swift`](equalpath/EqualPath/Features/Tonight/TonightView.swift)
- Day evidence: [`equalpath/EqualPath/Features/Day/DayDetailView.swift`](equalpath/EqualPath/Features/Day/DayDetailView.swift)
- 14-day Schedule, entry editor, pattern scope and static review paths: [`equalpath/EqualPath/Features/Plans/PlansView.swift`](equalpath/EqualPath/Features/Plans/PlansView.swift)
- iOS 26 circular add button and zoom transition: [`equalpath/EqualPath/Features/MainTabView.swift`](equalpath/EqualPath/Features/MainTabView.swift)
- Static People screen: [`equalpath/EqualPath/Features/People/PeopleView.swift`](equalpath/EqualPath/Features/People/PeopleView.swift)
- Account/privacy UI: [`equalpath/EqualPath/Features/Settings/SettingsView.swift`](equalpath/EqualPath/Features/Settings/SettingsView.swift)
- iOS unit tests: [`equalpath/EqualPathTests/CoverageSummaryTests.swift`](equalpath/EqualPathTests/CoverageSummaryTests.swift)

### Appwrite backend

- Function event and action router: [`appwrite-backend/functions/iteration1-core/src/main.js`](appwrite-backend/functions/iteration1-core/src/main.js)
- Owner-scoped mutations, materialisation and sweep persistence: [`appwrite-backend/functions/iteration1-core/src/service.js`](appwrite-backend/functions/iteration1-core/src/service.js)
- Exact interval operations: [`appwrite-backend/functions/iteration1-core/src/domain/intervals.js`](appwrite-backend/functions/iteration1-core/src/domain/intervals.js)
- Per-child gap and bidirectional handover detection: [`appwrite-backend/functions/iteration1-core/src/domain/conflicts.js`](appwrite-backend/functions/iteration1-core/src/domain/conflicts.js)
- Deterministic weekly occurrence generation: [`appwrite-backend/functions/iteration1-core/src/domain/materialise.js`](appwrite-backend/functions/iteration1-core/src/domain/materialise.js)
- Local-date helpers: [`appwrite-backend/functions/iteration1-core/src/domain/dates.js`](appwrite-backend/functions/iteration1-core/src/domain/dates.js)
- Function IDs/events/scopes/schedule: [`appwrite-backend/appwrite/functions.json`](appwrite-backend/appwrite/functions.json)
- Backend tests: [`appwrite-backend/tests/`](appwrite-backend/tests/)

## Known gaps and debt to carry into Iteration 2

These are observed facts, not speculative enhancements:

1. **Possible paths are static.** `PlanOption.samples` drives the two visible paths. They are not read from `plans` or generated from the selected conflict.
2. **People is static.** Farid and Mother are hard-coded in the view, and `Add someone` has an empty action. Onboarding does write support rows, but this screen does not load or manage them.
3. **Cloud settings are not rehydrated into `AppState.onboarding`.** The Me screen reads several values from the in-memory `OnboardingDraft`, whose defaults resemble the demo setup. After relaunch, those labels are not a trustworthy cloud settings view.
4. **Onboarding routing depends on local `UserDefaults`.** Although `onboarding_completed` is written to the Appwrite profile, bootstrap checks `equalpath.onboardingCompleted` locally. A reinstall or another device can route an already configured account through setup again.
5. **Whole-pattern editor copy is wrong.** Editing a whole weekly pattern still uses the `NEW ENTRY` / `Add to schedule` wording because the title and primary-button copy depend on `draft.id`, not `draft.editingPattern`.
6. **Plan delivery and confirmation do not exist.** No message, secure link, recipient response, expiry, retry, idempotent confirmation state machine or notification delivery has been implemented.
7. **Cloud push does not exist.** Add APNs/Appwrite Messaging only after an Apple Developer account and explicit notification architecture decision exist.
8. **Public App Store compliance remains a separate release concern.** If Google remains a third-party sign-in method, evaluate the current App Store login requirements before public submission; this was not part of the internal Iteration 1 build.

The earlier schedule-tab interaction issues were corrected and journey-checked: switching to Schedule no longer automatically opens New Entry, the add control is a true circular system control, the plus glyph is visible, the editor uses a native zoom navigation transition, and the bottom tab bar returns during interactive dismissal rather than waiting for a sheet to disappear.

## Recommended Iteration 2 starting order

1. Make profile/setup state server-driven: load the Appwrite profile, children, support network and preferences on bootstrap; use the cloud `onboarding_completed` flag as the source of truth.
2. Replace People sample rows with owner-scoped `support_network` list/create/edit/delete flows.
3. Define a real plan-generation contract from a selected conflict into `plans` and `plan_segments`. Preserve source references and deterministic/idempotent generation.
4. Replace `PlanOption.samples` with Appwrite-backed plans and make review state explicit.
5. Design the handover request state machine before adding delivery: draft, approved-to-send, sent, delivered, accepted/declined/expired/cancelled, with actor authority, idempotency and audit fields.
6. Add the secure-link/carer response surface only after its authentication, privacy, replay, expiry and account-linking rules are decided.
7. Decide whether local notifications remain sufficient. If cloud delivery is approved and an Apple Developer account is available, introduce APNs/device-token lifecycle as a separate bounded capability.
8. Fix the whole-pattern editor labels and add UI/integration tests for People, server-rehydrated Me, multi-device onboarding and the real plan flow.

Do not start by wiring a Send button to a message API. The request state machine, recipient identity, least-data payload, expiry, retries and duplicate-delivery behavior must be specified first.

## Verification status and commands

Verification rerun for this handover on 30 August 2026:

- Backend configuration: 15 tables, 168 columns, 37 indexes, 2 Functions — passed.
- Backend automated tests: 34 passed, 0 failed.
- iOS `CoverageSummaryTests`: 15 passed, 0 failed on iPhone 17 Pro / iOS 26.5.
- Word and HTML requirements: 3 epics, 10 stories, 31 AC — matched.
- Word visual QA: 33 rendered pages reviewed with no clipping or overflow.
- LeanKit: 44 cards in DONE, representing 3 epics + 10 stories + 31 AC, with hierarchy and metadata verified.

Backend:

```sh
cd /Users/cheolhwi/Documents/fit5120/appwrite-backend
npm run check
npm test
```

iOS from Xcode:

1. Open `/Users/cheolhwi/Documents/fit5120/equalpath/EqualPath.xcodeproj` in the full Xcode app.
2. Resolve the checked-in Swift packages if needed.
3. Select an iPhone 17 Pro simulator and run the `EqualPath` scheme or its tests.

For a command-line run, make sure the full Xcode developer directory is active and select an available simulator rather than assuming a permanent device UDID. The Appwrite Apple SDK and its transitive packages may require network access when the local package cache is empty.

Debug-only preview arguments are available for visual QA without cloud writes:

- `-EqualPathPreviewMain`
- `-EqualPathPreviewSchedule`

Preview mode is not valid evidence for Appwrite integration or the zero-to-returning-user journey.

## Requirements and process sources

- Journey-aligned Word source: [`design artifacts/EqualPath_Epics_User_Stories_DOD.docx`](design%20artifacts/EqualPath_Epics_User_Stories_DOD.docx)
- Iteration 1 HTML specification: [`design artifacts/EqualPath_Iteration1_Spec.html`](design%20artifacts/EqualPath_Iteration1_Spec.html)
- Numbered engineering evidence: [`appwrite-backend/ITERATION1_VERIFICATION.md`](appwrite-backend/ITERATION1_VERIFICATION.md)
- iOS integration contract: [`appwrite-backend/IOS_INTEGRATION.md`](appwrite-backend/IOS_INTEGRATION.md)
- iOS README: [`equalpath/README.md`](equalpath/README.md)
- Backend README: [`appwrite-backend/README.md`](appwrite-backend/README.md)

LeanKit reconciliation status:

- Board ID: `2494615679`
- DONE lane ID: `2494615693`
- Card types: Epic `2494615684`, User Story `2494615683`, Acceptance Criteria `2494615685`
- Planned dates: 25–30 August 2026
- Final count: 44 cards, exactly one owner per card, no duplicate identifiers, hierarchy `Epic -> User Story -> Acceptance Criteria`
- The Word document above is the content source used for the final reconciliation.

The local reconciliation helper is currently at `tmp/sync_iteration1_actual_leankit.mjs`. It contains no credentials and is idempotent by card identifier, but it is a one-off helper under `tmp`; move or replace it with a maintained script before making LeanKit synchronization part of Iteration 2 delivery automation.

## Security and mutation guardrails

- Never commit Google client secrets, Appwrite server API keys, OAuth tokens, account emails or passwords.
- Do not read credentials from the user's iOS keychain. OAuth consent and account selection are human steps.
- Treat the existing Appwrite owner data as live user data. Use preview mode or a separate test account for destructive experiments.
- All owner writes must continue through the Function boundary; do not let iOS forge `user_id` or server-owned fields.
- Do not delete the active Appwrite account, reset the live dataset, send external messages or alter LeanKit cards unless the user explicitly authorises that scope.
- Preserve the last verified conflict/reminder state when refresh fails.
- Do not label missing evidence as no gap, and do not present a draft plan as sent or confirmed.

## Definition of a clean Iteration 2 handoff start

Before changing code, the next agent should be able to state all of the following correctly:

- Iteration 1 signs in with Google through Appwrite and uses local iPhone notifications.
- The 14-day schedule and conflict/handover calculation are real Appwrite-backed functionality.
- Possible paths and People are currently static/review-only surfaces.
- `unknown` is a first-class safety state and failed sweeps cannot clear verified warnings.
- Appwrite owner isolation and deterministic/idempotent materialisation are non-negotiable invariants.
- The existing live owner data must not be destroyed or silently repurposed.
- Iteration 2 should begin with server-rehydrated profile/support state and a specified handover request state machine, not with an unguarded Send button.
