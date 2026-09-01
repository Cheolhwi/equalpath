import XCTest
@testable import EqualPath

final class CoverageSummaryTests: XCTestCase {
    func testZeroGapUsesFullGreenNoGapConvention() {
        let summary = CoverageSummary(
            state: .noGap,
            gapHours: 0,
            spanHours: 9,
            startMinute: 480,
            endMinute: 1020,
            checkedAt: .now
        )

        XCTAssertEqual(summary.hourLabel, "0h")
        XCTAssertEqual(summary.state.label, "NO GAP")
        XCTAssertEqual(summary.ringFraction, 1)
    }

    func testFullDayGapUsesFullRing() {
        let summary = CoverageSummary(
            state: .uncovered,
            gapHours: 9,
            spanHours: 9,
            startMinute: 480,
            endMinute: 1020,
            checkedAt: .now
        )

        XCTAssertEqual(summary.hourLabel, "9h")
        XCTAssertEqual(summary.state.label, "UNCOVERED")
        XCTAssertEqual(summary.ringFraction, 1)
    }

    func testPartialGapUsesGapOverSpan() {
        let summary = CoverageSummary(
            state: .uncovered,
            gapHours: 2.5,
            spanHours: 10,
            startMinute: 900,
            endMinute: 1050,
            checkedAt: .now
        )

        XCTAssertEqual(summary.ringFraction, 0.25, accuracy: 0.0001)
    }

    func testUnknownIsNotRelabelledAsUncovered() {
        let summary = CoverageSummary(
            state: .unknown,
            gapHours: 0,
            spanHours: 1,
            startMinute: 1020,
            endMinute: 1080,
            checkedAt: .now
        )

        XCTAssertEqual(summary.state.label, "UNKNOWN")
        XCTAssertNotEqual(summary.state, .uncovered)
    }

    func testEditableOnboardingScheduleHasBackendReadyDefaults() {
        let draft = OnboardingDraft()

        XCTAssertEqual(draft.careDays.map(\.backendCode), ["MON", "TUE", "WED", "THU", "FRI"])
        XCTAssertEqual(draft.careStartMinute, 480)
        XCTAssertEqual(draft.careEndMinute, 960)
        XCTAssertEqual(draft.officeDays.map(\.backendCode), ["MON", "TUE", "WED", "THU"])
        XCTAssertEqual(draft.homeWorkDays.map(\.backendCode), ["FRI"])
        XCTAssertEqual(draft.travelMinutes, 30)
        XCTAssertEqual(draft.travelHomeCareMinutes, 20)
        XCTAssertEqual(draft.travelCareWorkMinutes, 30)
        XCTAssertEqual(draft.travelHomeWorkMinutes, 35)
        XCTAssertEqual(draft.childAgeGroups, ["5-12", "5-12"])
    }

    func testCrossMidnightScheduleDraftIsValidAndZeroLengthIsRejected() {
        let calendar = Calendar(identifier: .gregorian)
        let date = calendar.startOfDay(for: .now)
        let range = date...(calendar.date(byAdding: .day, value: 6, to: date) ?? date)
        var draft = ScheduleEntryDraft()
        draft.title = "Night shift"
        draft.date = date
        draft.startMinute = 22 * 60
        draft.endMinute = 2 * 60

        XCTAssertTrue(draft.validationMessages(visibleDates: range, calendar: calendar).isEmpty)

        draft.endMinute = draft.startMinute
        XCTAssertTrue(draft.validationMessages(visibleDates: range, calendar: calendar).contains("Start and end time cannot be the same."))
    }

    func testCareDraftRequiresAChild() {
        let calendar = Calendar(identifier: .gregorian)
        let date = calendar.startOfDay(for: .now)
        var draft = ScheduleEntryDraft()
        draft.kind = .careCoverage
        draft.title = "Grandparent"
        draft.date = date

        let messages = draft.validationMessages(visibleDates: date...date, calendar: calendar)

        XCTAssertTrue(messages.contains("Choose the child this care record belongs to."))
    }

    func testRollingPlanningWindowContainsExactlyFourteenDays() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let start = calendar.startOfDay(for: .now)
        let end = calendar.date(byAdding: .day, value: 13, to: start)!
        let outside = calendar.date(byAdding: .day, value: 14, to: start)!
        var draft = ScheduleEntryDraft()
        draft.title = "Office"
        draft.date = end

        XCTAssertFalse(draft.validationMessages(visibleDates: start...end, calendar: calendar).contains(where: { $0.contains("fourteen-day") }))

        draft.date = outside
        XCTAssertTrue(draft.validationMessages(visibleDates: start...end, calendar: calendar).contains("Choose a date inside the rolling fourteen-day planning window."))
        XCTAssertEqual(WeekSchedule.preview(startingAt: start).days.count, 14)
    }

    func testWeeklyPatternRequiresAWeekdayAndSameDayInterval() {
        let start = Calendar.current.startOfDay(for: .now)
        var draft = ScheduleEntryDraft()
        draft.title = "Office"
        draft.repeatWeekly = true
        draft.effectiveFrom = start
        draft.startMinute = 22 * 60
        draft.endMinute = 2 * 60

        var messages = draft.validationMessages(visibleDates: start...start)
        XCTAssertTrue(messages.contains("Choose at least one weekday for this weekly pattern."))
        XCTAssertTrue(messages.contains("A weekly pattern must end later on the same day."))

        draft.weekdays = [.monday]
        draft.endMinute = 23 * 60
        messages = draft.validationMessages(visibleDates: start...start)
        XCTAssertFalse(messages.contains(where: { $0.contains("weekly pattern") }))
    }

    func testCoverageRequiresCompleteHandoverInputs() {
        let start = Calendar.current.startOfDay(for: .now)
        var draft = ScheduleEntryDraft()
        draft.kind = .careCoverage
        draft.title = "TASKA"
        draft.childID = "child"
        draft.date = start

        var messages = draft.validationMessages(visibleDates: start...start)
        XCTAssertTrue(messages.contains("Enter the provider’s latest collection time."))
        XCTAssertTrue(messages.contains("Choose who is responsible for drop-off."))
        XCTAssertTrue(messages.contains("Choose who is responsible for collection."))
        XCTAssertTrue(messages.contains("Enter all three travel times so EqualPath can calculate both handovers."))

        draft.collectByMinute = 16 * 60
        draft.handoverInRef = "user"
        draft.handoverOutRef = "user"
        draft.travelHomeCareMinutes = 20
        draft.travelCareWorkMinutes = 30
        draft.travelHomeWorkMinutes = 35
        messages = draft.validationMessages(visibleDates: start...start)
        XCTAssertTrue(messages.isEmpty)
    }

    func testEmptySnapshotDoesNotClaimCoverage() {
        XCTAssertFalse(TomorrowSnapshot.empty.hasScheduleData)
        XCTAssertTrue(TomorrowSnapshot.empty.children.isEmpty)
        XCTAssertTrue(TomorrowSnapshot.empty.timeline.isEmpty)
    }

    func testConflictExplanationNamesThePriorityRule() {
        let conflict = ConflictItem(
            id: "conflict",
            childID: "child",
            childName: "Child",
            state: .uncovered,
            kind: "care_work_overlap",
            priority: "high",
            startMinute: 960,
            endMinute: 1020,
            durationMinutes: 60,
            sourceRecords: ["Office shift", "School"]
        )

        XCTAssertEqual(conflict.durationLabel, "1h")
        XCTAssertEqual(conflict.priorityExplanation, "Fixed, non-remote work is ranked first.")
    }

    func testWeeklyCareGapsMergeOverlappingCoverageBeforeSubtracting() {
        let date = Calendar.current.startOfDay(for: .now)
        let entries = [
            ScheduleEntry(id: "required", spanGroup: nil, spanPart: nil, kind: .careRequired, date: date, dateLocal: "2026-08-30", childID: "child", childName: "Nia", title: "Care needed", notes: "", startMinute: 480, endMinute: 1020, locationMode: "", remotePossible: false, priority: "normal", collectByMinute: nil, generatedFromPattern: false),
            ScheduleEntry(id: "coverage-1", spanGroup: nil, spanPart: nil, kind: .careCoverage, date: date, dateLocal: "2026-08-30", childID: "child", childName: "Nia", title: "School", notes: "", startMinute: 480, endMinute: 840, locationMode: "", remotePossible: false, priority: "normal", collectByMinute: nil, generatedFromPattern: false),
            ScheduleEntry(id: "coverage-2", spanGroup: nil, spanPart: nil, kind: .careCoverage, date: date, dateLocal: "2026-08-30", childID: "child", childName: "Nia", title: "Grandparent", notes: "", startMinute: 780, endMinute: 900, locationMode: "", remotePossible: false, priority: "normal", collectByMinute: nil, generatedFromPattern: false)
        ]
        let day = ScheduleDay(date: date, dateLocal: "2026-08-30", entries: entries, conflicts: [])

        XCTAssertEqual(day.careGaps, [CareGap(id: "2026-08-30-child-0", childName: "Nia", startMinute: 900, endMinute: 1020)])
    }

    @MainActor
    func testLocalReminderFiresThePreviousDayAtConfiguredHour() throws {
        let timezone = try XCTUnwrap(TimeZone(identifier: "Asia/Kuala_Lumpur"))
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        let now = try XCTUnwrap(calendar.date(from: DateComponents(
            timeZone: timezone,
            year: 2026,
            month: 8,
            day: 28,
            hour: 12
        )))
        let plan = LocalNotificationPlan(
            dateLocal: "2026-08-29",
            notifyHour: 21,
            timezoneIdentifier: timezone.identifier,
            uncoveredMinutes: 60,
            needsVerification: false
        )

        let fireDate = try XCTUnwrap(LocalNotificationManager.reminderDate(for: plan, now: now))
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)

        XCTAssertEqual(components.year, 2026)
        XCTAssertEqual(components.month, 8)
        XCTAssertEqual(components.day, 28)
        XCTAssertEqual(components.hour, 21)
        XCTAssertEqual(components.minute, 0)
    }

    func testBackendFailureUsesActionableCopy() {
        let message = EqualPathServiceError.backend("backend_operation_failed").errorDescription

        XCTAssertEqual(message, "EqualPath’s backend couldn’t save this setup. Please try again.")
        XCTAssertNotEqual(message, EqualPathServiceError.invalidResponse.errorDescription)
    }
}
