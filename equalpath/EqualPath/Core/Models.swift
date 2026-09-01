import Foundation
import SwiftUI

enum CoverageState: String, Codable, CaseIterable {
    case noGap = "covered"
    case uncovered
    case unknown

    var label: String {
        switch self {
        case .noGap: "NO GAP"
        case .uncovered: "UNCOVERED"
        case .unknown: "UNKNOWN"
        }
    }

    var color: Color {
        switch self {
        case .noGap: EPColor.green
        case .uncovered: EPColor.rose
        case .unknown: EPColor.unknown
        }
    }
}

struct CoverageSummary: Equatable, Codable {
    var state: CoverageState
    var gapHours: Double
    var spanHours: Double
    var startMinute: Int
    var endMinute: Int
    var checkedAt: Date
    var isStale: Bool = false

    var ringFraction: Double {
        guard state != .noGap else { return 1 }
        guard spanHours > 0 else { return 0 }
        return min(max(gapHours / spanHours, 0), 1)
    }

    var hourLabel: String {
        let rounded = gapHours.rounded()
        return rounded == gapHours ? "\(Int(rounded))h" : String(format: "%.1fh", gapHours)
    }

    var timeRange: String {
        "\(Self.time(startMinute)) — \(Self.time(endMinute))"
    }

    static func time(_ minute: Int) -> String {
        String(format: "%02d:%02d", minute / 60, minute % 60)
    }
}

struct ChildCoverage: Identifiable, Equatable {
    let id: String
    var name: String
    var summary: CoverageSummary
}

struct SourceRecord: Identifiable, Equatable {
    let id: String
    var icon: String
    var title: String
    var detail: String

    init(id: String = UUID().uuidString, icon: String, title: String, detail: String) {
        self.id = id
        self.icon = icon
        self.title = title
        self.detail = detail
    }
}

struct TimelineRecord: Identifiable, Equatable {
    enum Kind: String, Equatable {
        case careRequired
        case careCoverage
        case work
        case uncovered
        case unknown
    }

    let id: String
    var kind: Kind
    var title: String
    var detail: String
    var startMinute: Int
    var endMinute: Int
}

enum ScheduleEntryKind: String, Codable, CaseIterable, Identifiable {
    case work
    case careRequired
    case careCoverage

    var id: String { rawValue }

    var label: String {
        switch self {
        case .work: "Work"
        case .careRequired: "Care needed"
        case .careCoverage: "Care coverage"
        }
    }

    var icon: String {
        switch self {
        case .work: "briefcase"
        case .careRequired: "clock.badge.exclamationmark"
        case .careCoverage: "person.2.fill"
        }
    }

    var timelineKind: TimelineRecord.Kind {
        switch self {
        case .work: .work
        case .careRequired: .careRequired
        case .careCoverage: .careCoverage
        }
    }
}

struct ScheduleChild: Identifiable, Equatable {
    let id: String
    var name: String
    var ageGroup: String
}

struct ScheduleEntry: Identifiable, Equatable {
    let id: String
    var spanGroup: String?
    var spanPart: Int?
    var kind: ScheduleEntryKind
    var date: Date
    var dateLocal: String
    var childID: String?
    var childName: String?
    var title: String
    var notes: String
    var startMinute: Int
    var endMinute: Int
    var locationMode: String
    var remotePossible: Bool
    var priority: String
    var collectByMinute: Int?
    var generatedFromPattern: Bool
    var patternID: String? = nil
    var isOverride: Bool = false
    var handoverInRef: String? = nil
    var handoverOutRef: String? = nil
    var handoverInName: String? = nil
    var handoverOutName: String? = nil

    var timeRange: String {
        "\(CoverageSummary.time(startMinute)) — \(CoverageSummary.time(endMinute))"
    }
}

struct HandoverPerson: Identifiable, Equatable {
    let id: String
    var name: String
    var isAccountOwner: Bool
}

struct TravelTimes: Equatable {
    var homeToCareMinutes: Int?
    var careToWorkMinutes: Int?
    var homeToWorkMinutes: Int?

    var isComplete: Bool {
        homeToCareMinutes != nil && careToWorkMinutes != nil && homeToWorkMinutes != nil
    }
}

struct SchedulePattern: Identifiable, Equatable {
    let id: String
    var kind: ScheduleEntryKind
    var childID: String?
    var title: String
    var notes: String
    var weekdays: [EqualPathWeekday]
    var startMinute: Int
    var endMinute: Int
    var effectiveFrom: Date
    var effectiveUntil: Date?
    var locationMode: String
    var remotePossible: Bool
    var priority: String
    var collectByMinute: Int?
    var handoverInRef: String?
    var handoverOutRef: String?
    var active: Bool
}

struct ConflictItem: Identifiable, Equatable {
    let id: String
    var childID: String
    var childName: String
    var state: CoverageState
    var kind: String
    var priority: String
    var startMinute: Int
    var endMinute: Int
    var durationMinutes: Int
    var sourceRecords: [String]

    var timeRange: String {
        "\(CoverageSummary.time(startMinute)) — \(CoverageSummary.time(endMinute))"
    }

    var durationLabel: String {
        let hours = Double(durationMinutes) / 60
        return hours.rounded() == hours ? "\(Int(hours))h" : String(format: "%.1fh", hours)
    }

    var priorityExplanation: String {
        switch priority {
        case "high": "Fixed, non-remote work is ranked first."
        case "review": "Verification is required before EqualPath can call this uncovered."
        default: "Flexible or remote-capable work follows fixed, non-remote commitments."
        }
    }
}

struct ScheduleDay: Identifiable, Equatable {
    var id: String { dateLocal }
    var date: Date
    var dateLocal: String
    var entries: [ScheduleEntry]
    var conflicts: [ConflictItem]

    var careGaps: [CareGap] {
        let requiredEntries = entries.filter { $0.kind == .careRequired && $0.childID != nil }
        let requiredByChild = Dictionary(grouping: requiredEntries) { $0.childID! }
        var results: [CareGap] = []
        for (childID, childRequirements) in requiredByChild {
            let childCoverage = entries.filter { $0.kind == .careCoverage && $0.childID == childID }
            let coverageIntervals: [(Int, Int)] = childCoverage.map { entry in
                let effectiveEnd = min(entry.endMinute, entry.collectByMinute ?? entry.endMinute)
                return (entry.startMinute, effectiveEnd)
            }
            let requirementIntervals: [(Int, Int)] = childRequirements.map { ($0.startMinute, $0.endMinute) }
            let gaps = Self.subtract(Self.merge(requirementIntervals), Self.merge(coverageIntervals))
            for (index, interval) in gaps.enumerated() {
                results.append(CareGap(
                    id: "\(dateLocal)-\(childID)-\(index)",
                    childName: childRequirements.first?.childName ?? "Child",
                    startMinute: interval.0,
                    endMinute: interval.1
                ))
            }
        }
        return results.sorted {
            $0.startMinute == $1.startMinute ? $0.id < $1.id : $0.startMinute < $1.startMinute
        }
    }

    var hasRequiredCare: Bool { entries.contains { $0.kind == .careRequired } }

    private static func merge(_ values: [(Int, Int)]) -> [(Int, Int)] {
        let sorted = values.filter { $0.1 > $0.0 }.sorted { $0.0 == $1.0 ? $0.1 < $1.1 : $0.0 < $1.0 }
        guard var current = sorted.first else { return [] }
        var result: [(Int, Int)] = []
        for value in sorted.dropFirst() {
            if value.0 <= current.1 {
                current.1 = max(current.1, value.1)
            } else {
                result.append(current)
                current = value
            }
        }
        result.append(current)
        return result
    }

    private static func subtract(_ required: [(Int, Int)], _ covered: [(Int, Int)]) -> [(Int, Int)] {
        required.flatMap { requirement in
            var cursor = requirement.0
            var gaps: [(Int, Int)] = []
            for coverage in covered where coverage.1 > requirement.0 && coverage.0 < requirement.1 {
                let start = max(requirement.0, coverage.0)
                let end = min(requirement.1, coverage.1)
                if start > cursor { gaps.append((cursor, start)) }
                cursor = max(cursor, end)
                if cursor >= requirement.1 { break }
            }
            if cursor < requirement.1 { gaps.append((cursor, requirement.1)) }
            return gaps
        }
    }
}

struct CareGap: Identifiable, Equatable {
    let id: String
    var childName: String
    var startMinute: Int
    var endMinute: Int

    var timeRange: String { "\(CoverageSummary.time(startMinute)) — \(CoverageSummary.time(endMinute))" }
    var durationLabel: String {
        let hours = Double(endMinute - startMinute) / 60
        return hours.rounded() == hours ? "\(Int(hours))h" : String(format: "%.1fh", hours)
    }
}

struct WeekSchedule: Equatable {
    var startDate: Date
    var endDate: Date
    var days: [ScheduleDay]
    var children: [ScheduleChild]
    var lastSuccessfulSweepAt: Date?
    var latestSweepError: String?
    var patterns: [SchedulePattern] = []
    var handoverPeople: [HandoverPerson] = []
    var travelTimes = TravelTimes(homeToCareMinutes: nil, careToWorkMinutes: nil, homeToWorkMinutes: nil)

    static let empty = WeekSchedule(
        startDate: .now,
        endDate: .now,
        days: [],
        children: [],
        lastSuccessfulSweepAt: nil,
        latestSweepError: nil
    )

    static func preview(startingAt startDate: Date = .now) -> WeekSchedule {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: startDate)
        let child = ScheduleChild(id: "nia", name: "Nia", ageGroup: "5-12")
        let dateString: (Date) -> String = { date in
            let formatter = DateFormatter()
            formatter.calendar = calendar
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter.string(from: date)
        }
        let days = (0..<14).map { offset -> ScheduleDay in
            let date = calendar.date(byAdding: .day, value: offset, to: start) ?? start
            let local = dateString(date)
            guard offset == 0 else {
                return ScheduleDay(date: date, dateLocal: local, entries: [], conflicts: [])
            }
            let entries = [
                ScheduleEntry(id: "preview-required", spanGroup: nil, spanPart: nil, kind: .careRequired, date: date, dateLocal: local, childID: child.id, childName: child.name, title: "Care needed", notes: "School day", startMinute: 480, endMinute: 1020, locationMode: "", remotePossible: false, priority: "normal", collectByMinute: nil, generatedFromPattern: true, patternID: "preview-required-pattern"),
                ScheduleEntry(id: "preview-coverage", spanGroup: nil, spanPart: nil, kind: .careCoverage, date: date, dateLocal: local, childID: child.id, childName: child.name, title: "TASKA Seri Kasih", notes: "Registered hours", startMinute: 480, endMinute: 930, locationMode: "TASKA Seri Kasih", remotePossible: false, priority: "normal", collectByMinute: 930, generatedFromPattern: true, patternID: "preview-coverage-pattern", handoverInRef: "preview", handoverOutRef: "preview", handoverInName: "Aina", handoverOutName: "Aina"),
                ScheduleEntry(id: "preview-work", spanGroup: nil, spanPart: nil, kind: .work, date: date, dateLocal: local, childID: nil, childName: nil, title: "Client review", notes: "Fixed work", startMinute: 540, endMinute: 1020, locationMode: "office", remotePossible: false, priority: "fixed", collectByMinute: nil, generatedFromPattern: false)
            ]
            let conflict = ConflictItem(id: "preview-conflict", childID: child.id, childName: child.name, state: .uncovered, kind: "care_work_overlap", priority: "high", startMinute: 930, endMinute: 1020, durationMinutes: 90, sourceRecords: ["TASKA Seri Kasih", "Client review"])
            return ScheduleDay(date: date, dateLocal: local, entries: entries, conflicts: [conflict])
        }
        return WeekSchedule(
            startDate: start,
            endDate: calendar.date(byAdding: .day, value: 13, to: start) ?? start,
            days: days,
            children: [child],
            lastSuccessfulSweepAt: .now,
            latestSweepError: nil,
            patterns: [
                SchedulePattern(id: "preview-required-pattern", kind: .careRequired, childID: child.id, title: "Care needed", notes: "School day", weekdays: [.monday, .tuesday, .wednesday, .thursday, .friday], startMinute: 480, endMinute: 1020, effectiveFrom: start, effectiveUntil: nil, locationMode: "", remotePossible: false, priority: "normal", collectByMinute: nil, handoverInRef: nil, handoverOutRef: nil, active: true),
                SchedulePattern(id: "preview-coverage-pattern", kind: .careCoverage, childID: child.id, title: "TASKA Seri Kasih", notes: "Registered hours", weekdays: [.monday, .tuesday, .wednesday, .thursday, .friday], startMinute: 480, endMinute: 930, effectiveFrom: start, effectiveUntil: nil, locationMode: "TASKA Seri Kasih", remotePossible: false, priority: "normal", collectByMinute: 930, handoverInRef: "preview", handoverOutRef: "preview", active: true)
            ],
            handoverPeople: [HandoverPerson(id: "preview", name: "Aina", isAccountOwner: true)],
            travelTimes: TravelTimes(homeToCareMinutes: 20, careToWorkMinutes: 30, homeToWorkMinutes: 35)
        )
    }
}

struct ScheduleEntryDraft: Equatable {
    var id: String?
    var spanGroup: String?
    var kind: ScheduleEntryKind = .work
    var date: Date = .now
    var childID: String?
    var title = ""
    var notes = ""
    var startMinute = 9 * 60
    var endMinute = 17 * 60
    var locationMode = "office"
    var remotePossible = false
    var priority = "fixed"
    var collectByMinute: Int?
    var handoverInRef: String?
    var handoverOutRef: String?
    var travelHomeCareMinutes: Int?
    var travelCareWorkMinutes: Int?
    var travelHomeWorkMinutes: Int?
    var repeatWeekly = false
    var editingPattern = false
    var patternID: String?
    var weekdays: [EqualPathWeekday] = []
    var effectiveFrom: Date = .now
    var effectiveUntil: Date?

    init() {}

    init(entry: ScheduleEntry) {
        id = entry.id
        spanGroup = entry.spanGroup
        kind = entry.kind
        date = entry.date
        childID = entry.childID
        title = entry.title
        notes = entry.notes
        startMinute = entry.startMinute
        endMinute = entry.endMinute
        locationMode = entry.locationMode
        remotePossible = entry.remotePossible
        priority = entry.priority
        collectByMinute = entry.collectByMinute
        handoverInRef = entry.handoverInRef
        handoverOutRef = entry.handoverOutRef
        patternID = entry.patternID
        effectiveFrom = entry.date
    }

    init(pattern: SchedulePattern) {
        kind = pattern.kind
        childID = pattern.childID
        title = pattern.title
        notes = pattern.notes
        startMinute = pattern.startMinute
        endMinute = pattern.endMinute
        locationMode = pattern.locationMode
        remotePossible = pattern.remotePossible
        priority = pattern.priority
        collectByMinute = pattern.collectByMinute
        handoverInRef = pattern.handoverInRef
        handoverOutRef = pattern.handoverOutRef
        repeatWeekly = true
        editingPattern = true
        patternID = pattern.id
        weekdays = pattern.weekdays
        date = pattern.effectiveFrom
        effectiveFrom = pattern.effectiveFrom
        effectiveUntil = pattern.effectiveUntil
    }

    func validationMessages(visibleDates: ClosedRange<Date>, calendar: Calendar = .current) -> [String] {
        var messages: [String] = []
        let day = calendar.startOfDay(for: date)
        if !repeatWeekly && !visibleDates.contains(day) { messages.append("Choose a date inside the rolling fourteen-day planning window.") }
        if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            messages.append(kind == .work ? "Enter the work commitment type or title." : "Enter the care source or label.")
        }
        if startMinute == endMinute { messages.append("Start and end time cannot be the same.") }
        if kind != .work && childID == nil { messages.append("Choose the child this care record belongs to.") }
        if kind == .careCoverage && collectByMinute == nil { messages.append("Enter the provider’s latest collection time.") }
        if kind == .careCoverage && handoverInRef == nil { messages.append("Choose who is responsible for drop-off.") }
        if kind == .careCoverage && handoverOutRef == nil { messages.append("Choose who is responsible for collection.") }
        if kind == .work && locationMode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            messages.append("Choose where this work commitment happens.")
        }
        if repeatWeekly && weekdays.isEmpty { messages.append("Choose at least one weekday for this weekly pattern.") }
        if repeatWeekly && endMinute <= startMinute { messages.append("A weekly pattern must end later on the same day.") }
        if kind == .careCoverage && [travelHomeCareMinutes, travelCareWorkMinutes, travelHomeWorkMinutes].contains(nil) {
            messages.append("Enter all three travel times so EqualPath can calculate both handovers.")
        }
        if let effectiveUntil, calendar.startOfDay(for: effectiveUntil) < calendar.startOfDay(for: effectiveFrom) {
            messages.append("The weekly pattern’s end date cannot be before its start date.")
        }
        return messages
    }
}

struct TomorrowSnapshot: Equatable {
    var date: Date
    var summary: CoverageSummary
    var children: [ChildCoverage]
    var sources: [SourceRecord]
    var featuredChildName: String?
    var timeline: [TimelineRecord]
    var conflicts: [ConflictItem]
    var hasScheduleData: Bool
    var latestSweepError: String?

    static let empty = TomorrowSnapshot(
        date: Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now,
        summary: CoverageSummary(
            state: .noGap,
            gapHours: 0,
            spanHours: 0,
            startMinute: 0,
            endMinute: 0,
            checkedAt: .now,
            isStale: true
        ),
        children: [],
        sources: [],
        featuredChildName: nil,
        timeline: [],
        conflicts: [],
        hasScheduleData: false,
        latestSweepError: nil
    )

    static let preview: TomorrowSnapshot = {
        let calendar = Calendar(identifier: .gregorian)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: .now) ?? .now
        let checked = Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: .now) ?? .now
        let gap = CoverageSummary(
            state: .uncovered,
            gapHours: 9,
            spanHours: 9,
            startMinute: 8 * 60,
            endMinute: 17 * 60,
            checkedAt: checked
        )
        let safe = CoverageSummary(
            state: .noGap,
            gapHours: 0,
            spanHours: 9,
            startMinute: 8 * 60,
            endMinute: 17 * 60,
            checkedAt: checked
        )
        return TomorrowSnapshot(
            date: tomorrow,
            summary: gap,
            children: [
                ChildCoverage(id: "nia", name: "Nia", summary: gap),
                ChildCoverage(id: "idris", name: "Idris", summary: safe)
            ],
            sources: [
                SourceRecord(icon: "building.2", title: "Provider closed", detail: "TASKA Seri Kasih · JKM record"),
                SourceRecord(icon: "briefcase", title: "Work ends 15:30", detail: "Client review is fixed"),
                SourceRecord(icon: "car", title: "Travel 30 min", detail: "Counted between work and care")
            ],
            featuredChildName: "Nia",
            timeline: [
                TimelineRecord(id: "preview-required", kind: .careRequired, title: "Care needed", detail: "Nia", startMinute: 480, endMinute: 1020),
                TimelineRecord(id: "preview-care", kind: .careCoverage, title: "Registered care", detail: "TASKA Seri Kasih", startMinute: 480, endMinute: 960),
                TimelineRecord(id: "preview-work", kind: .work, title: "Client review", detail: "Fixed work commitment", startMinute: 600, endMinute: 930),
                TimelineRecord(id: "preview-gap", kind: .uncovered, title: "Nia needs cover", detail: "Uncovered", startMinute: 480, endMinute: 1020)
            ],
            conflicts: [
                ConflictItem(
                    id: "preview-conflict",
                    childID: "nia",
                    childName: "Nia",
                    state: .uncovered,
                    kind: "care_work_overlap",
                    priority: "high",
                    startMinute: 960,
                    endMinute: 1020,
                    durationMinutes: 60,
                    sourceRecords: ["TASKA Seri Kasih", "Client review"]
                )
            ],
            hasScheduleData: true,
            latestSweepError: nil
        )
    }()
}

enum SnapshotLoadState: Equatable {
    case idle
    case loading
    case loaded
    case failed(String)
}

struct UserProfile: Equatable {
    var id: String
    var name: String
    var email: String
}

enum EqualPathWeekday: Int, CaseIterable, Codable, Identifiable {
    case monday
    case tuesday
    case wednesday
    case thursday
    case friday
    case saturday
    case sunday

    var id: Int { rawValue }

    var initial: String {
        switch self {
        case .monday: "M"
        case .tuesday, .thursday: "T"
        case .wednesday: "W"
        case .friday: "F"
        case .saturday, .sunday: "S"
        }
    }

    var shortName: String {
        switch self {
        case .monday: "Mon"
        case .tuesday: "Tue"
        case .wednesday: "Wed"
        case .thursday: "Thu"
        case .friday: "Fri"
        case .saturday: "Sat"
        case .sunday: "Sun"
        }
    }

    var fullName: String {
        switch self {
        case .monday: "Monday"
        case .tuesday: "Tuesday"
        case .wednesday: "Wednesday"
        case .thursday: "Thursday"
        case .friday: "Friday"
        case .saturday: "Saturday"
        case .sunday: "Sunday"
        }
    }

    var backendCode: String {
        switch self {
        case .monday: "MON"
        case .tuesday: "TUE"
        case .wednesday: "WED"
        case .thursday: "THU"
        case .friday: "FRI"
        case .saturday: "SAT"
        case .sunday: "SUN"
        }
    }

    init?(backendCode: String) {
        switch backendCode.uppercased() {
        case "MON": self = .monday
        case "TUE": self = .tuesday
        case "WED": self = .wednesday
        case "THU": self = .thursday
        case "FRI": self = .friday
        case "SAT": self = .saturday
        case "SUN": self = .sunday
        default: return nil
        }
    }
}

struct OnboardingDraft: Equatable {
    var name = "Aina"
    var email = ""
    var children = ["Nia", "Idris"]
    var childAgeGroups = ["5-12", "5-12"]
    var providerName = "TASKA Seri Kasih"
    var workArea = "KL Sentral"
    var homeArea = "Ampang"
    var careDays: [EqualPathWeekday] = [.monday, .tuesday, .wednesday, .thursday, .friday]
    var careStartMinute = 8 * 60
    var careEndMinute = 16 * 60
    var collectionBy = "You"
    var officeDays: [EqualPathWeekday] = [.monday, .tuesday, .wednesday, .thursday]
    var officeStartMinute = 9 * 60
    var officeEndMinute = 17 * 60 + 30
    var homeWorkDays: [EqualPathWeekday] = [.friday]
    var homeWorkStartMinute = 9 * 60
    var homeWorkEndMinute = 15 * 60
    var travelHomeCareMinutes = 20
    var travelCareWorkMinutes = 30
    var travelHomeWorkMinutes = 35
    var travelMinutes: Int {
        get { travelCareWorkMinutes }
        set { travelCareWorkMinutes = newValue }
    }
    var notificationEnabled = true
    var carers = ["Farid", "Mother"]
}

enum AppPhase: Equatable {
    case launching
    case welcome
    case onboarding
    case main
}
