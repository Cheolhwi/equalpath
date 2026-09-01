# EqualPath Iteration 1 verification — rev E

Engineering verification date: 30 August 2026 (Asia/Kuala_Lumpur)

## Result

The rev E engineering scope is implemented and journey-checked: 3 epics, 10 user stories, and 31 acceptance criteria. The product baseline is Appwrite Google OAuth plus iPhone local notifications. The rolling 14-day plan, weekly-pattern management, single-day overrides, bidirectional handover calculation, source-linked conflict explanations and review-only response paths are included.

This is an engineering completion record, not a claim of mentor acceptance. On 30 August 2026 the journey was run from a fresh iPhone 17 Pro / iOS 26.5 simulator through Google OAuth, first-time setup, a real owner-scoped Appwrite write, first 14-day sweep, Tomorrow, day evidence, possible-path review, Schedule, weekly-pattern controls, People, Me and app relaunch. LeanKit was then reconciled to the same Word source and API-verified as 3 epics / 10 stories / 31 AC in the `DONE` lane.

## Acceptance-criteria evidence

| AC | Result | Evidence |
|---|---|---|
| 0.1.1 | Implemented | The welcome screen has one Google action and calls Appwrite OAuth; EqualPath contains no password form. |
| 0.1.2 | Implemented | A successful callback establishes one Appwrite owner profile keyed by Auth user ID; the same session/profile is reused on relaunch or later sign-in. |
| 0.1.3 | Implemented | Cancellation, network, provider and callback failures do not open the authenticated data space and preserve a retry path. |
| 0.2.1 | Implemented | Setup pre-fills the Google identity, keeps the authenticated email read-only and requires at least one named child with an age group. |
| 0.2.2 | Implemented | The guided flow captures registered care, work mode and times, broad areas, three manual travel estimates, optional support people and the local-reminder choice without live tracking or a map lookup. |
| 0.2.3 | Implemented | Completing setup writes owner-scoped profile, child, pattern and support data to Appwrite, materialises the 14-day horizon and returns the first verified sweep result; setup failure remains retryable. |
| 0.3.1 | Implemented | A valid keychain-backed Appwrite session restores directly to the owner experience. Successful sync rebuilds the next 14 days of 21:00 local reminders when permission and the setting are enabled. |
| 0.3.2 | Implemented | Sign-out clears session, local owner state and reminders. Confirmed deletion removes owner rows and Auth last; failure cannot appear as successful deletion. |
| 1.1.1 | Implemented | The editor captures date, time, title/type, location, remote flag, and priority, and saves through the authenticated Function. |
| 1.1.2 | Implemented | Work entries can be edited/deleted; generated entries expose single-day versus whole-pattern scope and trigger a fresh sweep. |
| 1.1.3 | Implemented | Validation blocks missing fields, invalid duration, location omissions, and dates outside the rolling 14-day window while retaining draft values. |
| 1.2.1 | Implemented | Owner-scoped children include age group and can receive dated required-care windows. |
| 1.2.2 | Implemented | Coverage records provider/carer, child, interval, and notes; overlapping coverage is merged before subtraction. |
| 1.2.3 | Implemented | Required-care and coverage entries share validated edit/delete flows and refresh the timeline and conflicts immediately. |
| 1.2.4 | Implemented | Coverage displays drop-off and collection responsibility and uses the three manually entered travel estimates; unassigned or incomplete handover inputs remain visibly unknown rather than no conflict. |
| 1.3.1 | Implemented | Schedule provides one 14-day, two-week date surface with a consistent legend and visually marks weekly-pattern occurrences. |
| 1.3.2 | Implemented | Exact covered/uncovered intervals are shown after merging; handover conflicts expose endpoint times and responsibility. |
| 1.3.3 | Implemented | Loading, empty, load failure, sweep failure/retry, refreshed, and no-schedule-data states are explicit. |
| 1.4.1 | Implemented | The editor creates weekly work, required-care, or coverage patterns with weekdays, time, and effective range. |
| 1.4.2 | Implemented | Pattern materialisation covers a rolling 14-day window and upserts one `(pattern, date)` occurrence idempotently. |
| 1.4.3 | Implemented | Generated occurrences can be changed/skipped for one day or managed as a whole pattern; pattern updates preserve and report overrides. |
| 2.1.1 | Implemented | Interval subtraction and strict positive-duration intersection produce exact overlap minutes and source records. |
| 2.1.2 | Implemented | Tests cover touching, nested, zero-length, partial, and cross-midnight cases; cross-midnight input becomes linked local-day rows. |
| 2.1.3 | Implemented | Conflict IDs use deterministic semantic keys and upsert, so repeated detection retains one current logical result. |
| 2.1.4 | Implemented | The engine calculates outbound and inbound handover gaps using responsibility, the relevant work record, and either care↔work or home↔care travel according to the work location; unknown inputs remain unknown. The third home↔work estimate is retained for complete journey context. |
| 2.2.1 | Implemented | Fixed, non-remote conflicts rank first, followed by start time and deterministic ID; ordering is tested. |
| 2.2.2 | Implemented | Conflict explanations name the child, interval, duration, source records, priority rule, and—for handover—the travel input and work boundary used. |
| 2.2.3 | Implemented | Stable sorting is deterministic; no-gap is shown only with sufficient evidence. Possible paths are explicitly review-only and cannot contact or confirm another person in Iteration 1. |
| 2.3.1 | Implemented | A successful schedule-change scan resolves absent conflicts with `resolution_reason = schedule_change`. |
| 2.3.2 | Implemented | Conflict identity excludes mutable interval boundaries, so a partially resolved conflict keeps its identity and updates its remaining interval. |
| 2.3.3 | Implemented | A failed sweep is recorded and cannot clear the last verified conflicts; iOS keeps those results visible with retry. |

## Automated and deployment evidence

- Backend configuration validation: 15 tables, 168 columns, 37 indexes, and 2 Functions.
- Backend automated tests: 34 passed, 0 failed.
- iOS automated tests: 15 passed, 0 failed on an iPhone 17 Pro / iOS 26.5 simulator.
- iOS simulator build and launch: passed.
- Journey evidence: Google OAuth completed on a fresh simulator, the eight-step setup wrote real Appwrite records, and the first sweep returned a source-linked 16:00–17:30 per-child gap with a 3h aggregate across two children.
- Visual QA: the 14-day selector, Appwrite schedule records, weekly-pattern scope menu, handover assignments, day evidence, review-only path sheet, account/privacy state, add-entry button, editor transition, and dock dismissal behavior were reviewed at native iPhone 17 Pro simulator resolution.
- Appwrite `iteration1-core` deployment: `6a93c81a572336037c84`, deployed and activated on 30 August 2026.
- Appwrite events cover Auth user creation plus schedule-pattern, work-commitment, care-commitment, and child-row changes; the scheduled sweep maintains the rolling horizon.
- Notifications are device-local and privacy-minimal. There is no APNs provider, device-token table, cloud delivery, or email fallback in Iteration 1.

## Human/process follow-up

- Demonstrate the 31 criteria to mentors and record their `ACCEPTED` or `REJECTED` decision and actual finish dates.
- Revisit APNs/cloud notification delivery only after an Apple Developer account is available; it is deliberately not a blocker for this iteration.
- Treat carer contact, secure-link response and confirmation as later-iteration delivery; the current Possible paths surface is review-only.
- Two journey-observed UI issues remain outside these AC: the whole-pattern editor still uses the `NEW ENTRY` / `Add to schedule` labels, and the People screen's `Add someone` control currently has no action.
