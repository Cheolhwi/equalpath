# EqualPath iOS

Native SwiftUI implementation of the EqualPath mobile experience. The app is built from the design handoff in `../design_handoff_equalpath_ios` and the authenticated Appwrite contract in `../appwrite-backend/IOS_INTEGRATION.md`.

## Open and run

1. Open `EqualPath.xcodeproj` with `/Applications/Xcode.app`.
2. Let Xcode resolve the official Appwrite Apple SDK package.
3. Select an iPhone simulator and run the `EqualPath` scheme.

The checked-in project uses:

- iOS 17+
- SwiftUI
- Bundle ID `com.equalpath.ios`
- Appwrite endpoint `https://sgp.cloud.appwrite.io/v1`
- Appwrite project `6a916a6c0030a70a9d75`

The welcome screen offers a local preview path so the full experience can be reviewed without changing cloud data. Google sign-in uses the real Appwrite project and all user-owned writes go through the `iteration1-core` function.

The Schedule tab is the Iteration 1 rolling 14-day view. It loads owner-scoped Appwrite work, required-care, coverage, weekly-pattern, support-network, conflict, and sweep rows. It supports one-off entries, weekly-pattern creation/editing/deletion, single-day override or skip, and cross-midnight entries. Coverage captures who drops off and collects, the collection deadline, and three manual travel estimates; conflicts show exact intervals, source records, handover endpoints, and the applied rule.

## Cloud and notification status

- Google OAuth is configured in Appwrite for the current test account.
- The Appwrite OAuth callback and Apple platform Bundle ID are configured.
- Care-gap reminders are local notifications scheduled by the iPhone from the next 14 days of owner-scoped Appwrite conflicts.
- APNs, Appwrite Messaging, the Push Notifications capability, and a paid Apple Developer Program membership are not required for these reminders.
- A free Personal Team can be selected in Xcode when installing on a physical iPhone; the simulator needs no signing team.

No server API key or OAuth secret belongs in this repository.

The app rebuilds pending reminders after onboarding, at launch, and whenever it returns to the foreground. A reminder for Thursday is stored on the device for Wednesday at 21:00. If schedule data changes while EqualPath remains closed, open the app once to sync and replace stale pending reminders.

## Verification

Verified locally with the Xcode 26 toolchain and Appwrite Apple SDK 18.3.0:

- generic iOS Simulator build: passed
- iPhone 17 Pro simulator launch: passed
- `CoverageSummaryTests`: 15 passed, including 14-day boundaries, weekly-pattern requirements, complete handover input, cross-midnight input, no-data semantics, overlapping coverage, priority explanation, runtime error copy, and the preceding-day 21:00 local-reminder calculation
- Tomorrow, 14-day Schedule, add-entry transition, and editor/dock visual checks at native iPhone 17 Pro simulator resolution: passed

## Project layout

- `EqualPath/App`: application lifecycle and state
- `EqualPath/Core`: design tokens, reusable components, and domain models
- `EqualPath/Features`: onboarding and daily product surfaces
- `EqualPath/Services`: Appwrite boundary and device-local notification scheduling
- `EqualPathTests`: safety-critical ring/state presentation tests

`project.yml` mirrors the checked-in Xcode project and can be used with XcodeGen if desired. Debug builds accept `-EqualPathPreviewMain` and `-EqualPathPreviewSchedule` for deterministic design QA without cloud writes.

See the numbered acceptance-criteria evidence in [../appwrite-backend/ITERATION1_VERIFICATION.md](../appwrite-backend/ITERATION1_VERIFICATION.md).
