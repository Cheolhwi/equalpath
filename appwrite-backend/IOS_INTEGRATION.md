# EqualPath iOS integration contract

## 1. Add the Apple SDK

In Xcode, add the package:

```text
https://github.com/appwrite/sdk-for-apple
```

Create one shared client. The iOS target only receives the public endpoint and project ID.

```swift
import Appwrite
import AppwriteModels

let client = Client()
    .setEndpoint("https://sgp.cloud.appwrite.io/v1")
    .setProject("6a916a6c0030a70a9d75")

let account = Account(client)
let tablesDB = TablesDB(client)
let functions = Functions(client)
```

## 2. Google OAuth login

The first screen's Google button starts an Appwrite OAuth session. Appwrite creates or reuses the user and retains the Appwrite session after the callback.

```swift
import AppwriteEnums

try await account.createOAuth2Session(
    provider: .google,
    scopes: ["openid", "email", "profile"]
)

let user = try await account.get()
```

Add this callback scheme to `Info.plist`, replacing the project ID:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLName</key>
    <string>io.appwrite</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>appwrite-callback-6a916a6c0030a70a9d75</string>
    </array>
  </dict>
</array>
```

For a UIKit lifecycle, pass matching callback URLs to `WebAuthComponent.handleIncomingCookie(from:)` from `SceneDelegate.scene(_:openURLContexts:)`.

The registered Appwrite Apple platform currently uses Bundle ID `com.equalpath.ios`; the Xcode target must use the same value.

## 3. Execute the backend

Use a small wrapper that JSON-encodes the body and calls a Function with the active Appwrite session:

```swift
func execute(functionId: String, json: [String: Any]) async throws -> Execution {
    let data = try JSONSerialization.data(withJSONObject: json)
    let body = String(decoding: data, as: UTF8.self)
    return try await functions.createExecution(
        functionId: functionId,
        body: body,
        async: false
    )
}
```

After OAuth/onboarding, run the initial materialisation and scan:

```swift
_ = try await execute(
    functionId: "iteration1-core",
    json: ["action": "initial_sweep"]
)
```

All user changes use `save_row`, `delete_row`, `prune_schedule_span`, or `update_profile`. Do not write source rows directly from iOS; this is how the backend binds every row to the authenticated user instead of trusting a request field.

Example child creation:

```swift
_ = try await execute(
    functionId: "iteration1-core",
    json: [
        "action": "save_row",
        "table_id": "children",
        "data": ["display_name": "Child", "age_group": "5-12", "active": true]
    ]
)
```

The app can read owner-scoped `children`, dated schedule rows, `conflicts`, and `sweeps` directly with `TablesDB`. A conflict should be displayed from its `state`, not inferred from color: `uncovered` and `unknown` are intentionally different.

The iOS Schedule tab reads a seven-day owner-scoped window and writes dated work, required-care, and coverage records through the Function. A time range whose end is earlier than its start is explicitly treated as crossing midnight and saved as two rows sharing `span_group`; edits prune obsolete continuation rows. Generated weekly rows are deleted as `cancelled` overrides so the hourly materialiser does not recreate them.

## 4. Device-local reminders

EqualPath does not use APNs or Appwrite Messaging. Do not enable the Push Notifications capability, do not add `remote-notification` to `UIBackgroundModes`, and do not register a device token.

After the initial sweep and whenever the app launches or returns to the foreground:

1. Read the signed-in user's `notify_hour`, `timezone`, and `alert_gap` fields.
2. Read owner-scoped open `conflicts` for the rolling 14-day window.
3. Group conflicts by `date_local` so each date creates at most one notification.
4. Replace pending EqualPath requests in `UNUserNotificationCenter`. A conflict for Thursday fires Wednesday at the user's configured hour.
5. Remove all pending and delivered EqualPath notifications on logout or account deletion.

Request permission with the system API only:

```swift
let allowed = try await UNUserNotificationCenter.current().requestAuthorization(
    options: [.alert, .sound, .badge]
)
```

Use a stable identifier such as `equalpath.local-gap.2026-08-29` and a non-repeating `UNCalendarNotificationTrigger`. Notification text must stay privacy-minimal: say that tomorrow has a care gap or needs verification, then ask the user to open EqualPath for details.

The device can deliver already scheduled reminders while offline. It cannot learn about a cloud-side schedule change while the app stays closed, so every foreground sync must cancel stale requests and rebuild the next 14 days. This model requires notification permission, but it does not require a paid Apple Developer Program membership, an APNs key, or an Appwrite push Target.

## 5. Logout and account deletion

Logout deletes the current Appwrite session. Permanent deletion is a separate explicit action:

```swift
_ = try await execute(
    functionId: "delete-account",
    json: ["confirm": "DELETE"]
)
```

On success, clear local cached EqualPath data, pending local notifications, delivered local notifications, and navigation state; the server has already removed owned rows and the Auth user.
