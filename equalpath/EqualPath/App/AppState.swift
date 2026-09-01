import Combine
import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published var phase: AppPhase = .launching
    @Published var profile: UserProfile?
    @Published var onboarding = OnboardingDraft()
    @Published var snapshot = TomorrowSnapshot.empty
    @Published var snapshotLoadState: SnapshotLoadState = .idle
    @Published var weekSchedule = WeekSchedule.empty
    @Published var weekScheduleLoadState: SnapshotLoadState = .idle
    @Published var isBusy = false
    @Published var isDemoMode = false
    @Published var errorMessage: String?
    @Published var scheduleNotice: String?

    private let service: any EqualPathServing

    init(service: (any EqualPathServing)? = nil) {
        self.service = service ?? AppwriteEqualPathService()
    }

    func bootstrap() async {
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-EqualPathPreviewMain") {
            isDemoMode = true
            profile = UserProfile(id: "preview", name: "Aina", email: "aina@example.com")
            snapshot = .preview
            snapshotLoadState = .loaded
            weekSchedule = .preview()
            weekScheduleLoadState = .loaded
            phase = .main
            return
        }
#endif
        profile = try? await service.currentUser()
        if profile != nil {
            let onboardingCompleted = UserDefaults.standard.bool(forKey: "equalpath.onboardingCompleted")
            phase = onboardingCompleted ? .main : .onboarding
            if onboardingCompleted {
                await refreshTomorrowSnapshot()
                await refreshLocalNotifications()
            }
        } else {
            phase = .welcome
        }
    }

    func signInWithGoogle() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            let signedIn = try await service.signInWithGoogle()
            profile = signedIn
            onboarding.name = signedIn.name.isEmpty ? onboarding.name : signedIn.name
            onboarding.email = signedIn.email
            phase = .onboarding
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func enterPreview() {
        isDemoMode = true
        profile = UserProfile(id: "preview", name: "Aina", email: "aina@example.com")
        snapshot = .preview
        snapshotLoadState = .loaded
        weekSchedule = .preview()
        weekScheduleLoadState = .loaded
        phase = .onboarding
    }

    func finishOnboarding() async throws {
        isBusy = true
        defer { isBusy = false }
        if !isDemoMode {
            try await service.completeOnboarding(onboarding)
            try await service.runInitialSweep()
            snapshot = try await service.tomorrowSnapshot()
            snapshotLoadState = .loaded
            UserDefaults.standard.set(true, forKey: "equalpath.onboardingCompleted")
            if onboarding.notificationEnabled {
                _ = await LocalNotificationManager.requestPermission()
                await refreshLocalNotifications()
            } else {
                LocalNotificationManager.cancelAll()
            }
        } else {
            try await Task.sleep(for: .milliseconds(900))
            UserDefaults.standard.set(true, forKey: "equalpath.onboardingCompleted")
        }
    }

    func enterMainExperience() {
        phase = .main
        Task { await refreshTomorrowSnapshot() }
    }

    func refreshTomorrowSnapshot() async {
        guard profile != nil, !isDemoMode else { return }
        snapshotLoadState = .loading
        do {
            snapshot = try await service.tomorrowSnapshot()
            snapshotLoadState = .loaded
        } catch {
            snapshotLoadState = .failed(error.localizedDescription)
        }
    }

    func recalculateAndRefresh() async {
        guard profile != nil, !isDemoMode else { return }
        do {
            try await service.runRefreshSweep()
        } catch {
            errorMessage = error.localizedDescription
        }
        await refreshTomorrowSnapshot()
        await refreshLocalNotifications()
    }

    func refreshWeekSchedule(startingAt startDate: Date) async {
        guard profile != nil else { return }
        if isDemoMode {
            weekSchedule = .preview(startingAt: startDate)
            weekScheduleLoadState = .loaded
            return
        }
        weekScheduleLoadState = .loading
        do {
            weekSchedule = try await service.weekSchedule(startingAt: startDate)
            weekScheduleLoadState = .loaded
        } catch {
            weekScheduleLoadState = .failed(error.localizedDescription)
        }
    }

    func saveScheduleEntry(_ draft: ScheduleEntryDraft, weekStarting startDate: Date) async throws {
        guard !isDemoMode else { return }
        let result = try await service.saveScheduleEntry(draft)
        if draft.editingPattern {
            scheduleNotice = result.preservedOverrideCount == 1
                ? "Weekly pattern updated. One single-day change was preserved."
                : "Weekly pattern updated. \(result.preservedOverrideCount) single-day changes were preserved."
        } else if draft.repeatWeekly {
            scheduleNotice = "Weekly pattern saved across the rolling fourteen-day plan."
        }
        await refreshWeekSchedule(startingAt: startDate)
        await refreshTomorrowSnapshot()
        await refreshLocalNotifications()
    }

    func deleteSchedulePattern(_ patternID: String, planningFrom startDate: Date) async throws {
        guard !isDemoMode else { return }
        let result = try await service.deleteSchedulePattern(patternID)
        scheduleNotice = result.preservedOverrideCount == 1
            ? "Weekly pattern deleted. One single-day change was kept."
            : "Weekly pattern deleted. \(result.preservedOverrideCount) single-day changes were kept."
        await refreshWeekSchedule(startingAt: startDate)
        await refreshTomorrowSnapshot()
        await refreshLocalNotifications()
    }

    func deleteScheduleEntry(_ entry: ScheduleEntry, weekStarting startDate: Date) async throws {
        guard !isDemoMode else { return }
        try await service.deleteScheduleEntry(entry)
        await refreshWeekSchedule(startingAt: startDate)
        await refreshTomorrowSnapshot()
        await refreshLocalNotifications()
    }

    func refreshLocalNotifications() async {
        guard profile != nil,
              !isDemoMode,
              UserDefaults.standard.bool(forKey: "equalpath.onboardingCompleted") else { return }
        do {
            let plans = try await service.localNotificationPlans()
            await LocalNotificationManager.replaceScheduledReminders(with: plans)
        } catch {
            // Keep already scheduled reminders when a refresh cannot reach Appwrite.
        }
    }

    func logout() async {
        isBusy = true
        defer { isBusy = false }
        do {
            if !isDemoMode { try await service.logout() }
            clearLocalSession()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteAccount() async throws {
        isBusy = true
        defer { isBusy = false }
        if !isDemoMode { try await service.deleteAccount() }
        clearLocalSession()
    }

    private func clearLocalSession() {
        LocalNotificationManager.cancelAll()
        UserDefaults.standard.removeObject(forKey: "equalpath.onboardingCompleted")
        profile = nil
        isDemoMode = false
        onboarding = OnboardingDraft()
        snapshot = .empty
        snapshotLoadState = .idle
        weekSchedule = .empty
        weekScheduleLoadState = .idle
        scheduleNotice = nil
        phase = .welcome
    }

}
