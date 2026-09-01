import Foundation

@MainActor
protocol EqualPathServing {
    func currentUser() async throws -> UserProfile?
    func signInWithGoogle() async throws -> UserProfile
    func completeOnboarding(_ draft: OnboardingDraft) async throws
    func runInitialSweep() async throws
    func runRefreshSweep() async throws
    func tomorrowSnapshot() async throws -> TomorrowSnapshot
    func weekSchedule(startingAt startDate: Date) async throws -> WeekSchedule
    func saveScheduleEntry(_ draft: ScheduleEntryDraft) async throws -> ScheduleSaveResult
    func deleteScheduleEntry(_ entry: ScheduleEntry) async throws
    func deleteSchedulePattern(_ patternID: String) async throws -> ScheduleSaveResult
    func localNotificationPlans() async throws -> [LocalNotificationPlan]
    func logout() async throws
    func deleteAccount() async throws
}

struct ScheduleSaveResult: Equatable, Sendable {
    var preservedOverrideCount: Int = 0
}

struct LocalNotificationPlan: Equatable, Sendable {
    let dateLocal: String
    let notifyHour: Int
    let timezoneIdentifier: String
    let uncoveredMinutes: Int
    let needsVerification: Bool
}

enum EqualPathServiceError: LocalizedError {
    case notSignedIn
    case invalidResponse
    case backend(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: "Please sign in before continuing."
        case .invalidResponse: "EqualPath received an unexpected response. Please try again."
        case .backend(let message):
            switch message {
            case "backend_operation_failed":
                "EqualPath’s backend couldn’t save this setup. Please try again."
            case "account_deletion_failed":
                "EqualPath couldn’t delete the account. Nothing was removed. Please try again."
            default:
                message
            }
        }
    }
}
