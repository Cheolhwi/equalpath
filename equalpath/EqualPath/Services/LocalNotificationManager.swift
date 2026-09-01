import UIKit
import UserNotifications

final class EqualPathAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}

@MainActor
enum LocalNotificationManager {
    private static let identifierPrefix = "equalpath.local-gap."

    static func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    static func replaceScheduledReminders(with plans: [LocalNotificationPlan]) async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()

        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized ||
                settings.authorizationStatus == .provisional else { return }

        for plan in plans {
            guard let fireDate = reminderDate(for: plan) else { continue }
            let content = UNMutableNotificationContent()
            content.title = "EqualPath schedule check"
            content.body = plan.uncoveredMinutes > 0
                ? "Tomorrow has a care gap. Open EqualPath to review it."
                : "Tomorrow’s care schedule needs verification. Open EqualPath to review it."
            content.sound = .default
            content.threadIdentifier = "equalpath.schedule"
            content.userInfo = ["route": "tomorrow", "date_local": plan.dateLocal]

            let timezone = TimeZone(identifier: plan.timezoneIdentifier) ?? .current
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = timezone
            var components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
            components.timeZone = timezone
            let request = UNNotificationRequest(
                identifier: identifierPrefix + plan.dateLocal,
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            )
            try? await center.add(request)
        }
    }

    static func cancelAll() {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
    }

    static func reminderDate(for plan: LocalNotificationPlan, now: Date = Date()) -> Date? {
        let parts = plan.dateLocal.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        let timezone = TimeZone(identifier: plan.timezoneIdentifier) ?? .current
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        var targetComponents = DateComponents()
        targetComponents.calendar = calendar
        targetComponents.timeZone = timezone
        targetComponents.year = parts[0]
        targetComponents.month = parts[1]
        targetComponents.day = parts[2]
        targetComponents.hour = plan.notifyHour
        targetComponents.minute = 0
        guard let targetDate = calendar.date(from: targetComponents),
              let fireDate = calendar.date(byAdding: .day, value: -1, to: targetDate),
              fireDate > now else { return nil }
        return fireDate
    }
}
